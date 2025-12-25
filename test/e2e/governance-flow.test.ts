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

describe('Governance Flow E2E Test', function () {
  this.timeout(180000); // 3 minutes for timelock operations

  let env: TestEnvironment;
  let adminPage: Page;
  let voter1Page: Page;
  let voter2Page: Page;
  let proposalId: string;

  before(async function () {
    env = await setupTestEnvironment();

    // Distribute governance tokens to test wallets
    const tokenAmount = ethers.parseEther('1000');
    await env.contracts.governanceToken.mint(env.testWallets.admin.address, tokenAmount);
    await env.contracts.governanceToken.mint(env.testWallets.user1.address, tokenAmount);
    await env.contracts.governanceToken.mint(env.testWallets.user2.address, tokenAmount);

    // Delegate voting power
    await env.contracts.governanceToken.connect(env.testWallets.admin).delegate(env.testWallets.admin.address);
    await env.contracts.governanceToken.connect(env.testWallets.user1).delegate(env.testWallets.user1.address);
    await env.contracts.governanceToken.connect(env.testWallets.user2).delegate(env.testWallets.user2.address);
  });

  after(async function () {
    await teardownTestEnvironment(env);
  });

  it('Complete DAO governance flow from proposal to execution', async function () {
    // Step 1: Admin creates proposal
    console.log('📝 Step 1: Admin creating governance proposal...');
    adminPage = env.page;
    await register(adminPage, 'admin@test.com', 'password123', 'admin');
    await connectWallet(adminPage, env.testWallets.admin);

    await adminPage.goto('/dao');
    await adminPage.getByTestId('button-create-proposal').click();

    const proposalTitle = 'Update Treasury Allocation Policy';
    const proposalDescription = 'Increase R&D allocation from 30% to 40%';

    await adminPage.getByTestId('input-proposal-title').fill(proposalTitle);
    await adminPage.getByTestId('textarea-proposal-description').fill(proposalDescription);
    
    // Set proposal actions (update config)
    await adminPage.getByTestId('select-action-type').selectOption('updateConfig');
    await adminPage.getByTestId('input-config-key').fill('allocation.rnd');
    await adminPage.getByTestId('input-config-value').fill('40');
    
    await adminPage.getByTestId('button-submit-proposal').click();

    // Wait for proposal creation
    await adminPage.waitForSelector('[data-testid="status-proposal-created"]', { timeout: 30000 });
    
    proposalId = await adminPage.getAttribute('[data-testid="text-proposal-id"]', 'data-value') || '';
    expect(proposalId).to.be.a('string').and.not.empty;

    // Verify proposal on-chain
    const proposalState = await env.contracts.governor.state(proposalId);
    expect(proposalState).to.equal(0); // Pending state

    // Step 2: First user votes
    console.log('🗳️  Step 2: Users voting on proposal...');
    const voter1Context = await env.browser.newContext({ baseURL: env.baseUrl });
    voter1Page = await voter1Context.newPage();
    await register(voter1Page, 'voter1@test.com', 'password123', 'viewer');
    await connectWallet(voter1Page, env.testWallets.user1);

    await voter1Page.goto(`/dao/proposals/${proposalId}`);
    await voter1Page.waitForSelector('[data-testid="button-vote-for"]', { timeout: 10000 });
    await voter1Page.getByTestId('button-vote-for').click();
    
    await voter1Page.waitForSelector('[data-testid="status-vote-cast"]', { timeout: 30000 });
    const vote1Confirmed = await voter1Page.getByTestId('status-vote-cast').textContent();
    expect(vote1Confirmed).to.include('Vote Recorded');

    // Step 3: Second user votes
    const voter2Context = await env.browser.newContext({ baseURL: env.baseUrl });
    voter2Page = await voter2Context.newPage();
    await register(voter2Page, 'voter2@test.com', 'password123', 'viewer');
    await connectWallet(voter2Page, env.testWallets.user2);

    await voter2Page.goto(`/dao/proposals/${proposalId}`);
    await voter2Page.getByTestId('button-vote-for').click();
    await voter2Page.waitForSelector('[data-testid="status-vote-cast"]', { timeout: 30000 });

    // Admin also votes
    await adminPage.goto(`/dao/proposals/${proposalId}`);
    await adminPage.getByTestId('button-vote-for').click();
    await adminPage.waitForSelector('[data-testid="status-vote-cast"]', { timeout: 30000 });

    // Step 4: Wait for voting period to end and check results
    console.log('⏳ Step 4: Waiting for voting period to end...');
    
    // Fast-forward time in test environment
    await adminPage.evaluate(async (pId) => {
      // Mine blocks to simulate voting period
      await fetch('/api/test/mine-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocks: 100 }),
      });
    }, proposalId);

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check voting results
    const votes = await adminPage.evaluate(async (pId) => {
      const response = await fetch(`/api/dao/proposals/${pId}/votes`);
      return response.json();
    }, proposalId);

    expect(votes.for).to.be.greaterThan(votes.against);
    expect(votes.for).to.be.greaterThan(votes.abstain);

    // Step 5: Queue proposal in timelock
    console.log('⏰ Step 5: Queueing proposal in timelock...');
    await adminPage.getByTestId('button-queue-proposal').click();
    await adminPage.waitForSelector('[data-testid="status-proposal-queued"]', { timeout: 30000 });

    const queuedStatus = await adminPage.getByTestId('status-proposal-queued').textContent();
    expect(queuedStatus).to.include('Queued');

    // Step 6: Wait for timelock delay (simulated)
    console.log('⏲️  Step 6: Waiting for timelock delay...');
    
    // Fast-forward time
    await adminPage.evaluate(async () => {
      await fetch('/api/test/increase-time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seconds: 86400 }), // 1 day
      });
    });

    // Step 7: Execute proposal
    console.log('⚡ Step 7: Executing proposal...');
    await adminPage.getByTestId('button-execute-proposal').click();
    await adminPage.waitForSelector('[data-testid="status-proposal-executed"]', { timeout: 30000 });

    const executedStatus = await adminPage.getByTestId('status-proposal-executed').textContent();
    expect(executedStatus).to.include('Executed');

    // Step 8: Verify config was updated
    console.log('✅ Step 8: Verifying configuration update...');
    const updatedConfig = await adminPage.evaluate(async () => {
      const response = await fetch('/api/config/allocation');
      return response.json();
    });

    expect(updatedConfig.rnd).to.equal(40);

    // Step 9: Check audit trail
    console.log('📜 Step 9: Verifying audit trail...');
    const auditLogs = await env.storage.getAuditLogsByEntity('dao_proposal', proposalId);
    expect(auditLogs.length).to.be.greaterThan(0);

    const proposalCreated = auditLogs.find(log => log.action === 'create');
    const proposalExecuted = auditLogs.find(log => log.action === 'execute');
    
    expect(proposalCreated).to.exist;
    expect(proposalExecuted).to.exist;
    expect(proposalCreated?.actor).to.equal('admin@test.com');

    // Step 10: Verify governance activity in database
    console.log('🗄️  Step 10: Verifying database records...');
    const proposal = await env.storage.getDAOProposalById(proposalId);
    expect(proposal).to.exist;
    expect(proposal?.title).to.equal(proposalTitle);
    expect(proposal?.status).to.equal('executed');
    expect(proposal?.votesFor).to.be.greaterThan(0);

    console.log('✅ Governance flow test completed successfully!');
  });

  it('Should reject proposals that do not meet quorum', async function () {
    await adminPage.goto('/dao');
    await adminPage.getByTestId('button-create-proposal').click();

    await adminPage.getByTestId('input-proposal-title').fill('Low Quorum Test');
    await adminPage.getByTestId('textarea-proposal-description').fill('This should not pass');
    await adminPage.getByTestId('select-action-type').selectOption('updateConfig');
    await adminPage.getByTestId('input-config-key').fill('test.value');
    await adminPage.getByTestId('input-config-value').fill('123');
    await adminPage.getByTestId('button-submit-proposal').click();

    await adminPage.waitForSelector('[data-testid="status-proposal-created"]', { timeout: 30000 });
    const lowQuorumProposalId = await adminPage.getAttribute('[data-testid="text-proposal-id"]', 'data-value');

    // Only admin votes (insufficient for quorum)
    await adminPage.goto(`/dao/proposals/${lowQuorumProposalId}`);
    await adminPage.getByTestId('button-vote-for').click();
    await adminPage.waitForSelector('[data-testid="status-vote-cast"]', { timeout: 30000 });

    // Fast-forward voting period
    await adminPage.evaluate(async () => {
      await fetch('/api/test/mine-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocks: 100 }),
      });
    });

    // Try to queue - should fail
    await adminPage.getByTestId('button-queue-proposal').click();
    const errorMessage = await adminPage.getByTestId('error-message').textContent();
    expect(errorMessage).to.include('quorum not reached');
  });

  it('Should prevent execution before timelock delay', async function () {
    // Create and queue a proposal
    await adminPage.goto('/dao');
    await adminPage.getByTestId('button-create-proposal').click();

    await adminPage.getByTestId('input-proposal-title').fill('Timelock Test');
    await adminPage.getByTestId('textarea-proposal-description').fill('Testing timelock');
    await adminPage.getByTestId('select-action-type').selectOption('updateConfig');
    await adminPage.getByTestId('input-config-key').fill('test.timelock');
    await adminPage.getByTestId('input-config-value').fill('456');
    await adminPage.getByTestId('button-submit-proposal').click();

    await adminPage.waitForSelector('[data-testid="status-proposal-created"]', { timeout: 30000 });
    const timelockProposalId = await adminPage.getAttribute('[data-testid="text-proposal-id"]', 'data-value');

    // Vote and queue
    await adminPage.goto(`/dao/proposals/${timelockProposalId}`);
    await adminPage.getByTestId('button-vote-for').click();
    await voter1Page.goto(`/dao/proposals/${timelockProposalId}`);
    await voter1Page.getByTestId('button-vote-for').click();
    await voter2Page.goto(`/dao/proposals/${timelockProposalId}`);
    await voter2Page.getByTestId('button-vote-for').click();

    // Mine blocks
    await adminPage.evaluate(async () => {
      await fetch('/api/test/mine-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocks: 100 }),
      });
    });

    await adminPage.goto(`/dao/proposals/${timelockProposalId}`);
    await adminPage.getByTestId('button-queue-proposal').click();
    await adminPage.waitForSelector('[data-testid="status-proposal-queued"]', { timeout: 30000 });

    // Try to execute immediately (should fail)
    await adminPage.getByTestId('button-execute-proposal').click();
    const timelockError = await adminPage.getByTestId('error-message').textContent();
    expect(timelockError).to.include('timelock delay not met');
  });
});
