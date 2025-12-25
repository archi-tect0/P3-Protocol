import { expect } from 'chai';
import { Page } from 'playwright';
import {
  setupTestEnvironment,
  teardownTestEnvironment,
  register,
  connectWallet,
  TestEnvironment,
} from './setup';

describe('Meeting Flow E2E Test', function () {
  this.timeout(120000);

  let env: TestEnvironment;
  let hostPage: Page;
  let participantPage: Page;
  let meetingId: string;

  before(async function () {
    env = await setupTestEnvironment();
  });

  after(async function () {
    await teardownTestEnvironment(env);
  });

  it('Complete voice call flow with metrics and receipt', async function () {
    // Step 1: Host creates account and starts call
    console.log('🎙️  Step 1: Host starting voice call...');
    hostPage = env.page;
    await register(hostPage, 'host@test.com', 'password123', 'viewer');
    await connectWallet(hostPage, env.testWallets.user1);

    await hostPage.goto('/voice');
    await hostPage.getByTestId('button-start-call').click();
    
    // Get meeting ID
    meetingId = await hostPage.getAttribute('[data-testid="text-meeting-id"]', 'data-value') || '';
    expect(meetingId).to.be.a('string').and.not.empty;

    // Step 2: Participant joins call
    console.log('👥 Step 2: Participant joining call...');
    const participantContext = await env.browser.newContext({ baseURL: env.baseUrl });
    participantPage = await participantContext.newPage();
    await register(participantPage, 'participant@test.com', 'password123', 'viewer');
    await connectWallet(participantPage, env.testWallets.user2);

    await participantPage.goto('/voice');
    await participantPage.getByTestId('input-meeting-id').fill(meetingId);
    await participantPage.getByTestId('button-join-call').click();

    // Step 3: Verify WebRTC connection established
    console.log('🔗 Step 3: Establishing WebRTC connection...');
    
    // Wait for connection status on both sides
    await hostPage.waitForSelector('[data-testid="status-connected"]', { timeout: 15000 });
    await participantPage.waitForSelector('[data-testid="status-connected"]', { timeout: 15000 });

    const hostConnectionStatus = await hostPage.getByTestId('status-connected').textContent();
    expect(hostConnectionStatus).to.include('Connected');

    const participantConnectionStatus = await participantPage.getByTestId('status-connected').textContent();
    expect(participantConnectionStatus).to.include('Connected');

    // Verify peer count
    const peerCount = await hostPage.getByTestId('text-peer-count').textContent();
    expect(peerCount).to.equal('2');

    // Step 4: Collect call stats during session
    console.log('📊 Step 4: Collecting call statistics...');
    
    // Simulate some call duration
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check stats are being collected
    const statsVisible = await hostPage.getByTestId('stats-panel').isVisible();
    expect(statsVisible).to.be.true;

    const audioQuality = await hostPage.getAttribute('[data-testid="stat-audio-quality"]', 'data-value');
    expect(parseFloat(audioQuality || '0')).to.be.greaterThan(0);

    const latency = await hostPage.getAttribute('[data-testid="stat-latency"]', 'data-value');
    expect(parseFloat(latency || '0')).to.be.greaterThan(0);

    // Step 5: End call and collect final metrics
    console.log('📞 Step 5: Ending call and collecting metrics...');
    await hostPage.getByTestId('button-end-call').click();
    
    // Wait for call to end
    await hostPage.waitForSelector('[data-testid="status-call-ended"]', { timeout: 5000 });
    await participantPage.waitForSelector('[data-testid="status-call-ended"]', { timeout: 5000 });

    // Step 6: Generate meeting proof
    console.log('🔐 Step 6: Generating meeting proof...');
    await hostPage.waitForSelector('[data-testid="status-generating-proof"]', { timeout: 10000 });
    
    const proofGenerated = await hostPage.waitForSelector('[data-testid="status-proof-generated"]', { timeout: 30000 });
    expect(proofGenerated).to.exist;

    // Step 7: Anchor meeting metrics on-chain
    console.log('⚓ Step 7: Anchoring meeting receipt...');
    const receiptId = await hostPage.getAttribute('[data-testid="text-receipt-id"]', 'data-value');
    expect(receiptId).to.be.a('string').and.not.empty;

    await hostPage.waitForSelector('[data-testid="status-anchored"]', { timeout: 30000 });
    
    const anchorTxHash = await hostPage.getAttribute('[data-testid="text-anchor-tx"]', 'data-value');
    expect(anchorTxHash).to.match(/^0x[a-fA-F0-9]{64}$/);

    // Step 8: Verify receipt on-chain
    console.log('✅ Step 8: Verifying receipt on-chain...');
    const anchorVerified = await env.contracts.anchorRegistry.verifyAnchor(receiptId);
    expect(anchorVerified).to.be.true;

    // Step 9: Check meeting receipt in database
    console.log('📝 Step 9: Checking meeting receipt in database...');
    const receipt = await env.storage.getReceiptById(receiptId!);
    expect(receipt).to.exist;
    expect(receipt?.type).to.equal('meeting');
    expect(receipt?.subjectId).to.equal(meetingId);

    const proofBlob = receipt?.proofBlob as any;
    expect(proofBlob).to.have.property('proof');
    expect(proofBlob).to.have.property('publicSignals');

    // Step 10: Verify call session in database
    console.log('🗄️  Step 10: Verifying call session data...');
    const callSession = await env.storage.getCallSessionByRoomId(meetingId);
    expect(callSession).to.exist;
    expect(callSession?.participantsHashes).to.have.length(2);
    expect(callSession?.endedAt).to.exist;

    // Duration should be at least 5 seconds
    const duration = callSession!.endedAt!.getTime() - callSession!.startedAt.getTime();
    expect(duration).to.be.greaterThan(5000);

    console.log('✅ Meeting flow test completed successfully!');
  });

  it('Should handle participant connection failures', async function () {
    await hostPage.goto('/voice');
    await hostPage.getByTestId('button-start-call').click();
    
    const newMeetingId = await hostPage.getAttribute('[data-testid="text-meeting-id"]', 'data-value');

    // Try to join with invalid meeting ID
    const newParticipantContext = await env.browser.newContext({ baseURL: env.baseUrl });
    const newParticipantPage = await newParticipantContext.newPage();
    await register(newParticipantPage, 'newuser@test.com', 'password123');

    await newParticipantPage.goto('/voice');
    await newParticipantPage.getByTestId('input-meeting-id').fill('invalid-meeting-id');
    await newParticipantPage.getByTestId('button-join-call').click();

    const errorMessage = await newParticipantPage.getByTestId('error-message').textContent();
    expect(errorMessage).to.include('Meeting not found');

    await newParticipantContext.close();
  });

  it('Should record audio quality metrics accurately', async function () {
    // Navigate to past meetings
    await hostPage.goto('/meetings/history');
    
    const firstMeeting = hostPage.getByTestId('meeting-row').first();
    await firstMeeting.click();

    // Check metrics are displayed
    const metricsPanel = hostPage.getByTestId('metrics-panel');
    await expect(metricsPanel).toBeVisible();

    const avgAudioQuality = await hostPage.getByTestId('metric-avg-audio-quality').textContent();
    expect(parseFloat(avgAudioQuality || '0')).to.be.greaterThan(0).and.lessThanOrEqual(100);

    const avgLatency = await hostPage.getByTestId('metric-avg-latency').textContent();
    expect(parseFloat(avgLatency || '0')).to.be.greaterThan(0);
  });
});
