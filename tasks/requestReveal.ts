import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

task("task:request-reveal", "Request decryption of FHE tallies")
  .addParam("proposal", "The ID of the proposal")
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

    console.log(`Requesting KMS reveal for proposal ${taskArguments.proposal}...`);
    const tx = await contract.requestReveal(parseInt(taskArguments.proposal));
    const receipt = await tx.wait();
    
    console.log(`✓ Reveal requested successfully! Tallies are now publicly decryptable via KMS relayer. Tx: ${receipt?.hash}`);
  });
