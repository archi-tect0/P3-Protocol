import { expect } from 'chai';
import { Page } from 'playwright';
import {
  setupTestEnvironment,
  teardownTestEnvironment,
  register,
  connectWallet,
  TestEnvironment,
} from './setup';
import { ethers } from 'ethers';

describe('Payment Flow E2E Test', function () {
  this.timeout(120000);

  let env: TestEnvironment;
  let senderPage: Page;
  let receiptId: string;

  before(async function () {
    env = await setupTestEnvironment();
  });

  after(async function () {
    await teardownTestEnvironment(env);
  });

  it('Complete ERC-20 payment flow with allocations and cross-chain relay', async function () {
    // Step 1: Setup sender account
    console.log('💳 Step 1: Setting up payment sender...');
    senderPage = env.page;
    await register(senderPage, 'payer@test.com', 'password123', 'admin');
    await connectWallet(senderPage, env.testWallets.admin);

    // Step 2: Transfer ERC-20 tokens
    console.log('💸 Step 2: Initiating ERC-20 transfer...');
    await senderPage.goto('/ledger');
    await senderPage.getByTestId('button-new-transaction').click();

    const amount = '100.50';
    const asset = 'USDC';
    const counterparty = env.testWallets.user1.address;
    const memo = 'Test payment for services';

    await senderPage.getByTestId('input-amount').fill(amount);
    await senderPage.getByTestId('select-asset').selectOption(asset);
    await senderPage.getByTestId('input-counterparty').fill(counterparty);
    await senderPage.getByTestId('input-memo').fill(memo);
    await senderPage.getByTestId('button-send-payment').click();

    // Wait for transaction to be broadcast
    await senderPage.waitForSelector('[data-testid="status-broadcasting"]', { timeout: 5000 });

    // Step 3: Record ledger event
    console.log('📝 Step 3: Recording ledger event...');
    const txHash = await senderPage.getAttribute('[data-testid="text-tx-hash"]', 'data-value');
    expect(txHash).to.match(/^0x[a-fA-F0-9]{64}$/);

    await senderPage.waitForSelector('[data-testid="status-confirmed"]', { timeout: 30000 });

    // Verify ledger event in database
    const ledgerEvents = await env.storage.getLedgerEventsByTxHash(txHash!);
    expect(ledgerEvents).to.have.length(1);
    expect(ledgerEvents[0].direction).to.equal('outflow');
    expect(ledgerEvents[0].asset).to.equal(asset);

    // Step 4: Compute allocations
    console.log('📊 Step 4: Computing fund allocations...');
    await senderPage.getByTestId('button-compute-allocations').click();

    // Define allocation policy
    const allocationPolicy = [
      { bucket: 'ops', percent: 40 },
      { bucket: 'r&d', percent: 30 },
      { bucket: 'grants', percent: 20 },
      { bucket: 'reserve', percent: 10 },
    ];

    // Wait for allocation computation
    await senderPage.waitForSelector('[data-testid="status-allocations-computed"]', { timeout: 10000 });

    // Verify allocations
    const allocations = await env.storage.getAllocationsByLedgerEvent(ledgerEvents[0].id);
    expect(allocations).to.have.length(4);

    const totalAllocated = allocations.reduce(
      (sum, alloc) => sum + parseFloat(alloc.amount),
      0
    );
    expect(totalAllocated).to.be.closeTo(parseFloat(amount), 0.01);

    // Step 5: Generate ZK proof for payment
    console.log('🔐 Step 5: Generating payment ZK proof...');
    await senderPage.getByTestId('button-generate-proof').click();
    await senderPage.waitForSelector('[data-testid="status-proof-generated"]', { timeout: 30000 });

    const proofData = await senderPage.evaluate(() => {
      return (window as any).currentProof;
    });
    expect(proofData).to.have.property('proof');
    expect(proofData).to.have.property('publicSignals');

    // Step 6: Anchor payment receipt on Base
    console.log('⚓ Step 6: Anchoring payment receipt...');
    receiptId = await senderPage.getAttribute('[data-testid="text-receipt-id"]', 'data-value') || '';
    expect(receiptId).to.be.a('string').and.not.empty;

    await senderPage.waitForSelector('[data-testid="status-anchored"]', { timeout: 30000 });

    const anchorTxHash = await senderPage.getAttribute('[data-testid="text-anchor-tx"]', 'data-value');
    expect(anchorTxHash).to.match(/^0x[a-fA-F0-9]{64}$/);

    // Verify on-chain
    const anchorVerified = await env.contracts.anchorRegistry.verifyAnchor(receiptId);
    expect(anchorVerified).to.be.true;

    // Step 7: Initiate cross-chain relay
    console.log('🌉 Step 7: Initiating cross-chain relay...');
    await senderPage.getByTestId('button-relay-cross-chain').click();

    // Select target chains
    await senderPage.getByTestId('checkbox-polygon').check();
    await senderPage.getByTestId('checkbox-arbitrum').check();
    await senderPage.getByTestId('checkbox-optimism').check();
    await senderPage.getByTestId('button-initiate-relay').click();

    await senderPage.waitForSelector('[data-testid="status-relay-initiated"]', { timeout: 10000 });

    // Step 8: Track confirmations
    console.log('✅ Step 8: Tracking cross-chain confirmations...');
    
    // Wait for Polygon confirmation
    await senderPage.waitForSelector('[data-testid="status-polygon-confirmed"]', { timeout: 60000 });
    const polygonTx = await senderPage.getAttribute('[data-testid="text-polygon-tx"]', 'data-value');
    expect(polygonTx).to.match(/^0x[a-fA-F0-9]{64}$/);

    // Wait for Arbitrum confirmation
    await senderPage.waitForSelector('[data-testid="status-arbitrum-confirmed"]', { timeout: 60000 });
    const arbitrumTx = await senderPage.getAttribute('[data-testid="text-arbitrum-tx"]', 'data-value');
    expect(arbitrumTx).to.match(/^0x[a-fA-F0-9]{64}$/);

    // Wait for Optimism confirmation
    await senderPage.waitForSelector('[data-testid="status-optimism-confirmed"]', { timeout: 60000 });
    const optimismTx = await senderPage.getAttribute('[data-testid="text-optimism-tx"]', 'data-value');
    expect(optimismTx).to.match(/^0x[a-fA-F0-9]{64}$/);

    // Step 9: Verify unified status
    console.log('🔍 Step 9: Verifying unified status...');
    const bridgeStatus = await senderPage.evaluate(async (rId) => {
      const response = await fetch(`/api/bridge/status/${rId}`);
      return response.json();
    }, receiptId);

    expect(bridgeStatus.baseAnchor).to.exist;
    expect(bridgeStatus.polygon).to.have.property('confirmed', true);
    expect(bridgeStatus.arbitrum).to.have.property('confirmed', true);
    expect(bridgeStatus.optimism).to.have.property('confirmed', true);

    // Step 10: Verify payment receipt
    console.log('📜 Step 10: Verifying payment receipt...');
    const receipt = await env.storage.getReceiptById(receiptId);
    expect(receipt).to.exist;
    expect(receipt?.type).to.equal('money');
    expect(receipt?.subjectId).to.equal(txHash);

    console.log('✅ Payment flow test completed successfully!');
  });

  it('Should handle failed transactions gracefully', async function () {
    await senderPage.goto('/ledger');
    await senderPage.getByTestId('button-new-transaction').click();

    // Try with insufficient balance
    await senderPage.getByTestId('input-amount').fill('99999999');
    await senderPage.getByTestId('select-asset').selectOption('USDC');
    await senderPage.getByTestId('input-counterparty').fill(env.testWallets.user1.address);
    await senderPage.getByTestId('button-send-payment').click();

    const errorMessage = await senderPage.getByTestId('error-message').textContent();
    expect(errorMessage).to.include('Insufficient balance');
  });

  it('Should validate allocation percentages sum to 100', async function () {
    await senderPage.goto('/ledger');
    
    // Navigate to allocations settings
    await senderPage.getByTestId('link-allocation-settings').click();

    // Try to save invalid allocation
    await senderPage.getByTestId('input-ops-percent').fill('40');
    await senderPage.getByTestId('input-rnd-percent').fill('30');
    await senderPage.getByTestId('input-grants-percent').fill('20');
    await senderPage.getByTestId('input-reserve-percent').fill('5'); // Only 95% total

    await senderPage.getByTestId('button-save-allocations').click();

    const validationError = await senderPage.getByTestId('error-allocation-total').textContent();
    expect(validationError).to.include('must sum to 100%');
  });
});
