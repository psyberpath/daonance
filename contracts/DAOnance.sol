// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title DAOnance — Private On-Chain Governance
/// @notice Vote without revealing your vote. Tallies are computed homomorphically.
contract DAOnance is ZamaEthereumConfig {
    //  Types
    struct Proposal {
        uint256 id;
        string title;
        string description;
        address creator;
        uint256 deadline;
        euint32 encryptedYesCount;
        euint32 encryptedNoCount;
        uint32 voteCount;
        uint32 voteLimit;
        bool revealed;
        uint32 revealedYesCount;
        uint32 revealedNoCount;
    }

    //  State
    uint256 public proposalCount;
    mapping(uint256 => Proposal) private _proposals;
    mapping(uint256 => mapping(address => bool)) private _hasVoted;

    //  Events
    event ProposalCreated(uint256 indexed proposalId, address indexed creator, string title, uint256 deadline);
    event VoteCast(uint256 indexed proposalId, address indexed voter);
    event RevealRequested(uint256 indexed proposalId);
    event RevealFinalized(uint256 indexed proposalId, uint32 yesCount, uint32 noCount);

    //  Create Proposal
    /// @notice Creates a new governance proposal
    /// @param title Short title of the proposal
    /// @param description Longer description of the proposal
    /// @param durationSeconds How long voting stays open (seconds from now)
    /// @param voteLimit Maximum number of votes allowed
    function createProposal(
        string calldata title,
        string calldata description,
        uint256 durationSeconds,
        uint32 voteLimit
    ) external {
        require(bytes(title).length > 0, "DAOnance: empty title");
        require(durationSeconds > 0, "DAOnance: zero duration");
        require(voteLimit > 0, "DAOnance: zero vote limit");

        uint256 id = proposalCount;
        proposalCount++;

        Proposal storage p = _proposals[id];
        p.id = id;
        p.title = title;
        p.description = description;
        p.creator = msg.sender;
        p.deadline = block.timestamp + durationSeconds;
        p.voteLimit = voteLimit;

        // Initialize encrypted counters with trivially encrypted zeros
        p.encryptedYesCount = FHE.asEuint32(0);
        p.encryptedNoCount = FHE.asEuint32(0);

        // Grant contract permission to use these handles in future txns
        FHE.allowThis(p.encryptedYesCount);
        FHE.allowThis(p.encryptedNoCount);

        emit ProposalCreated(id, msg.sender, title, p.deadline);
    }

    //  Cast Vote
    /// @notice Cast an encrypted vote on a proposal
    /// @dev Voter encrypts 1 for YES or 0 for NO off-chain as externalEuint32
    /// @param proposalId The proposal to vote on
    /// @param encryptedVote Encrypted vote (1 = yes, 0 = no)
    /// @param inputProof ZK proof binding the ciphertext to msg.sender and this contract
    function castVote(uint256 proposalId, externalEuint32 encryptedVote, bytes calldata inputProof) external {
        Proposal storage p = _proposals[proposalId];

        require(FHE.isInitialized(p.encryptedYesCount), "DAOnance: proposal does not exist");
        require(block.timestamp < p.deadline, "DAOnance: voting ended");
        require(!_hasVoted[proposalId][msg.sender], "DAOnance: already voted");
        require(p.voteCount < p.voteLimit, "DAOnance: vote limit reached");

        // Convert external ciphertext → internal ciphertext
        euint32 eVote = FHE.fromExternal(encryptedVote, inputProof);

        // Determine if this is a YES vote (vote != 0) → encrypted boolean
        ebool isYes = FHE.ne(eVote, FHE.asEuint32(0));

        // Homomorphic conditional addition using FHE.select
        // YES path: add 1 to yesCount, 0 to noCount
        // NO  path: add 0 to yesCount, 1 to noCount
        euint32 yesIncrement = FHE.select(isYes, FHE.asEuint32(1), FHE.asEuint32(0));
        euint32 noIncrement = FHE.select(isYes, FHE.asEuint32(0), FHE.asEuint32(1));

        p.encryptedYesCount = FHE.add(p.encryptedYesCount, yesIncrement);
        p.encryptedNoCount = FHE.add(p.encryptedNoCount, noIncrement);

        // Grant contract permission to reuse updated ciphertext handles
        FHE.allowThis(p.encryptedYesCount);
        FHE.allowThis(p.encryptedNoCount);

        // Record vote
        _hasVoted[proposalId][msg.sender] = true;
        p.voteCount++;

        emit VoteCast(proposalId, msg.sender);
    }

    //  Request Reveal  (Step 1 of 3-step async decryption)
    /// @notice Marks encrypted tallies as publicly decryptable
    /// @dev Only the proposal creator can initiate. Must be past deadline.
    ///      After this, anyone can call publicDecrypt off-chain via the relayer.
    function requestReveal(uint256 proposalId) external {
        Proposal storage p = _proposals[proposalId];

        require(FHE.isInitialized(p.encryptedYesCount), "DAOnance: proposal does not exist");
        require(block.timestamp >= p.deadline, "DAOnance: voting still open");
        require(msg.sender == p.creator, "DAOnance: only creator can request reveal");
        require(!p.revealed, "DAOnance: already revealed");

        // Mark both encrypted tallies as publicly decryptable
        FHE.makePubliclyDecryptable(p.encryptedYesCount);
        FHE.makePubliclyDecryptable(p.encryptedNoCount);

        // Also allow the caller to decrypt off-chain via userDecryptEuint
        FHE.allow(p.encryptedYesCount, msg.sender);
        FHE.allow(p.encryptedNoCount, msg.sender);

        emit RevealRequested(proposalId);
    }

    //  Finalize Reveal  (Step 3 of 3-step async decryption)
    /// @notice Submit decrypted tallies with proof for on-chain verification
    /// @dev Permissionless — anyone can call. FHE.checkSignatures is the auth.
    /// @param proposalId The proposal to finalize
    /// @param yesCount The decrypted yes tally
    /// @param noCount The decrypted no tally
    /// @param decryptionProof Proof from the Zama relayer KMS
    function finalizeReveal(
        uint256 proposalId,
        uint32 yesCount,
        uint32 noCount,
        bytes calldata decryptionProof
    ) external {
        Proposal storage p = _proposals[proposalId];

        require(FHE.isInitialized(p.encryptedYesCount), "DAOnance: proposal does not exist");
        require(!p.revealed, "DAOnance: already finalized");

        // Build the handles array in the EXACT order used for off-chain decryption
        // Order: [encryptedYesCount, encryptedNoCount]
        bytes32[] memory handles = new bytes32[](2);
        handles[0] = FHE.toBytes32(p.encryptedYesCount);
        handles[1] = FHE.toBytes32(p.encryptedNoCount);

        // ABI-encode the cleartexts in the SAME order as handles
        bytes memory cleartexts = abi.encode(yesCount, noCount);

        // Verify the decryption proof — reverts if invalid
        FHE.checkSignatures(handles, cleartexts, decryptionProof);

        // Store the verified plaintext tallies
        p.revealed = true;
        p.revealedYesCount = yesCount;
        p.revealedNoCount = noCount;

        emit RevealFinalized(proposalId, yesCount, noCount);
    }

    //  View Functions
    /// @notice Get proposal details (public fields only)
    function getProposal(
        uint256 proposalId
    )
        external
        view
        returns (
            uint256 id,
            string memory title,
            string memory description,
            address creator,
            uint256 deadline,
            uint32 voteCount,
            uint32 voteLimit,
            bool revealed,
            uint32 revealedYesCount,
            uint32 revealedNoCount
        )
    {
        Proposal storage p = _proposals[proposalId];
        return (
            p.id,
            p.title,
            p.description,
            p.creator,
            p.deadline,
            p.voteCount,
            p.voteLimit,
            p.revealed,
            p.revealedYesCount,
            p.revealedNoCount
        );
    }

    /// @notice Get the encrypted vote handles (for off-chain decryption)
    function getEncryptedTallies(
        uint256 proposalId
    ) external view returns (euint32 encryptedYesCount, euint32 encryptedNoCount) {
        Proposal storage p = _proposals[proposalId];
        return (p.encryptedYesCount, p.encryptedNoCount);
    }

    /// @notice Check if an address has voted on a proposal
    function hasVoted(uint256 proposalId, address voter) external view returns (bool) {
        return _hasVoted[proposalId][voter];
    }
}
