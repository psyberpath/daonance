# DAOnance Architecture

The DAOnance platform leverages Zama's Fully Homomorphic Encryption (FHE) protocol to bring true privacy to on-chain decentralized governance. Instead of traditional cleartext voting, where a user's address and choice are public on the blockchain, DAOnance ensures that individual votes remain encrypted at rest and during computation.

## Core Smart Contract Flow

The central component is `contracts/DAOnance.sol`. It utilizes `@fhevm/solidity` to encrypt states and perform homomorphic addition.

### 1. Proposal Creation
When a proposal is created, the contract initializes two encrypted counters for YES and NO votes using `FHE.asEuint32(0)`. This allows the counters to be mathematically added to later.

### 2. Encrypted Voting (`castVote`)
Voting relies on homomorphic branching via `FHE.select` to avoid expensive branching operators that would reveal the vote.

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
Because decrypting FHE data on a public EVM requires strong cryptographic guarantees (to prevent unauthorized decryption), the FHEVM enforces a 3-step async state reveal. 

1. **Request Reveal**: After the voting deadline, `requestReveal` is called. It invokes `FHE.makePubliclyDecryptable` on both `encryptedYesCount` and `encryptedNoCount`. The tallies are now marked for off-chain decryption.
2. **Off-Chain Decryption**: Node operators/relayers (or the UI via a KMS endpoint) fetch the handles and request the plaintext values along with a signature proof.
3. **Permissionless Finalization**: Anyone can call `finalizeReveal` with the plaintext counts and the cryptographic proof. The contract calls `FHE.checkSignatures` to ensure the threshold signature from the KMS is valid before permanently recording the plaintext result.

---

## Frontend Integration

The DAOnance frontend is lightweight, focusing on UX to abstract the `ethers` + FHE encryption complexity.

- Built with **React** and **Vite**.
- Uses an injected `window.ethereum` provider (MetaMask) wrapped in a custom `useWallet` hook.
- A **Premium Dark Theme** UI (amber on black) using pure CSS variables and modern typography, achieving an elegant aesthetic without relying on framework bloat.
- **Vote Encryption (Simulated)**: In a full hackathon integration, the `fhevm.createEncryptedInput` from `@fhevm/js` is meant to generate the `externalEuint32` and `inputProof` required by the contract. Due to local mock dependencies, the UX flow simulates this process.
