import { expect } from "chai";
import hre from "hardhat";
import type { GovernanceToken } from "../typechain-types";
import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("GovernanceToken", function () {
  let governanceToken: GovernanceToken;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;

  beforeEach(async function () {
    [owner, user1] = await hre.ethers.getSigners();
    const GovernanceToken = await hre.ethers.getContractFactory("GovernanceToken");
    governanceToken = await GovernanceToken.deploy();
    await governanceToken.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await governanceToken.owner()).to.equal(owner.address);
    });

    it("Should have correct name and symbol", async function () {
      expect(await governanceToken.name()).to.equal("P3 Governance Token");
      expect(await governanceToken.symbol()).to.equal("P3GOV");
    });

    it("Should mint initial supply to deployer", async function () {
      const expectedSupply = hre.ethers.parseEther("100000000"); // 100 million
      expect(await governanceToken.balanceOf(owner.address)).to.equal(expectedSupply);
    });
  });

  describe("Minting", function () {
    it("Should allow owner to mint tokens", async function () {
      const mintAmount = hre.ethers.parseEther("1000");
      await governanceToken.mint(user1.address, mintAmount);
      
      expect(await governanceToken.balanceOf(user1.address)).to.equal(mintAmount);
    });

    it("Should fail if minting exceeds max supply", async function () {
      const excessAmount = hre.ethers.parseEther("900000001"); // Exceeds remaining supply
      await expect(
        governanceToken.mint(user1.address, excessAmount)
      ).to.be.revertedWith("Exceeds max supply");
    });

    it("Should only allow owner to mint", async function () {
      const mintAmount = hre.ethers.parseEther("1000");
      await expect(
        governanceToken.connect(user1).mint(user1.address, mintAmount)
      ).to.be.reverted;
    });
  });

  describe("Burning", function () {
    it("Should allow users to burn their tokens", async function () {
      const burnAmount = hre.ethers.parseEther("1000");
      const initialBalance = await governanceToken.balanceOf(owner.address);
      
      await governanceToken.burn(burnAmount);
      
      expect(await governanceToken.balanceOf(owner.address)).to.equal(
        initialBalance - burnAmount
      );
    });
  });

  describe("Voting functionality", function () {
    it("Should track voting power after delegation", async function () {
      await governanceToken.delegate(owner.address);
      
      const votes = await governanceToken.getVotes(owner.address);
      expect(votes).to.equal(await governanceToken.balanceOf(owner.address));
    });

    it("Should update votes after transfer and delegation", async function () {
      const transferAmount = hre.ethers.parseEther("1000");
      
      await governanceToken.transfer(user1.address, transferAmount);
      await governanceToken.connect(user1).delegate(user1.address);
      
      expect(await governanceToken.getVotes(user1.address)).to.equal(transferAmount);
    });
  });
});
