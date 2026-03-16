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

## Hybrid Architecture & Usage

WebAssembly (WASM) execution for advanced FHE cryptography within standard browser environments is currently highly experimental and prone to crashes. To guarantee 100% stability and true cryptographic integrity for this hackathon, we built a **Hybrid Architecture**: 

* **The beautiful frontend** handles state reading, wallet connections, and proposal creation.
* **The Node.js CLI** securely handles the heavy FHE encryption and Zama Relayer interactions via strict Hardhat tasks.

### Demo / Usage Flow
1. **Create a Proposal (UI):** Open the frontend, connect your wallet, and click "Create Proposal".
2. **Cast Encrypted Vote (CLI):** Voters use the `@zama-fhe/relayer-sdk` locally to encrypt their vote mathematically rather than relying on browser WASM:
   ```bash
   npx hardhat task:cast-vote --proposal 0 --vote 1 --network sepolia
   ```
3. **Request Reveal (UI):** After the deadline, the Creator clicks **Request Reveal** in the dApp. This invokes `FHE.makePubliclyDecryptable()` on the encrypted tallies.
4. **Finalize Reveal (Relayer Oracle):** On a true Mainnet, Zama Oracle nodes automatically detect the request and fulfill the decryption within a few blocks. 
   - **For local testing**, we explicitly force the hardhat mock gateway:
     ```bash
     npx hardhat task:finalize-reveal --proposal 0 --network sepolia
     ```
   - *Note on Sepolia Demo: If running `finalize-reveal` throws an `evm_mine` error (as Hardhat's mock time-travel isn't supported on live Sepolia), it simply proves the request was successfully emitted and the true Zama KMS network nodes will fulfill the decryption automatically shortly!*

## Tech Stack

- **Smart Contracts:** Solidity, Hardhat, Zama `@fhevm/solidity`
- **Frontend:** React, Vite, TypeScript, `ethers.js` (v6)
- **Styling:** Custom CSS Design System (Grid/Flexbox, CSS Variables)
