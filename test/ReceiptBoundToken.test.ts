import { expect } from "chai";
import hre from "hardhat";
import type { ReceiptBoundToken } from "../typechain-types";
import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("ReceiptBoundToken", function () {
  let receiptBoundToken: ReceiptBoundToken;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  beforeEach(async function () {
    [owner, user1, user2] = await hre.ethers.getSigners();
    const ReceiptBoundToken = await hre.ethers.getContractFactory("ReceiptBoundToken");
    receiptBoundToken = await ReceiptBoundToken.deploy();
    await receiptBoundToken.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await receiptBoundToken.owner()).to.equal(owner.address);
    });

    it("Should have correct name and symbol", async function () {
      expect(await receiptBoundToken.name()).to.equal("P3 Receipt");
      expect(await receiptBoundToken.symbol()).to.equal("P3RCP");
    });
  });

  describe("Receipt Issuance", function () {
    it("Should issue receipt successfully", async function () {
      const eventHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test event"));
      const metadata = "Receipt metadata";

      await expect(
        receiptBoundToken.issueReceipt(user1.address, eventHash, metadata)
      ).to.emit(receiptBoundToken, "ReceiptIssued");
    });

    it("Should store receipt details correctly", async function () {
      const eventHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test event"));
      const metadata = "Receipt metadata";

      const tx = await receiptBoundToken.issueReceipt(user1.address, eventHash, metadata);
      const receipt = await tx.wait();
      
      const event = receipt?.logs.find((log: any) => {
        try {
          return receiptBoundToken.interface.parseLog(log)?.name === "ReceiptIssued";
        } catch {
          return false;
        }
      });
      const parsedEvent = receiptBoundToken.interface.parseLog(event!);
      const tokenId = parsedEvent?.args[0];

      const receiptData = await receiptBoundToken.getReceipt(tokenId);
      expect(receiptData.eventHash).to.equal(eventHash);
      expect(receiptData.issuer).to.equal(owner.address);
      expect(receiptData.metadata).to.equal(metadata);
    });

    it("Should fail to issue duplicate receipt for same event", async function () {
      const eventHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test event"));

      await receiptBoundToken.issueReceipt(user1.address, eventHash, "metadata");
      
      await expect(
        receiptBoundToken.issueReceipt(user2.address, eventHash, "metadata")
      ).to.be.revertedWith("Receipt already issued for this event");
    });

    it("Should only allow owner to issue receipts", async function () {
      const eventHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test event"));

      await expect(
        receiptBoundToken.connect(user1).issueReceipt(user2.address, eventHash, "metadata")
      ).to.be.reverted;
    });
  });

  describe("Non-transferability", function () {
    it("Should prevent transfers between users", async function () {
      const eventHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test event"));
      const tx = await receiptBoundToken.issueReceipt(user1.address, eventHash, "metadata");
      const receipt = await tx.wait();
      
      const event = receipt?.logs.find((log: any) => {
        try {
          return receiptBoundToken.interface.parseLog(log)?.name === "ReceiptIssued";
        } catch {
          return false;
        }
      });
      const parsedEvent = receiptBoundToken.interface.parseLog(event!);
      const tokenId = parsedEvent?.args[0];

      await expect(
        receiptBoundToken.connect(user1).transferFrom(user1.address, user2.address, tokenId)
      ).to.be.revertedWith("Receipt tokens are non-transferable");
    });

    it("Should verify receipt exists", async function () {
      const eventHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test event"));
      await receiptBoundToken.issueReceipt(user1.address, eventHash, "metadata");

      expect(await receiptBoundToken.receiptExists(eventHash)).to.equal(true);
    });

    it("Should get token ID by event hash", async function () {
      const eventHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test event"));
      const tx = await receiptBoundToken.issueReceipt(user1.address, eventHash, "metadata");
      const receipt = await tx.wait();
      
      const event = receipt?.logs.find((log: any) => {
        try {
          return receiptBoundToken.interface.parseLog(log)?.name === "ReceiptIssued";
        } catch {
          return false;
        }
      });
      const parsedEvent = receiptBoundToken.interface.parseLog(event!);
      const tokenId = parsedEvent?.args[0];

      const retrievedTokenId = await receiptBoundToken.getTokenIdByEventHash(eventHash);
      expect(retrievedTokenId).to.equal(tokenId);
    });
  });
});
