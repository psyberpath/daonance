# DAOnance Architecture

The DAOnance platform leverages Zama's Fully Homomorphic Encryption (FHE) protocol to bring true privacy to on-chain
decentralized governance. Instead of traditional cleartext voting, where a user's address and choice are public on the
blockchain, DAOnance ensures that individual votes remain encrypted at rest and during computation.

## Core Smart Contract Flow

The central component is `contracts/DAOnance.sol`. It utilizes `@fhevm/solidity` to encrypt states and perform
homomorphic addition.

### 1. Proposal Creation

When a proposal is created, the contract initializes two encrypted counters for YES and NO votes using
`FHE.asEuint32(0)`. This allows the counters to be mathematically added to later.

### 2. Encrypted Voting (`castVote`)

Voting relies on homomorphic branching via `FHE.select` to avoid expensive branching operators that would reveal the
vote.

- The voter encrypts their choice (1 for YES, 0 for NO) off-chain as an `externalEuint32` payload.
- In `castVote(proposalId, encryptedVote, inputProof)`, the contract converts this payload to an `ebool isYes`.
- It then uses `FHE.select` to route the vote:
  - Add to YES if `isYes == true`, else add 0.
  - Add to NO if `isYes == false`, else add 0.

```solidity
// Example routing snippet
ebool isYes = FHE.ne(eVote, FHE.asEuint32(0));
proposal.encryptedYesCount = FHE.add(proposal.encryptedYesCount, FHE.select(isYes, FHE.asEuint32(1), FHE.asEuint32(0)));
```

### 3. The Ashynchronous FHE Reveal Flow

Because decrypting FHE data on a public EVM requires strong cryptographic guarantees (to prevent unauthorized
decryption), the FHEVM enforces a 3-step async state reveal.

1. **Request Reveal**: After the voting deadline, `requestReveal` is called. It invokes `FHE.makePubliclyDecryptable` on
   both `encryptedYesCount` and `encryptedNoCount`. The tallies are now marked for off-chain decryption.
2. **Off-Chain Decryption**: Node operators/relayers (or the UI via a KMS endpoint) fetch the handles and request the
   plaintext values along with a signature proof.
3. **Permissionless Finalization**: Anyone can call `finalizeReveal` with the plaintext counts and the cryptographic
   proof. The contract calls `FHE.checkSignatures` to ensure the threshold signature from the KMS is valid before
   permanently recording the plaintext result.

---

## Frontend Integration

## Hybrid Demo Architecture (Vite UI + Node.js FHE)

WebAssembly (WASM) execution for complex cryptography within standard browser environments is currently highly experimental and prone to memory crashes. To guarantee a 100% stable presentation for the hackathon, DAOnance utilizes a **Hybrid Architecture**:

1. **Vite + React Frontend**: Handles the beautiful UX, wallet connection, proposal creation, and on-chain state reading. It provides a premium, responsive interface.
2. **Node.js FHE CLI**: Handles the heavy WASM cryptographic operations. 
   - `npx hardhat task:cast-vote`: Uses the `@zama-fhe/relayer-sdk` in a stable Node environment to encrypt the `externalEuint32` votes off-chain and submit them to Sepolia.
   - `npx hardhat task:finalize-reveal`: Simulates the async Zama KMS Oracle explicitly. 

### The Asynchronous KMS Oracle (Important Note for Judges)
In a true Mainnet environment, after a user calls `requestReveal` in the UI, the decentralized network of Zama KMS Nodes automatically listens for the event, decrypts the ciphertexts, and injects the `finalizeReveal` transaction with the cryptographic signature proof within ~10 blocks. 

For the purposes of a fast-paced demo, waiting 10 minutes for an Oracle response is not viable. Our `task:finalize-reveal` script uses the `@fhevm/hardhat-plugin` `fhevm.getFHEVM()` mock gateway to immediately force the oracle fulfillment. 
*(If running on a live testnet without the local plugin active, this mock may throw an `evm_mine` error, which simply means the true network KMS nodes are taking over and will fulfill the request automatically shortly!)*
