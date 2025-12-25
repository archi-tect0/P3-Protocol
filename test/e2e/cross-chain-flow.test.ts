import { expect } from 'chai';
import { Page } from 'playwright';
import {
  setupTestEnvironment,
  teardownTestEnvironment,
  register,
  connectWallet,
  TestEnvironment,
} from './setup';

describe('Cross-Chain Flow E2E Test', function () {
  this.timeout(180000); // 3 minutes for cross-chain operations

  let env: TestEnvironment;
  let operatorPage: Page;
  let receiptId: string;

  before(async function () {
    env = await setupTestEnvironment();
  });

  after(async function () {
    await teardownTestEnvironment(env);
  });

  it('Complete cross-chain relay from Base to L2s with unified status', async function () {
    // Step 1: Setup operator account
    console.log('🔐 Step 1: Setting up bridge operator...');
    operatorPage = env.page;
    await register(operatorPage, 'operator@test.com', 'password123', 'admin');
    await connectWallet(operatorPage, env.testWallets.admin);

    // Step 2: Anchor receipt on Base
    console.log('⚓ Step 2: Anchoring receipt on Base...');
    await operatorPage.goto('/receipts');
    await operatorPage.getByTestId('button-create-receipt').click();

    const contentHash = '0x' + 'a'.repeat(64);
    const proofData = {
      proof: {
        pi_a: ['0x' + '1'.repeat(64), '0x' + '2'.repeat(64)],
        pi_b: [
          ['0x' + '3'.repeat(64), '0x' + '4'.repeat(64)],
          ['0x' + '5'.repeat(64), '0x' + '6'.repeat(64)],
        ],
        pi_c: ['0x' + '7'.repeat(64), '0x' + '8'.repeat(64)],
      },
      publicSignals: [contentHash, Date.now().toString()],
    };

    await operatorPage.getByTestId('select-receipt-type').selectOption('message');
    await operatorPage.getByTestId('input-subject-id').fill('test-cross-chain-msg-001');
    await operatorPage.getByTestId('input-content-hash').fill(contentHash);
    await operatorPage.getByTestId('textarea-proof-data').fill(JSON.stringify(proofData));
    await operatorPage.getByTestId('button-anchor-receipt').click();

    await operatorPage.waitForSelector('[data-testid="status-anchored"]', { timeout: 30000 });
    
    receiptId = await operatorPage.getAttribute('[data-testid="text-receipt-id"]', 'data-value') || '';
    expect(receiptId).to.be.a('string').and.not.empty;

    const baseAnchorTx = await operatorPage.getAttribute('[data-testid="text-base-anchor-tx"]', 'data-value');
    expect(baseAnchorTx).to.match(/^0x[a-fA-F0-9]{64}$/);

    // Verify on Base
    const baseAnchor = await env.contracts.anchorRegistry.getAnchor(receiptId);
    expect(baseAnchor.eventHash).to.equal(contentHash);

    // Step 3: Initiate bridge relay to multiple L2s
    console.log('🌉 Step 3: Initiating bridge relay...');
    await operatorPage.goto(`/bridge/relay/${receiptId}`);
    
    // Select target chains
    await operatorPage.getByTestId('checkbox-polygon').check();
    await operatorPage.getByTestId('checkbox-arbitrum').check();
    await operatorPage.getByTestId('checkbox-optimism').check();

    await operatorPage.getByTestId('button-start-relay').click();
    await operatorPage.waitForSelector('[data-testid="status-relay-initiated"]', { timeout: 10000 });

    // Step 4: Monitor Polygon confirmation
    console.log('🟣 Step 4: Waiting for Polygon confirmation...');
    await operatorPage.waitForSelector('[data-testid="status-polygon-pending"]', { timeout: 5000 });
    
    const polygonStatus = await operatorPage.getByTestId('status-polygon-pending').textContent();
    expect(polygonStatus).to.include('Relaying to Polygon');

    await operatorPage.waitForSelector('[data-testid="status-polygon-confirmed"]', { timeout: 60000 });
    
    const polygonTxHash = await operatorPage.getAttribute('[data-testid="text-polygon-tx"]', 'data-value');
    expect(polygonTxHash).to.match(/^0x[a-fA-F0-9]{64}$/);

    const polygonBlockNumber = await operatorPage.getAttribute('[data-testid="text-polygon-block"]', 'data-value');
    expect(parseInt(polygonBlockNumber || '0')).to.be.greaterThan(0);

    // Step 5: Monitor Arbitrum confirmation
    console.log('🔵 Step 5: Waiting for Arbitrum confirmation...');
    await operatorPage.waitForSelector('[data-testid="status-arbitrum-confirmed"]', { timeout: 60000 });
    
    const arbitrumTxHash = await operatorPage.getAttribute('[data-testid="text-arbitrum-tx"]', 'data-value');
    expect(arbitrumTxHash).to.match(/^0x[a-fA-F0-9]{64}$/);

    const arbitrumBlockNumber = await operatorPage.getAttribute('[data-testid="text-arbitrum-block"]', 'data-value');
    expect(parseInt(arbitrumBlockNumber || '0')).to.be.greaterThan(0);

    // Step 6: Monitor Optimism confirmation
    console.log('🔴 Step 6: Waiting for Optimism confirmation...');
    await operatorPage.waitForSelector('[data-testid="status-optimism-confirmed"]', { timeout: 60000 });
    
    const optimismTxHash = await operatorPage.getAttribute('[data-testid="text-optimism-tx"]', 'data-value');
    expect(optimismTxHash).to.match(/^0x[a-fA-F0-9]{64}$/);

    const optimismBlockNumber = await operatorPage.getAttribute('[data-testid="text-optimism-block"]', 'data-value');
    expect(parseInt(optimismBlockNumber || '0')).to.be.greaterThan(0);

    // Step 7: Verify unified status
    console.log('✅ Step 7: Verifying unified cross-chain status...');
    const unifiedStatus = await operatorPage.evaluate(async (rId) => {
      const response = await fetch(`/api/bridge/status/${rId}`);
      return response.json();
    }, receiptId);

    expect(unifiedStatus).to.have.property('receiptId', receiptId);
    expect(unifiedStatus).to.have.property('baseAnchor');
    expect(unifiedStatus.baseAnchor).to.have.property('confirmed', true);
    expect(unifiedStatus.baseAnchor).to.have.property('txHash', baseAnchorTx);

    expect(unifiedStatus).to.have.property('polygon');
    expect(unifiedStatus.polygon).to.have.property('confirmed', true);
    expect(unifiedStatus.polygon).to.have.property('txHash', polygonTxHash);

    expect(unifiedStatus).to.have.property('arbitrum');
    expect(unifiedStatus.arbitrum).to.have.property('confirmed', true);
    expect(unifiedStatus.arbitrum).to.have.property('txHash', arbitrumTxHash);

    expect(unifiedStatus).to.have.property('optimism');
    expect(unifiedStatus.optimism).to.have.property('confirmed', true);
    expect(unifiedStatus.optimism).to.have.property('txHash', optimismTxHash);

    // Step 8: Check bridge events in database
    console.log('🗄️  Step 8: Checking bridge events in database...');
    const bridgeEvents = await env.storage.getBridgeEventsByReceiptId(receiptId);
    expect(bridgeEvents).to.have.length.greaterThan(0);

    const polygonEvent = bridgeEvents.find(e => e.targetChain === 'polygon');
    const arbitrumEvent = bridgeEvents.find(e => e.targetChain === 'arbitrum');
    const optimismEvent = bridgeEvents.find(e => e.targetChain === 'optimism');

    expect(polygonEvent).to.exist;
    expect(polygonEvent?.status).to.equal('confirmed');
    expect(arbitrumEvent).to.exist;
    expect(arbitrumEvent?.status).to.equal('confirmed');
    expect(optimismEvent).to.exist;
    expect(optimismEvent?.status).to.equal('confirmed');

    // Step 9: Verify monitoring dashboard
    console.log('📊 Step 9: Verifying monitoring dashboard...');
    await operatorPage.goto('/bridge/monitor');
    
    const dashboardData = await operatorPage.evaluate(async () => {
      const response = await fetch('/api/bridge/monitor/stats');
      return response.json();
    });

    expect(dashboardData.totalRelays).to.be.greaterThan(0);
    expect(dashboardData.successfulRelays).to.be.greaterThan(0);
    expect(dashboardData.chains).to.have.property('polygon');
    expect(dashboardData.chains).to.have.property('arbitrum');
    expect(dashboardData.chains).to.have.property('optimism');

    // Step 10: Test relay status API
    console.log('🔍 Step 10: Testing relay status API...');
    const statusResponse = await operatorPage.evaluate(async (rId) => {
      const response = await fetch(`/api/bridge/relay/${rId}/status`);
      if (!response.ok) throw new Error('Status API failed');
      return response.json();
    }, receiptId);

    expect(statusResponse.status).to.equal('completed');
    expect(statusResponse.completedChains).to.include('polygon');
    expect(statusResponse.completedChains).to.include('arbitrum');
    expect(statusResponse.completedChains).to.include('optimism');

    console.log('✅ Cross-chain flow test completed successfully!');
  });

  it('Should handle relay failures and retries', async function () {
    // Create a new receipt
    await operatorPage.goto('/receipts');
    await operatorPage.getByTestId('button-create-receipt').click();

    const contentHash = '0x' + 'b'.repeat(64);
    await operatorPage.getByTestId('select-receipt-type').selectOption('message');
    await operatorPage.getByTestId('input-subject-id').fill('test-retry-001');
    await operatorPage.getByTestId('input-content-hash').fill(contentHash);
    await operatorPage.getByTestId('textarea-proof-data').fill('{"proof":{}}');
    await operatorPage.getByTestId('button-anchor-receipt').click();

    await operatorPage.waitForSelector('[data-testid="status-anchored"]', { timeout: 30000 });
    const retryReceiptId = await operatorPage.getAttribute('[data-testid="text-receipt-id"]', 'data-value');

    // Simulate network failure by injecting error
    await operatorPage.evaluate(() => {
      (window as any).simulateBridgeFailure = true;
    });

    // Try to relay
    await operatorPage.goto(`/bridge/relay/${retryReceiptId}`);
    await operatorPage.getByTestId('checkbox-polygon').check();
    await operatorPage.getByTestId('button-start-relay').click();

    // Should show failure
    await operatorPage.waitForSelector('[data-testid="status-polygon-failed"]', { timeout: 30000 });

    // Retry should be available
    const retryButton = operatorPage.getByTestId('button-retry-polygon');
    await expect(retryButton).toBeVisible();

    // Clear simulation
    await operatorPage.evaluate(() => {
      (window as any).simulateBridgeFailure = false;
    });

    // Retry
    await retryButton.click();
    await operatorPage.waitForSelector('[data-testid="status-polygon-confirmed"]', { timeout: 60000 });
  });

  it('Should track gas costs across chains', async function () {
    await operatorPage.goto('/bridge/monitor');
    await operatorPage.getByTestId('tab-gas-tracker').click();

    const gasData = await operatorPage.evaluate(async () => {
      const response = await fetch('/api/bridge/monitor/gas-costs');
      return response.json();
    });

    expect(gasData).to.have.property('base');
    expect(gasData).to.have.property('polygon');
    expect(gasData).to.have.property('arbitrum');
    expect(gasData).to.have.property('optimism');

    expect(gasData.base.avgGasPrice).to.be.greaterThan(0);
    expect(gasData.polygon.avgGasPrice).to.be.greaterThan(0);
  });
});
