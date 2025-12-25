import { expect } from "chai";
import hre from "hardhat";
import type { AnchorRegistry } from "../typechain-types";
import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("AnchorRegistry", function () {
  let anchorRegistry: AnchorRegistry;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;

  beforeEach(async function () {
    [owner, user1] = await hre.ethers.getSigners();
    const AnchorRegistry = await hre.ethers.getContractFactory("AnchorRegistry");
    anchorRegistry = await AnchorRegistry.deploy();
    await anchorRegistry.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await anchorRegistry.owner()).to.equal(owner.address);
    });

    it("Should initialize with zero anchors and bundles", async function () {
      expect(await anchorRegistry.totalAnchors()).to.equal(0);
      expect(await anchorRegistry.totalBundles()).to.equal(0);
    });
  });

  describe("Event Anchoring", function () {
    it("Should anchor an event successfully", async function () {
      const eventHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test event"));
      const metadata = "Test metadata";

      const tx = await anchorRegistry.anchorEvent(eventHash, metadata);
      await expect(tx).to.emit(anchorRegistry, "EventAnchored");

      expect(await anchorRegistry.totalAnchors()).to.equal(1);
    });

    it("Should store anchor details correctly", async function () {
      const eventHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test event"));
      const metadata = "Test metadata";

      const tx = await anchorRegistry.anchorEvent(eventHash, metadata);
      const receipt = await tx.wait();
      const event = receipt?.logs.find((log: any) => {
        try {
          return anchorRegistry.interface.parseLog(log)?.name === "EventAnchored";
        } catch {
          return false;
        }
      });
      const parsedEvent = anchorRegistry.interface.parseLog(event!);
      const anchorId = parsedEvent?.args[0];

      const anchor = await anchorRegistry.getAnchor(anchorId);
      expect(anchor.eventHash).to.equal(eventHash);
      expect(anchor.submitter).to.equal(owner.address);
      expect(anchor.metadata).to.equal(metadata);
      expect(anchor.isBundled).to.equal(false);
    });

    it("Should verify anchor exists", async function () {
      const eventHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test event"));
      const tx = await anchorRegistry.anchorEvent(eventHash, "metadata");
      const receipt = await tx.wait();
      const event = receipt?.logs.find((log: any) => {
        try {
          return anchorRegistry.interface.parseLog(log)?.name === "EventAnchored";
        } catch {
          return false;
        }
      });
      const parsedEvent = anchorRegistry.interface.parseLog(event!);
      const anchorId = parsedEvent?.args[0];

      expect(await anchorRegistry.verifyAnchor(anchorId)).to.equal(true);
    });
  });

  describe("Bundle Anchoring", function () {
    it("Should anchor a bundle successfully", async function () {
      const merkleRoot = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("merkle root"));
      const eventCount = 10;
      const metadata = "Bundle metadata";

      const tx = await anchorRegistry.anchorBundle(merkleRoot, eventCount, metadata);
      await expect(tx).to.emit(anchorRegistry, "BundleAnchored");

      expect(await anchorRegistry.totalBundles()).to.equal(1);
    });

    it("Should store bundle details correctly", async function () {
      const merkleRoot = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("merkle root"));
      const eventCount = 10;
      const metadata = "Bundle metadata";

      const tx = await anchorRegistry.anchorBundle(merkleRoot, eventCount, metadata);
      const receipt = await tx.wait();
      const event = receipt?.logs.find((log: any) => {
        try {
          return anchorRegistry.interface.parseLog(log)?.name === "BundleAnchored";
        } catch {
          return false;
        }
      });
      const parsedEvent = anchorRegistry.interface.parseLog(event!);
      const bundleId = parsedEvent?.args[0];

      const bundle = await anchorRegistry.getBundle(bundleId);
      expect(bundle.merkleRoot).to.equal(merkleRoot);
      expect(bundle.eventCount).to.equal(eventCount);
      expect(bundle.submitter).to.equal(owner.address);
      expect(bundle.metadata).to.equal(metadata);
    });

    it("Should fail to anchor bundle with zero event count", async function () {
      const merkleRoot = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("merkle root"));
      await expect(
        anchorRegistry.anchorBundle(merkleRoot, 0, "metadata")
      ).to.be.revertedWith("Event count must be positive");
    });

    it("Should verify bundle exists", async function () {
      const merkleRoot = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("merkle root"));
      const tx = await anchorRegistry.anchorBundle(merkleRoot, 5, "metadata");
      const receipt = await tx.wait();
      const event = receipt?.logs.find((log: any) => {
        try {
          return anchorRegistry.interface.parseLog(log)?.name === "BundleAnchored";
        } catch {
          return false;
        }
      });
      const parsedEvent = anchorRegistry.interface.parseLog(event!);
      const bundleId = parsedEvent?.args[0];

      expect(await anchorRegistry.verifyBundle(bundleId)).to.equal(true);
    });
  });
});
