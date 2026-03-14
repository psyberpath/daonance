export const CONTRACT_ADDRESS = "0xf511B527619C74d79c869208e5F3CEE47F971670"; // Sepolia

export const DAONANCE_ABI = [
  "function createProposal(string title, string description, uint256 durationSeconds, uint32 voteLimit) external",
  "function castVote(uint256 proposalId, bytes32 encryptedVote, bytes inputProof) external",
  "function requestReveal(uint256 proposalId) external",
  "function finalizeReveal(uint256 proposalId, uint32 yesCount, uint32 noCount, bytes decryptionProof) external",
  "function getProposal(uint256 proposalId) view returns (uint256 id, string title, string description, address creator, uint256 deadline, uint32 voteCount, uint32 voteLimit, bool revealed, uint32 revealedYesCount, uint32 revealedNoCount)",
  "function getEncryptedTallies(uint256 proposalId) view returns (bytes32 encryptedYesCount, bytes32 encryptedNoCount)",
  "function hasVoted(uint256 proposalId, address voter) view returns (bool)",
  "function proposalCount() view returns (uint256)",
  "event ProposalCreated(uint256 indexed proposalId, address indexed creator, string title, uint256 deadline)",
  "event VoteCast(uint256 indexed proposalId, address indexed voter)",
  "event RevealRequested(uint256 indexed proposalId)",
  "event RevealFinalized(uint256 indexed proposalId, uint32 yesCount, uint32 noCount)",
] as const;

export const CHAIN_CONFIG = {
  chainId: "0xaa36a7", // Sepolia 11155111
  chainName: "Sepolia",
  rpcUrls: ["https://rpc.sepolia.org"],
  blockExplorerUrls: ["https://sepolia.etherscan.io"],
};
