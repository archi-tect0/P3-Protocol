import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { spawn, ChildProcess } from 'child_process';
import { ethers } from 'ethers';
import hre from 'hardhat';
import path from 'path';
import { PgStorage } from '../../server/pg-storage';

export interface TestEnvironment {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  serverProcess: ChildProcess;
  hardhatProcess: ChildProcess;
  storage: PgStorage;
  contracts: {
    anchorRegistry: any;
    zkVerifier: any;
    governanceToken: any;
    governor: any;
    timelock: any;
    treasury: any;
  };
  testWallets: {
    admin: ethers.Wallet;
    user1: ethers.Wallet;
    user2: ethers.Wallet;
  };
  baseUrl: string;
}

const TEST_PORT = 5001;
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 
  `postgresql://postgres:postgres@localhost:5432/p3_test`;

/**
 * Wait for a service to be ready by polling a URL
 */
async function waitForService(url: string, maxAttempts = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch (error) {
      // Service not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error(`Service at ${url} did not become ready`);
}

/**
 * Start local Hardhat network in the background
 */
async function startHardhatNode(): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const hardhat = spawn('npx', ['hardhat', 'node'], {
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: 'test' },
    });

    hardhat.stdout?.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Started HTTP and WebSocket JSON-RPC server')) {
        resolve(hardhat);
      }
    });

    hardhat.stderr?.on('data', (data) => {
      console.error(`Hardhat stderr: ${data}`);
    });

    hardhat.on('error', reject);

    // Timeout after 30 seconds
    setTimeout(() => reject(new Error('Hardhat node failed to start')), 30000);
  });
}

/**
 * Deploy all smart contracts to local network
 */
async function deployContracts() {
  const [deployer] = await hre.ethers.getSigners();

  // Deploy ZK Verifier
  const ZKVerifier = await hre.ethers.getContractFactory('ZKReceiptsVerifier');
  const zkVerifier = await ZKVerifier.deploy();
  await zkVerifier.waitForDeployment();

  // Deploy Anchor Registry
  const AnchorRegistry = await hre.ethers.getContractFactory('AnchorRegistry');
  const anchorRegistry = await AnchorRegistry.deploy();
  await anchorRegistry.waitForDeployment();

  // Deploy Governance Token
  const GovernanceToken = await hre.ethers.getContractFactory('GovernanceToken');
  const governanceToken = await GovernanceToken.deploy();
  await governanceToken.waitForDeployment();

  // Deploy Timelock (1 day delay)
  const TimelockController = await hre.ethers.getContractFactory('TimelockController');
  const minDelay = 86400; // 1 day
  const timelock = await TimelockController.deploy(
    minDelay,
    [deployer.address], // proposers
    [deployer.address], // executors
    deployer.address    // admin
  );
  await timelock.waitForDeployment();

  // Deploy Governor
  const Governor = await hre.ethers.getContractFactory('GovernorP3');
  const governor = await Governor.deploy(
    await governanceToken.getAddress(),
    await timelock.getAddress()
  );
  await governor.waitForDeployment();

  // Deploy Treasury
  const Treasury = await hre.ethers.getContractFactory('Treasury');
  const treasury = await Treasury.deploy(deployer.address);
  await treasury.waitForDeployment();

  return {
    anchorRegistry,
    zkVerifier,
    governanceToken,
    governor,
    timelock,
    treasury,
  };
}

/**
 * Initialize test wallets with ETH
 */
async function initializeTestWallets(): Promise<{
  admin: ethers.Wallet;
  user1: ethers.Wallet;
  user2: ethers.Wallet;
}> {
  const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');

  // Create test wallets
  const admin = new ethers.Wallet(
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', // Hardhat account #0
    provider
  );

  const user1 = new ethers.Wallet(
    '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d', // Hardhat account #1
    provider
  );

  const user2 = new ethers.Wallet(
    '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a', // Hardhat account #2
    provider
  );

  return { admin, user1, user2 };
}

/**
 * Start the P3 server on test port
 */
async function startTestServer(): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const server = spawn('npx', ['tsx', 'server/index.ts'], {
      stdio: 'pipe',
      env: {
        ...process.env,
        NODE_ENV: 'test',
        PORT: TEST_PORT.toString(),
        DATABASE_URL: TEST_DATABASE_URL,
      },
    });

    server.stdout?.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Server started successfully')) {
        resolve(server);
      }
    });

    server.stderr?.on('data', (data) => {
      console.error(`Server stderr: ${data}`);
    });

    server.on('error', reject);

    // Timeout after 60 seconds
    setTimeout(() => reject(new Error('Server failed to start')), 60000);
  });
}

/**
 * Initialize database storage for tests
 */
async function initializeStorage(): Promise<PgStorage> {
  const storage = new PgStorage(TEST_DATABASE_URL);
  
  // Run migrations
  const { runMigrations } = await import('../../server/migrate');
  await runMigrations(TEST_DATABASE_URL);
  
  return storage;
}

/**
 * Set up complete test environment
 */
export async function setupTestEnvironment(): Promise<TestEnvironment> {
  console.log('🚀 Setting up E2E test environment...');

  // 1. Initialize database
  console.log('📊 Initializing database...');
  const storage = await initializeStorage();

  // 2. Start Hardhat local node
  console.log('⛓️  Starting Hardhat node...');
  const hardhatProcess = await startHardhatNode();
  await new Promise(resolve => setTimeout(resolve, 2000)); // Give it time to fully start

  // 3. Deploy contracts
  console.log('📝 Deploying contracts...');
  const contracts = await deployContracts();

  // 4. Initialize test wallets
  console.log('💰 Initializing test wallets...');
  const testWallets = await initializeTestWallets();

  // 5. Start test server
  console.log('🌐 Starting test server...');
  const serverProcess = await startTestServer();
  const baseUrl = `http://localhost:${TEST_PORT}`;
  await waitForService(`${baseUrl}/health`);

  // 6. Launch browser
  console.log('🌍 Launching browser...');
  const browser = await chromium.launch({
    headless: process.env.HEADLESS !== 'false',
  });

  const context = await browser.newContext({
    baseURL: baseUrl,
    ignoreHTTPSErrors: true,
  });

  const page = await context.newPage();

  console.log('✅ Test environment ready!\n');

  return {
    browser,
    context,
    page,
    serverProcess,
    hardhatProcess,
    storage,
    contracts,
    testWallets,
    baseUrl,
  };
}

/**
 * Tear down test environment
 */
export async function teardownTestEnvironment(env: TestEnvironment): Promise<void> {
  console.log('\n🧹 Cleaning up test environment...');

  // Close browser
  if (env.browser) {
    await env.browser.close();
  }

  // Stop server
  if (env.serverProcess) {
    env.serverProcess.kill();
  }

  // Stop Hardhat
  if (env.hardhatProcess) {
    env.hardhatProcess.kill();
  }

  // Close database connections
  if (env.storage) {
    await env.storage.close();
  }

  console.log('✅ Cleanup complete!\n');
}

/**
 * Helper: Login to the application
 */
export async function login(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto('/');
  await page.getByTestId('input-email').fill(email);
  await page.getByTestId('input-password').fill(password);
  await page.getByTestId('button-login').click();
  await page.waitForURL('/dashboard', { timeout: 10000 });
}

/**
 * Helper: Register new user
 */
export async function register(
  page: Page,
  email: string,
  password: string,
  role: 'admin' | 'viewer' = 'viewer'
): Promise<void> {
  await page.goto('/');
  await page.getByTestId('link-register').click();
  await page.getByTestId('input-email').fill(email);
  await page.getByTestId('input-password').fill(password);
  if (role === 'admin') {
    await page.getByTestId('select-role').selectOption('admin');
  }
  await page.getByTestId('button-register').click();
  await page.waitForURL('/dashboard', { timeout: 10000 });
}

/**
 * Helper: Connect wallet via MetaMask simulation
 */
export async function connectWallet(
  page: Page,
  wallet: ethers.Wallet
): Promise<void> {
  // Inject Web3 provider into page
  await page.addInitScript((walletAddress: string) => {
    (window as any).ethereum = {
      isMetaMask: true,
      request: async ({ method, params }: any) => {
        if (method === 'eth_requestAccounts') {
          return [walletAddress];
        }
        if (method === 'eth_accounts') {
          return [walletAddress];
        }
        if (method === 'personal_sign') {
          // Simulate signing
          return '0x' + '0'.repeat(130); // Mock signature
        }
        return null;
      },
      on: () => {},
      removeListener: () => {},
    };
  }, wallet.address);
}

/**
 * Helper: Wait for transaction confirmation
 */
export async function waitForTx(
  page: Page,
  txHash: string,
  timeout = 30000
): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const status = await page.evaluate(async (hash) => {
      const response = await fetch(`/api/transactions/${hash}`);
      if (response.ok) {
        const data = await response.json();
        return data.status;
      }
      return null;
    }, txHash);

    if (status === 'confirmed') {
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  throw new Error(`Transaction ${txHash} not confirmed within ${timeout}ms`);
}

/**
 * Helper: Generate ZK proof (mocked for testing)
 */
export async function generateMockZKProof(data: any): Promise<any> {
  // In real implementation, this would call the ZK prover
  // For E2E tests, we return a mock proof structure
  return {
    proof: {
      pi_a: ['0x' + '1'.repeat(64), '0x' + '2'.repeat(64)],
      pi_b: [
        ['0x' + '3'.repeat(64), '0x' + '4'.repeat(64)],
        ['0x' + '5'.repeat(64), '0x' + '6'.repeat(64)],
      ],
      pi_c: ['0x' + '7'.repeat(64), '0x' + '8'.repeat(64)],
    },
    publicSignals: [data.contentHash, data.timestamp],
  };
}
