import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

task("task:create-proposal", "Creates a new DAOnance proposal")
  .addParam("title", "Title of the proposal")
  .addParam("description", "Description of the proposal")
  .addOptionalParam("duration", "Voting duration in seconds", "3600")
  .addOptionalParam("votelimit", "Maximum number of votes", "100")
  .addOptionalParam("address", "Optionally specify the DAOnance contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const DAOnanceDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("DAOnance");

    console.log(`DAOnance: ${DAOnanceDeployment.address}`);

    const daonanceContract = await ethers.getContractAt("DAOnance", DAOnanceDeployment.address);

    const tx = await daonanceContract.createProposal(
      taskArguments.title,
      taskArguments.description,
      parseInt(taskArguments.duration),
      parseInt(taskArguments.votelimit),
    );

    const receipt = await tx.wait();
    console.log(`Proposal created! Tx hash: ${receipt?.hash}`);

    const proposalCount = await daonanceContract.proposalCount();
    console.log(`Total proposals: ${proposalCount}`);
  });
