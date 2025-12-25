import { expect } from "chai";
import hre from "hardhat";
import type { ZKReceiptsVerifier } from "../typechain-types";
import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("ZKReceiptsVerifier", function () {
  let zkVerifier: ZKReceiptsVerifier;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;

  beforeEach(async function () {
    [owner, user1] = await hre.ethers.getSigners();
    const ZKReceiptsVerifier = await hre.ethers.getContractFactory("ZKReceiptsVerifier");
    zkVerifier = await ZKReceiptsVerifier.deploy();
    await zkVerifier.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await zkVerifier.owner()).to.equal(owner.address);
    });

    it("Should initialize with zero proofs", async function () {
      const stats = await zkVerifier.getStats();
      expect(stats.total).to.equal(0);
      expect(stats.verified).to.equal(0);
    });
  });

  describe("Proof Submission", function () {
    it("Should submit proof successfully", async function () {
      const proofData = hre.ethers.toUtf8Bytes("test proof data with non-zero first byte");
      const publicInputs = [
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("input1")),
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("input2"))
      ];

      await expect(
        zkVerifier.submitProof(proofData, publicInputs)
      ).to.emit(zkVerifier, "ProofSubmitted");

      const stats = await zkVerifier.getStats();
      expect(stats.total).to.equal(1);
    });

    it("Should fail to submit duplicate proof", async function () {
      const proofData = hre.ethers.toUtf8Bytes("test proof data");
      const publicInputs = [hre.ethers.keccak256(hre.ethers.toUtf8Bytes("input1"))];

      const tx = await zkVerifier.submitProof(proofData, publicInputs);
      const receipt = await tx.wait();
      
      await expect(
        zkVerifier.submitProof(proofData, publicInputs)
      ).to.be.revertedWith("Proof already submitted");
    });
  });

  describe("Proof Verification", function () {
    it("Should verify valid proof successfully", async function () {
      // Use non-zero first byte for valid stub proof
      const proofData = hre.ethers.toUtf8Bytes("valid proof data");
      const publicInputs = [hre.ethers.keccak256(hre.ethers.toUtf8Bytes("input1"))];

      const tx = await zkVerifier.submitProof(proofData, publicInputs);
      const receipt = await tx.wait();
      const event = receipt?.logs.find((log: any) => {
        try {
          return zkVerifier.interface.parseLog(log)?.name === "ProofSubmitted";
        } catch {
          return false;
        }
      });
      const parsedEvent = zkVerifier.interface.parseLog(event!);
      const proofId = parsedEvent?.args[0];

      const result = await zkVerifier.verifyProof(proofId, proofData, publicInputs);
      expect(result).to.equal(true);

      expect(await zkVerifier.isProofVerified(proofId)).to.equal(true);
      
      const stats = await zkVerifier.getStats();
      expect(stats.verified).to.equal(1);
    });

    it("Should fail verification with mismatched proof data", async function () {
      const proofData = hre.ethers.toUtf8Bytes("test proof");
      const publicInputs = [hre.ethers.keccak256(hre.ethers.toUtf8Bytes("input1"))];

      const tx = await zkVerifier.submitProof(proofData, publicInputs);
      const receipt = await tx.wait();
      const event = receipt?.logs.find((log: any) => {
        try {
          return zkVerifier.interface.parseLog(log)?.name === "ProofSubmitted";
        } catch {
          return false;
        }
      });
      const parsedEvent = zkVerifier.interface.parseLog(event!);
      const proofId = parsedEvent?.args[0];

      const wrongProofData = hre.ethers.toUtf8Bytes("wrong proof");

      await expect(
        zkVerifier.verifyProof(proofId, wrongProofData, publicInputs)
      ).to.be.revertedWith("Proof data mismatch");
    });

    it("Should fail to verify already verified proof", async function () {
      const proofData = hre.ethers.toUtf8Bytes("test proof");
      const publicInputs = [hre.ethers.keccak256(hre.ethers.toUtf8Bytes("input1"))];

      const tx = await zkVerifier.submitProof(proofData, publicInputs);
      const receipt = await tx.wait();
      const event = receipt?.logs.find((log: any) => {
        try {
          return zkVerifier.interface.parseLog(log)?.name === "ProofSubmitted";
        } catch {
          return false;
        }
      });
      const parsedEvent = zkVerifier.interface.parseLog(event!);
      const proofId = parsedEvent?.args[0];

      await zkVerifier.verifyProof(proofId, proofData, publicInputs);

      await expect(
        zkVerifier.verifyProof(proofId, proofData, publicInputs)
      ).to.be.revertedWith("Proof already verified");
    });

    it("Should get proof details", async function () {
      const proofData = hre.ethers.toUtf8Bytes("test proof");
      const publicInputs = [hre.ethers.keccak256(hre.ethers.toUtf8Bytes("input1"))];

      const tx = await zkVerifier.submitProof(proofData, publicInputs);
      const receipt = await tx.wait();
      const event = receipt?.logs.find((log: any) => {
        try {
          return zkVerifier.interface.parseLog(log)?.name === "ProofSubmitted";
        } catch {
          return false;
        }
      });
      const parsedEvent = zkVerifier.interface.parseLog(event!);
      const proofId = parsedEvent?.args[0];

      const proof = await zkVerifier.getProof(proofId);
      expect(proof.submitter).to.equal(owner.address);
      expect(proof.verified).to.equal(false);
    });
  });
});
