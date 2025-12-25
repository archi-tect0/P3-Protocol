import hre from "hardhat";

async function main() {
  const ethers = hre.ethers;
  const [deployer] = await ethers.getSigners();

  console.log("Deploying P3 Protocol contracts with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // 1. Deploy ConsentRegistry (needed by TrustPolicyRouter)
  console.log("\n1. Deploying ConsentRegistry...");
  const ConsentRegistry = await ethers.getContractFactory("ConsentRegistry");
  const consentRegistry = await ConsentRegistry.deploy();
  await consentRegistry.waitForDeployment();
  const consentRegistryAddress = await consentRegistry.getAddress();
  console.log("ConsentRegistry deployed to:", consentRegistryAddress);

  // 2. Deploy AnchorRegistry
  console.log("\n2. Deploying AnchorRegistry...");
  const AnchorRegistry = await ethers.getContractFactory("AnchorRegistry");
  const anchorRegistry = await AnchorRegistry.deploy();
  await anchorRegistry.waitForDeployment();
  const anchorRegistryAddress = await anchorRegistry.getAddress();
  console.log("AnchorRegistry deployed to:", anchorRegistryAddress);

  // 3. Deploy ReceiptBoundToken
  console.log("\n3. Deploying ReceiptBoundToken...");
  const ReceiptBoundToken = await ethers.getContractFactory("ReceiptBoundToken");
  const receiptBoundToken = await ReceiptBoundToken.deploy();
  await receiptBoundToken.waitForDeployment();
  const receiptBoundTokenAddress = await receiptBoundToken.getAddress();
  console.log("ReceiptBoundToken deployed to:", receiptBoundTokenAddress);

  // 4. Deploy GovernanceToken
  console.log("\n4. Deploying GovernanceToken...");
  const GovernanceToken = await ethers.getContractFactory("GovernanceToken");
  const governanceToken = await GovernanceToken.deploy();
  await governanceToken.waitForDeployment();
  const governanceTokenAddress = await governanceToken.getAddress();
  console.log("GovernanceToken deployed to:", governanceTokenAddress);

  // 5. Deploy TimelockController (needed by Governor)
  console.log("\n5. Deploying TimelockController...");
  const minDelay = 86400; // 1 day in seconds
  const proposers: string[] = []; // Will be set to Governor after deployment
  const executors: string[] = []; // Will be set to Governor after deployment
  const admin = deployer.address; // Deployer is initial admin
  
  const TimelockController = await ethers.getContractFactory("TimelockController");
  const timelock = await TimelockController.deploy(minDelay, proposers, executors, admin);
  await timelock.waitForDeployment();
  const timelockAddress = await timelock.getAddress();
  console.log("TimelockController deployed to:", timelockAddress);

  // 6. Deploy GovernorP3
  console.log("\n6. Deploying GovernorP3...");
  const GovernorP3 = await ethers.getContractFactory("GovernorP3");
  const governor = await GovernorP3.deploy(governanceTokenAddress, timelockAddress);
  await governor.waitForDeployment();
  const governorAddress = await governor.getAddress();
  console.log("GovernorP3 deployed to:", governorAddress);

  // 7. Configure Timelock roles
  console.log("\n7. Configuring Timelock roles...");
  const PROPOSER_ROLE = await timelock.PROPOSER_ROLE();
  const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE();
  const TIMELOCK_ADMIN_ROLE = await timelock.DEFAULT_ADMIN_ROLE();

  // Grant proposer and executor roles to the Governor
  await timelock.grantRole(PROPOSER_ROLE, governorAddress);
  console.log("Granted PROPOSER_ROLE to Governor");
  
  await timelock.grantRole(EXECUTOR_ROLE, governorAddress);
  console.log("Granted EXECUTOR_ROLE to Governor");

  // Optional: Revoke admin role from deployer to fully decentralize
  // Uncomment the following line to revoke admin role:
  // await timelock.revokeRole(TIMELOCK_ADMIN_ROLE, deployer.address);
  console.log("Timelock admin role retained by deployer for now");

  // 8. Deploy Treasury
  console.log("\n8. Deploying Treasury...");
  const Treasury = await ethers.getContractFactory("Treasury");
  const treasury = await Treasury.deploy();
  await treasury.waitForDeployment();
  const treasuryAddress = await treasury.getAddress();
  console.log("Treasury deployed to:", treasuryAddress);

  // 9. Deploy TrustPolicyRouter
  console.log("\n9. Deploying TrustPolicyRouter...");
  const TrustPolicyRouter = await ethers.getContractFactory("TrustPolicyRouter");
  const trustPolicyRouter = await TrustPolicyRouter.deploy(consentRegistryAddress);
  await trustPolicyRouter.waitForDeployment();
  const trustPolicyRouterAddress = await trustPolicyRouter.getAddress();
  console.log("TrustPolicyRouter deployed to:", trustPolicyRouterAddress);

  // 10. Deploy ZKReceiptsVerifier
  console.log("\n10. Deploying ZKReceiptsVerifier...");
  const ZKReceiptsVerifier = await ethers.getContractFactory("ZKReceiptsVerifier");
  const zkReceiptsVerifier = await ZKReceiptsVerifier.deploy();
  await zkReceiptsVerifier.waitForDeployment();
  const zkReceiptsVerifierAddress = await zkReceiptsVerifier.getAddress();
  console.log("ZKReceiptsVerifier deployed to:", zkReceiptsVerifierAddress);

  // Summary
  console.log("\n=== Deployment Summary ===");
  console.log("ConsentRegistry:       ", consentRegistryAddress);
  console.log("AnchorRegistry:        ", anchorRegistryAddress);
  console.log("ReceiptBoundToken:     ", receiptBoundTokenAddress);
  console.log("GovernanceToken:       ", governanceTokenAddress);
  console.log("TimelockController:    ", timelockAddress);
  console.log("GovernorP3:            ", governorAddress);
  console.log("Treasury:              ", treasuryAddress);
  console.log("TrustPolicyRouter:     ", trustPolicyRouterAddress);
  console.log("ZKReceiptsVerifier:    ", zkReceiptsVerifierAddress);

  // Save deployment addresses to a file
  const fs = require("fs");
  const deploymentInfo = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      ConsentRegistry: consentRegistryAddress,
      AnchorRegistry: anchorRegistryAddress,
      ReceiptBoundToken: receiptBoundTokenAddress,
      GovernanceToken: governanceTokenAddress,
      TimelockController: timelockAddress,
      GovernorP3: governorAddress,
      Treasury: treasuryAddress,
      TrustPolicyRouter: trustPolicyRouterAddress,
      ZKReceiptsVerifier: zkReceiptsVerifierAddress,
    },
  };

  fs.writeFileSync(
    `deployment-${Date.now()}.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("\nDeployment info saved to deployment-{timestamp}.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
