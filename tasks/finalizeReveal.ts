import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

task("task:finalize-reveal", "Trigger the Zama KMS Gateway to fulfill the decryption callback")
  .addParam("proposal", "The ID of the proposal to finalize")
  .addOptionalParam("address", "The DAOnance contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;
    await fhevm.initializeCLIApi();

    const DAOnanceDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("DAOnance");

    console.log(`Connecting to DAOnance: ${DAOnanceDeployment.address}`);
    
    const signers = await ethers.getSigners();
    const signer = signers[0];
    const contract = await ethers.getContractAt("DAOnance", DAOnanceDeployment.address, signer);

    console.log("Mocking Zama KMS Oracle response for the local Hardhat/Sepolia node...");
    
    // In the latest @fhevm/hardhat-plugin, if auto-mining is enabled, requests 
    // are automatically fulfilled. If we just advance time and mine heavily,
    // the plugin's hooks will intercept the event and fulfill it.
    
    try {
        console.log(`Force fulfilling the async decryption event for proposal ${taskArguments.proposal}...`);
        console.log("Note: On true Mainnet, the Zama Relayer nodes do this automatically within 10 blocks.");
        
        // Wait for the mock gateway to parse the RequestReveal event.
        // We simulate the passage of time/blocks to trigger the relayer callback.
        for (let i = 0; i < 5; i++) {
             await ethers.provider.send("evm_mine", []);
        }
        
        // Let's verify if the proposal is actually revealed now
        const p = await contract.getProposal(taskArguments.proposal);
        if (p.revealed) {
            console.log(`✓ Oracle successfully injected the decryption proof! The proposal is legally finalized on-chain.`);
            console.log(`Final Result - YES: ${p.revealedYesCount}, NO: ${p.revealedNoCount}`);
        } else {
             console.log("Warning: The local mock relayer did not instantly fulfill the reveal. Make sure your local node is running with the FHE plugin active.");
        }
    } catch (e) {
        throw new Error(`KMS Gateway failed to finalize: ${e instanceof Error ? e.message : String(e)}`);
    }
  });
