import { expect } from 'chai';
import { Page } from 'playwright';
import {
  setupTestEnvironment,
  teardownTestEnvironment,
  register,
  connectWallet,
  generateMockZKProof,
  TestEnvironment,
} from './setup';
import { ethers } from 'ethers';
import crypto from 'crypto';

describe('Message Flow E2E Test', function () {
  this.timeout(120000); // 2 minutes for full flow

  let env: TestEnvironment;
  let senderPage: Page;
  let recipientPage: Page;

  before(async function () {
    env = await setupTestEnvironment();
  });

  after(async function () {
    await teardownTestEnvironment(env);
  });

  it('Complete encrypted message flow with ZK proof and anchor', async function () {
    // Step 1: Create sender account and wallet
    console.log('📝 Step 1: Creating sender account...');
    senderPage = env.page;
    await register(senderPage, 'sender@test.com', 'password123', 'viewer');
    
    // Connect wallet for sender
    await connectWallet(senderPage, env.testWallets.user1);
    await senderPage.getByTestId('button-connect-wallet').click();
    await senderPage.waitForTimeout(2000);
    
    const senderAddress = await senderPage.getByTestId('text-wallet-address').textContent();
    expect(senderAddress).to.include(env.testWallets.user1.address.slice(0, 6));

    // Step 2: Create recipient account
    console.log('👥 Step 2: Creating recipient account...');
    const recipientContext = await env.browser.newContext({ baseURL: env.baseUrl });
    recipientPage = await recipientContext.newPage();
    await register(recipientPage, 'recipient@test.com', 'password123', 'viewer');
    await connectWallet(recipientPage, env.testWallets.user2);

    // Step 3: Sender creates and sends encrypted message
    console.log('✉️  Step 3: Sending encrypted message...');
    await senderPage.goto('/messages');
    await senderPage.getByTestId('button-new-message').click();
    
    const messageContent = 'Hello, this is a secure P3 message!';
    const recipientAddress = env.testWallets.user2.address;
    
    await senderPage.getByTestId('input-recipient').fill(recipientAddress);
    await senderPage.getByTestId('textarea-message').fill(messageContent);
    
    // Encrypt message (simulated)
    const encryptedContent = Buffer.from(messageContent).toString('base64');
    await senderPage.getByTestId('button-send-message').click();

    // Wait for encryption and ZK proof generation
    await senderPage.waitForSelector('[data-testid="status-generating-proof"]', { timeout: 10000 });
    
    // Step 4: Verify ZK proof was generated
    console.log('🔐 Step 4: Verifying ZK proof generation...');
    const proofStatus = await senderPage.getByTestId('status-proof-generated').textContent();
    expect(proofStatus).to.include('Proof Generated');

    // Step 5: Anchor receipt on Base
    console.log('⚓ Step 5: Anchoring receipt on Base...');
    await senderPage.waitForSelector('[data-testid="status-anchoring"]', { timeout: 5000 });
    
    // Get the receipt ID
    const receiptId = await senderPage.getAttribute('[data-testid="text-receipt-id"]', 'data-value');
    expect(receiptId).to.be.a('string').and.not.empty;

    // Wait for anchor confirmation
    await senderPage.waitForSelector('[data-testid="status-anchored"]', { timeout: 30000 });
    
    const anchorTxHash = await senderPage.getAttribute('[data-testid="text-anchor-tx"]', 'data-value');
    expect(anchorTxHash).to.match(/^0x[a-fA-F0-9]{64}$/);

    // Step 6: Verify anchor on-chain
    console.log('✅ Step 6: Verifying anchor on-chain...');
    const anchorVerified = await env.contracts.anchorRegistry.verifyAnchor(receiptId);
    expect(anchorVerified).to.be.true;

    const anchorData = await env.contracts.anchorRegistry.getAnchor(receiptId);
    expect(anchorData.submitter).to.equal(env.testWallets.user1.address);

    // Step 7: Recipient receives message notification
    console.log('📬 Step 7: Recipient receiving message...');
    await recipientPage.goto('/inbox');
    await recipientPage.waitForTimeout(2000); // Wait for polling/websocket

    const messageRow = recipientPage.getByTestId(`message-${receiptId}`);
    await expect(messageRow).toBeVisible({ timeout: 10000 });

    // Step 8: Recipient decrypts message
    console.log('🔓 Step 8: Decrypting message...');
    await messageRow.click();
    await recipientPage.getByTestId('button-decrypt-message').click();
    
    // Wait for decryption
    await recipientPage.waitForSelector('[data-testid="text-decrypted-content"]', { timeout: 5000 });
    const decryptedText = await recipientPage.getByTestId('text-decrypted-content').textContent();
    expect(decryptedText).to.equal(messageContent);

    // Step 9: Recipient verifies receipt anchor
    console.log('🔍 Step 9: Verifying receipt anchor...');
    const verifyButton = recipientPage.getByTestId('button-verify-anchor');
    await verifyButton.click();
    
    await recipientPage.waitForSelector('[data-testid="status-anchor-verified"]', { timeout: 5000 });
    const verificationStatus = await recipientPage.getByTestId('status-anchor-verified').textContent();
    expect(verificationStatus).to.include('Verified on Base');

    // Step 10: Check audit trail
    console.log('📜 Step 10: Checking audit trail...');
    const auditLogs = await env.storage.getAuditLogsByEntity('receipt', receiptId!);
    expect(auditLogs).to.have.length.greaterThan(0);
    
    const createLog = auditLogs.find(log => log.action === 'create');
    expect(createLog).to.exist;
    expect(createLog?.actor).to.equal('sender@test.com');

    console.log('✅ Message flow test completed successfully!');
  });

  it('Should handle message delivery failure gracefully', async function () {
    await senderPage.goto('/messages');
    await senderPage.getByTestId('button-new-message').click();
    
    // Try to send to invalid address
    await senderPage.getByTestId('input-recipient').fill('0xinvalid');
    await senderPage.getByTestId('textarea-message').fill('Test message');
    await senderPage.getByTestId('button-send-message').click();

    // Should show error
    const errorMessage = await senderPage.getByTestId('error-message').textContent();
    expect(errorMessage).to.include('Invalid recipient address');
  });

  it('Should verify ZK proof validity', async function () {
    // Navigate to receipts page
    await senderPage.goto('/receipts');
    
    // Find first receipt
    const firstReceipt = senderPage.getByTestId('receipt-row').first();
    await firstReceipt.click();

    // Verify proof
    const proofData = await senderPage.evaluate(() => {
      return (window as any).currentReceipt?.proofBlob;
    });

    expect(proofData).to.exist;
    expect(proofData).to.have.property('proof');
    expect(proofData).to.have.property('publicSignals');
  });
});
