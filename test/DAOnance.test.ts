import { DAOnance, DAOnance__factory } from "../types";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
  carol: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("DAOnance")) as DAOnance__factory;
  const contract = (await factory.deploy()) as DAOnance;
  const contractAddress = await contract.getAddress();
  return { contract, contractAddress };
}

describe("DAOnance", function () {
  let signers: Signers;
  let contract: DAOnance;
  let contractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = {
      deployer: ethSigners[0],
      alice: ethSigners[1],
      bob: ethSigners[2],
      carol: ethSigners[3],
    };
  });

  beforeEach(async () => {
    ({ contract, contractAddress } = await deployFixture());
  });

  // ─── Deployment ──────────────────────────────────────────────

  it("should be deployed", async function () {
    expect(ethers.isAddress(contractAddress)).to.eq(true);
    console.log(`DAOnance deployed at: ${contractAddress}`);
  });

  it("should start with zero proposals", async function () {
    const count = await contract.proposalCount();
    expect(count).to.eq(0);
  });

  // ─── Create Proposal ────────────────────────────────────────

  it("should create a proposal", async function () {
    const tx = await contract.connect(signers.alice).createProposal("Test Proposal", "A description", 3600, 10);
    await tx.wait();

    const count = await contract.proposalCount();
    expect(count).to.eq(1);

    const p = await contract.getProposal(0);
    expect(p.title).to.eq("Test Proposal");
    expect(p.description).to.eq("A description");
    expect(p.creator).to.eq(signers.alice.address);
    expect(p.voteLimit).to.eq(10);
    expect(p.voteCount).to.eq(0);
    expect(p.revealed).to.eq(false);
  });

  it("should reject a proposal with empty title", async function () {
    await expect(contract.connect(signers.alice).createProposal("", "desc", 3600, 10)).to.be.revertedWith(
      "DAOnance: empty title",
    );
  });

  it("should reject a proposal with zero duration", async function () {
    await expect(contract.connect(signers.alice).createProposal("title", "desc", 0, 10)).to.be.revertedWith(
      "DAOnance: zero duration",
    );
  });

  // ─── Cast Vote ──────────────────────────────────────────────

  it("should cast an encrypted YES vote", async function () {
    // Create proposal with long duration
    let tx = await contract.connect(signers.alice).createProposal("Vote Test", "desc", 3600, 10);
    await tx.wait();

    // Encrypt a YES vote (value = 1)
    const encryptedYes = await fhevm.createEncryptedInput(contractAddress, signers.bob.address).add32(1).encrypt();

    tx = await contract.connect(signers.bob).castVote(0, encryptedYes.handles[0], encryptedYes.inputProof);
    await tx.wait();

    // Verify vote was recorded
    const voted = await contract.hasVoted(0, signers.bob.address);
    expect(voted).to.eq(true);

    const p = await contract.getProposal(0);
    expect(p.voteCount).to.eq(1);
  });

  it("should cast an encrypted NO vote", async function () {
    let tx = await contract.connect(signers.alice).createProposal("Vote Test", "desc", 3600, 10);
    await tx.wait();

    // Encrypt a NO vote (value = 0)
    const encryptedNo = await fhevm.createEncryptedInput(contractAddress, signers.bob.address).add32(0).encrypt();

    tx = await contract.connect(signers.bob).castVote(0, encryptedNo.handles[0], encryptedNo.inputProof);
    await tx.wait();

    const voted = await contract.hasVoted(0, signers.bob.address);
    expect(voted).to.eq(true);

    const p = await contract.getProposal(0);
    expect(p.voteCount).to.eq(1);
  });

  it("should prevent double voting", async function () {
    let tx = await contract.connect(signers.alice).createProposal("Double Vote Test", "desc", 3600, 10);
    await tx.wait();

    const encryptedYes = await fhevm.createEncryptedInput(contractAddress, signers.bob.address).add32(1).encrypt();

    tx = await contract.connect(signers.bob).castVote(0, encryptedYes.handles[0], encryptedYes.inputProof);
    await tx.wait();

    // Second vote should fail
    const encryptedYes2 = await fhevm.createEncryptedInput(contractAddress, signers.bob.address).add32(1).encrypt();

    await expect(
      contract.connect(signers.bob).castVote(0, encryptedYes2.handles[0], encryptedYes2.inputProof),
    ).to.be.revertedWith("DAOnance: already voted");
  });

  // ─── Full Lifecycle: Vote + Verify Tallies ──────────────────

  it("should correctly tally encrypted votes", async function () {
    // Create proposal with reasonable deadline
    let tx = await contract.connect(signers.alice).createProposal("Tally Test", "desc", 100, 10);
    await tx.wait();

    // Bob votes YES (1)
    const encBobYes = await fhevm.createEncryptedInput(contractAddress, signers.bob.address).add32(1).encrypt();
    tx = await contract.connect(signers.bob).castVote(0, encBobYes.handles[0], encBobYes.inputProof);
    await tx.wait();

    // Carol votes NO (0)
    const encCarolNo = await fhevm.createEncryptedInput(contractAddress, signers.carol.address).add32(0).encrypt();
    tx = await contract.connect(signers.carol).castVote(0, encCarolNo.handles[0], encCarolNo.inputProof);
    await tx.wait();

    // Verify 2 votes were cast
    const p = await contract.getProposal(0);
    expect(p.voteCount).to.eq(2);

    // Fast-forward past the deadline
    await ethers.provider.send("evm_increaseTime", [101]);
    await ethers.provider.send("evm_mine", []);

    // Request reveal (creator only)
    tx = await contract.connect(signers.alice).requestReveal(0);
    await tx.wait();

    // In mock mode, use userDecryptEuint to verify the encrypted tallies
    const tallies = await contract.getEncryptedTallies(0);

    const yesCount = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      tallies.encryptedYesCount,
      contractAddress,
      signers.alice,
    );

    const noCount = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      tallies.encryptedNoCount,
      contractAddress,
      signers.alice,
    );

    // Bob voted YES, Carol voted NO → 1 yes, 1 no
    expect(yesCount).to.eq(1);
    expect(noCount).to.eq(1);
  });

  // ─── Request Reveal Guards ──────────────────────────────────

  it("should prevent reveal before deadline", async function () {
    let tx = await contract.connect(signers.alice).createProposal("Early Reveal", "desc", 3600, 10);
    await tx.wait();

    await expect(contract.connect(signers.alice).requestReveal(0)).to.be.revertedWith("DAOnance: voting still open");
  });

  it("should prevent non-creator from requesting reveal", async function () {
    let tx = await contract.connect(signers.alice).createProposal("Auth Test", "desc", 1, 10);
    await tx.wait();

    await ethers.provider.send("evm_increaseTime", [2]);
    await ethers.provider.send("evm_mine", []);

    await expect(contract.connect(signers.bob).requestReveal(0)).to.be.revertedWith(
      "DAOnance: only creator can request reveal",
    );
  });
});
