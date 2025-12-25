import { expect } from "chai";
import hre from "hardhat";
import type { ConsentRegistry } from "../typechain-types";
import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("ConsentRegistry", function () {
  let consentRegistry: ConsentRegistry;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;

  beforeEach(async function () {
    [owner, user1] = await hre.ethers.getSigners();
    const ConsentRegistry = await hre.ethers.getContractFactory("ConsentRegistry");
    consentRegistry = await ConsentRegistry.deploy();
    await consentRegistry.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await consentRegistry.owner()).to.equal(owner.address);
    });
  });

  describe("Consent Management", function () {
    it("Should grant consent successfully", async function () {
      const purposeHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("data processing"));
      const futureTime = (await time.latest()) + 86400; // 1 day from now
      const metadata = "Allow data processing";

      await expect(
        consentRegistry.grantConsent(purposeHash, futureTime, metadata)
      ).to.emit(consentRegistry, "ConsentGranted");
    });

    it("Should store consent details correctly", async function () {
      const purposeHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("data processing"));
      const futureTime = (await time.latest()) + 86400;
      const metadata = "Allow data processing";

      await consentRegistry.grantConsent(purposeHash, futureTime, metadata);

      const consent = await consentRegistry.getConsent(owner.address, purposeHash);
      expect(consent.granted).to.equal(true);
      expect(consent.purposeHash).to.equal(purposeHash);
      expect(consent.metadata).to.equal(metadata);
    });

    it("Should fail to grant consent with past expiration", async function () {
      const purposeHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("data processing"));
      const pastTime = (await time.latest()) - 86400;

      await expect(
        consentRegistry.grantConsent(purposeHash, pastTime, "metadata")
      ).to.be.revertedWith("Expiration must be in future");
    });

    it("Should revoke consent successfully", async function () {
      const purposeHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("data processing"));
      const futureTime = (await time.latest()) + 86400;

      await consentRegistry.grantConsent(purposeHash, futureTime, "metadata");
      
      await expect(
        consentRegistry.revokeConsent(purposeHash)
      ).to.emit(consentRegistry, "ConsentRevoked");

      const consent = await consentRegistry.getConsent(owner.address, purposeHash);
      expect(consent.granted).to.equal(false);
    });

    it("Should check valid consent correctly", async function () {
      const purposeHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("data processing"));
      const futureTime = (await time.latest()) + 86400;

      await consentRegistry.grantConsent(purposeHash, futureTime, "metadata");
      
      expect(
        await consentRegistry.hasValidConsent(owner.address, purposeHash)
      ).to.equal(true);
    });

    it("Should return false for expired consent", async function () {
      const purposeHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("data processing"));
      const shortExpiry = (await time.latest()) + 10; // 10 seconds

      await consentRegistry.grantConsent(purposeHash, shortExpiry, "metadata");
      
      // Move time forward past expiration
      await time.increase(20);

      expect(
        await consentRegistry.hasValidConsent(owner.address, purposeHash)
      ).to.equal(false);
    });

    it("Should update consent expiration", async function () {
      const purposeHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("data processing"));
      const futureTime1 = (await time.latest()) + 86400;
      const futureTime2 = (await time.latest()) + 172800;

      await consentRegistry.grantConsent(purposeHash, futureTime1, "metadata");
      
      await expect(
        consentRegistry.updateConsentExpiration(purposeHash, futureTime2)
      ).to.emit(consentRegistry, "ConsentUpdated");
    });
  });
});
