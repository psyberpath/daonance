# DAOnance — Private On-Chain Governance

**Tagline:** Vote without revealing your vote.

DAOnance is a privacy-first decentralized governance platform built on Zama's Fully Homomorphic Encryption (fhEVM)
protocol. It enables DAOs to create proposals where community members can cast encrypted votes on-chain. The smart
contract tallies the votes homomorphically without ever decrypting individual voter preferences.

## Features

- **Encrypted Voting:** Votes (1 for YES, 0 for NO) are encrypted off-chain and submitted as `externalEuint32` values.
- **Homomorphic Tallying:** The contract securely accumulates YES/NO counts using `FHE.add` and `FHE.select` without
  seeing the vote values.
- **Permissionless Reveal via FHE:** After the voting deadline, the encrypted tallies are made publicly decryptable via
  a 3-step async FHE flow, ensuring cryptographic integrity before plaintext results are stored on-chain.
- **Double-Vote Prevention:** Standard mapping checks ensure each address can only cast one encrypted vote per proposal.

## Deployment

The DAOnance smart contract is deployed on the **Sepolia Testnet**.

- **Contract Address:** `0xf511B527619C74d79c869208e5F3CEE47F971670`
- **Network:** Sepolia (Chain ID: 11155111)

## Setup & Running Locally

### 1. Smart Contract (Hardhat)

```bash
# Install dependencies
npm install

# Run the FHE test suite
npx hardhat test

# Deploy to local FHEVM node or Sepolia
npx hardhat deploy --network sepolia --tags DAOnance
```

### 2. Frontend (Vite + React)

The frontend features a premium, vibrant dark theme (amber/orange on pure black).

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## How It Works (The 3-Step FHE Reveal Flow)

Zama's fhEVM requires a secure off-chain relayer flow to decrypt state variables safely:

1. **Request Reveal (On-Chain):** The proposal creator calls `requestReveal(id)` after the voting deadline. This marks
   the encrypted tally counters as publicly decryptable (`FHE.makePubliclyDecryptable()`).
2. **Decrypt (Off-Chain):** Anyone can fetch the decryption handles and call the KMS relayer (`publicDecrypt()`)
   off-chain to get the plaintext tallies and a cryptographic proof.
3. **Finalize (On-Chain):** Anyone calls `finalizeReveal(id, yes, no, proof)`. The contract verifies the proof using
   `FHE.checkSignatures()`. If valid, the plaintext tallies are permanently saved and the proposal is marked as
   "Revealed".

## Tech Stack

- **Smart Contracts:** Solidity, Hardhat, Zama `@fhevm/solidity`
- **Frontend:** React, Vite, TypeScript, `ethers.js` (v6)
- **Styling:** Custom CSS Design System (Grid/Flexbox, CSS Variables)
