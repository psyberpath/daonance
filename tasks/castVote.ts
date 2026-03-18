import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

task("task:cast-vote", "Cast an encrypted vote on a DAOnance proposal")
  .addParam("proposal", "The ID of the proposal")
  .addParam("vote", "1 for Yes, 0 for No")
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

    const voteVal = parseInt(taskArguments.vote);
    console.log(`Encrypting vote: ${voteVal === 1 ? 'YES' : 'NO'} using FHE...`);
    const encryptedVote = await fhevm.createEncryptedInput(DAOnanceDeployment.address, signer.address)
      .add32(voteVal)
      .encrypt();

    console.log("Submitting encrypted vote to Sepolia...");
    const tx = await contract.castVote(parseInt(taskArguments.proposal), encryptedVote.handles[0], encryptedVote.inputProof);
    const receipt = await tx.wait();
    
    console.log(`✓ Vote successfully cast and verified on-chain! Tx: ${receipt?.hash}`);
  });
