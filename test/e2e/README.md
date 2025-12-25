# E2E Test Suite

Comprehensive end-to-end test suite for P3 Protocol covering complete user flows across messaging, meetings, payments, governance, and cross-chain operations.

## Overview

This test suite validates complete user journeys through the P3 Protocol application, including:

1. **Message Flow** - Encrypted messaging with ZK proofs and on-chain anchoring
2. **Meeting Flow** - Voice calls with WebRTC, metrics collection, and receipt generation
3. **Payment Flow** - ERC-20 transfers with ledger tracking and cross-chain relay
4. **Governance Flow** - DAO proposal lifecycle from creation to execution
5. **Cross-Chain Flow** - Multi-chain receipt anchoring and status tracking

## Prerequisites

Before running E2E tests, ensure you have:

1. **Node.js 18+** installed
2. **PostgreSQL** running locally or accessible via `TEST_DATABASE_URL`
3. **Playwright browsers** installed: `npx playwright install chromium`
4. **All dependencies** installed: `npm install`

## Test Environment Setup

The test suite automatically:

- Starts a local Hardhat node on port 8545
- Deploys all smart contracts to the local network
- Runs database migrations
- Starts the P3 server on port 5001
- Launches a Chromium browser instance

All cleanup happens automatically after tests complete.

## Running Tests

### Run All E2E Tests

```bash
npm run test:e2e
```

### Run Specific Test File

```bash
# Message flow only
npx mocha test/e2e/message-flow.test.ts --require ts-node/register --timeout 180000

# Meeting flow only
npx mocha test/e2e/meeting-flow.test.ts --require ts-node/register --timeout 180000

# Payment flow only
npx mocha test/e2e/payment-flow.test.ts --require ts-node/register --timeout 180000

# Governance flow only
npx mocha test/e2e/governance-flow.test.ts --require ts-node/register --timeout 180000

# Cross-chain flow only
npx mocha test/e2e/cross-chain-flow.test.ts --require ts-node/register --timeout 180000
```

### Run in Headed Mode (see browser)

```bash
HEADLESS=false npm run test:e2e
```

### Run in Headless Mode (CI)

```bash
HEADLESS=true npm run test:e2e
```

## Environment Variables

Configure tests using these environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `TEST_DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/p3_test` | Test database connection |
| `HEADLESS` | `true` | Run browser in headless mode |
| `BASE_URL` | `http://localhost:5001` | Base URL for the application |
| `CI` | - | Set in CI environments for optimized settings |

## Test Structure

Each test file follows this structure:

```typescript
describe('Flow Name E2E Test', function () {
  this.timeout(120000); // 2 minutes

  let env: TestEnvironment;
  let page: Page;

  before(async function () {
    env = await setupTestEnvironment();
  });

  after(async function () {
    await teardownTestEnvironment(env);
  });

  it('Complete flow description', async function () {
    // Test steps...
  });
});
```

## Helper Functions

The `setup.ts` file provides utilities:

### Environment Setup

- `setupTestEnvironment()` - Initialize complete test environment
- `teardownTestEnvironment(env)` - Clean up all resources

### User Actions

- `register(page, email, password, role)` - Register new user
- `login(page, email, password)` - Login existing user
- `connectWallet(page, wallet)` - Connect Web3 wallet

### Utilities

- `waitForTx(page, txHash)` - Wait for transaction confirmation
- `generateMockZKProof(data)` - Generate mock ZK proof for testing
- `waitForService(url)` - Wait for service to be ready

## CI/CD Integration

### GitHub Actions

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: p3_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Install Playwright browsers
        run: npx playwright install chromium
        
      - name: Run E2E tests
        env:
          TEST_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/p3_test
          HEADLESS: true
          CI: true
        run: npm run test:e2e
        
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: test-results/
```

## Test Data

### Test Wallets

The suite uses Hardhat's default test accounts:

- **Admin**: `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`
- **User 1**: `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d`
- **User 2**: `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a`

Each wallet starts with 10000 ETH on the local network.

### Test Accounts

Tests create user accounts with these credentials:

- **sender@test.com** / password123
- **recipient@test.com** / password123
- **host@test.com** / password123
- **participant@test.com** / password123
- **payer@test.com** / password123
- **admin@test.com** / password123
- **operator@test.com** / password123

## Debugging

### Enable Debug Logs

```bash
DEBUG=pw:api npm run test:e2e
```

### Keep Browser Open on Failure

```bash
PWDEBUG=1 npm run test:e2e
```

### View Test Results

After running tests, view the HTML report:

```bash
npx playwright show-report test-results/html
```

## Common Issues

### Port Already in Use

If port 5001 or 8545 is already in use:

```bash
# Kill processes on those ports
lsof -ti:5001 | xargs kill -9
lsof -ti:8545 | xargs kill -9
```

### Database Connection Failed

Ensure PostgreSQL is running:

```bash
# Start PostgreSQL
sudo systemctl start postgresql

# Or use Docker
docker run --name postgres-test -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:15
```

### Browser Launch Failed

Install Playwright browsers:

```bash
npx playwright install chromium
```

## Performance

### Test Execution Times

Typical execution times per test:

- Message Flow: ~60 seconds
- Meeting Flow: ~90 seconds
- Payment Flow: ~120 seconds
- Governance Flow: ~150 seconds
- Cross-Chain Flow: ~180 seconds

**Total Suite**: ~10 minutes

### Optimization Tips

1. **Parallel Execution**: Tests run sequentially by default due to shared resources
2. **Database Cleanup**: Each test starts with a fresh database state
3. **Browser Reuse**: Browser context is reused where possible

## Contributing

When adding new E2E tests:

1. Follow the existing test structure
2. Use descriptive test names
3. Add appropriate `data-testid` attributes to UI elements
4. Clean up resources in `after` hooks
5. Document expected behavior
6. Keep tests independent and idempotent

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Mocha Documentation](https://mochajs.org/)
- [Hardhat Network](https://hardhat.org/hardhat-network/)
- [P3 Protocol Documentation](../../README.md)
