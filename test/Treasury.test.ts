import { expect } from "chai";
import hre from "hardhat";
import type { Treasury } from "../typechain-types";
import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Treasury", function () {
  let treasury: Treasury;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;

  beforeEach(async function () {
    [owner, user1] = await hre.ethers.getSigners();
    const Treasury = await hre.ethers.getContractFactory("Treasury");
    treasury = await Treasury.deploy();
    await treasury.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await treasury.owner()).to.equal(owner.address);
    });
  });

  describe("Deposits", function () {
    it("Should accept ETH deposits", async function () {
      const depositAmount = hre.ethers.parseEther("1.0");
      
      await expect(
        owner.sendTransaction({
          to: await treasury.getAddress(),
          value: depositAmount
        })
      ).to.emit(treasury, "Deposit");

      expect(await treasury.getBalance()).to.equal(depositAmount);
    });
  });

  describe("Proposals", function () {
    it("Should create withdrawal proposal", async function () {
      const amount = hre.ethers.parseEther("0.5");
      
      await expect(
        treasury.createProposal(
          user1.address,
          amount,
          hre.ethers.ZeroAddress, // ETH
          "Test proposal"
        )
      ).to.emit(treasury, "ProposalCreated");

      expect(await treasury.proposalCount()).to.equal(1);
    });

    it("Should store proposal details correctly", async function () {
      const amount = hre.ethers.parseEther("0.5");
      const description = "Test proposal";
      
      await treasury.createProposal(
        user1.address,
        amount,
        hre.ethers.ZeroAddress,
        description
      );

      const proposal = await treasury.getProposal(1);
      expect(proposal.recipient).to.equal(user1.address);
      expect(proposal.amount).to.equal(amount);
      expect(proposal.description).to.equal(description);
      expect(proposal.executed).to.equal(false);
    });

    it("Should only allow owner to create proposals", async function () {
      const amount = hre.ethers.parseEther("0.5");
      
      await expect(
        treasury.connect(user1).createProposal(
          user1.address,
          amount,
          hre.ethers.ZeroAddress,
          "Test"
        )
      ).to.be.reverted;
    });
  });

  describe("Withdrawals", function () {
    it("Should execute ETH withdrawal proposal", async function () {
      // Deposit ETH first
      const depositAmount = hre.ethers.parseEther("1.0");
      await owner.sendTransaction({
        to: await treasury.getAddress(),
        value: depositAmount
      });

      // Create proposal
      const withdrawAmount = hre.ethers.parseEther("0.5");
      await treasury.createProposal(
        user1.address,
        withdrawAmount,
        hre.ethers.ZeroAddress,
        "Withdrawal"
      );

      // Execute proposal
      const initialBalance = await hre.ethers.provider.getBalance(user1.address);
      await treasury.executeProposal(1);
      const finalBalance = await hre.ethers.provider.getBalance(user1.address);

      expect(finalBalance - initialBalance).to.equal(withdrawAmount);
    });

    it("Should fail to execute already executed proposal", async function () {
      const depositAmount = hre.ethers.parseEther("1.0");
      await owner.sendTransaction({
        to: await treasury.getAddress(),
        value: depositAmount
      });

      await treasury.createProposal(
        user1.address,
        hre.ethers.parseEther("0.5"),
        hre.ethers.ZeroAddress,
        "Withdrawal"
      );

      await treasury.executeProposal(1);
      
      await expect(
        treasury.executeProposal(1)
      ).to.be.revertedWith("Proposal already executed");
    });

    it("Should only allow owner to execute proposals", async function () {
      await treasury.createProposal(
        user1.address,
        hre.ethers.parseEther("0.5"),
        hre.ethers.ZeroAddress,
        "Test"
      );

      await expect(
        treasury.connect(user1).executeProposal(1)
      ).to.be.reverted;
    });
  });
});
