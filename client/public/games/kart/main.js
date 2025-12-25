(function() {
  'use strict';

  const SIGNALING_URL = window.location.origin.replace(/^http/, 'ws') + '/ws/signaling';
  const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ];

  const statusEl = document.getElementById('status');
  const connectBtn = document.getElementById('connectBtn');
  const raceBtn = document.getElementById('raceBtn');
  const payBtn = document.getElementById('payBtn');
  const installBtn = document.getElementById('installBtn');
  const videoEl = document.getElementById('gameVideo');
  const canvasEl = document.getElementById('fallbackCanvas');
  const ctx = canvasEl.getContext('2d');

  let peerConnection = null;
  let signalingSocket = null;
  let isConnected = false;
  let isStreaming = false;
  let walletAddress = null;
  let deferredPrompt = null;
  let animationId = null;

  let kart = {
    x: 0,
    y: 0,
    vx: 3,
    vy: 2,
    width: 80,
    height: 40,
    color: '#667eea',
    trail: []
  };

  function init() {
    registerServiceWorker();
    setupEventListeners();
    setupInstallPrompt();
    resizeCanvas();
    startFallbackDemo();
    raceBtn.disabled = true;
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('SW registered:', reg.scope))
        .catch(err => console.warn('SW registration failed:', err));
    }
  }

  function setupEventListeners() {
    connectBtn.addEventListener('click', handleConnect);
    raceBtn.addEventListener('click', handleJoinRace);
    payBtn.addEventListener('click', handlePayEntry);
    installBtn.addEventListener('click', handleInstall);
    window.addEventListener('resize', resizeCanvas);
    
    window.addEventListener('keydown', handleKeyDown);
    canvasEl.addEventListener('touchstart', handleTouch, { passive: false });
  }

  function setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      installBtn.hidden = false;
    });

    window.addEventListener('appinstalled', () => {
      installBtn.hidden = true;
      deferredPrompt = null;
    });
  }

  async function handleInstall() {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log('Install prompt outcome:', outcome);
    deferredPrompt = null;
    installBtn.hidden = true;
  }

  async function handleConnect() {
    if (isConnected) {
      disconnect();
      return;
    }

    if (typeof window.ethereum !== 'undefined') {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        walletAddress = accounts[0];
        updateStatus('connected', `Connected: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`);
        connectBtn.textContent = 'Disconnect';
        connectBtn.classList.add('connected');
        isConnected = true;
        raceBtn.disabled = false;
        
        connectToSignaling();
      } catch (err) {
        console.error('Wallet connection failed:', err);
        updateStatus('error', 'Connection Failed');
      }
    } else {
      updateStatus('error', 'No Wallet Found');
      alert('Please install MetaMask or another Web3 wallet to play Crypto Kart!');
    }
  }

  function disconnect() {
    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }
    if (signalingSocket) {
      signalingSocket.close();
      signalingSocket = null;
    }
    
    isConnected = false;
    isStreaming = false;
    walletAddress = null;
    
    videoEl.classList.remove('active');
    canvasEl.classList.remove('hidden');
    
    connectBtn.textContent = 'Connect';
    connectBtn.classList.remove('connected');
    raceBtn.disabled = true;
    updateStatus('disconnected', 'Disconnected');
    
    startFallbackDemo();
  }

  function connectToSignaling() {
    try {
      signalingSocket = new WebSocket(SIGNALING_URL);
      
      signalingSocket.onopen = () => {
        console.log('Signaling connected');
        signalingSocket.send(JSON.stringify({
          type: 'register',
          clientId: walletAddress,
          gameId: 'crypto-kart'
        }));
      };

      signalingSocket.onmessage = async (event) => {
        const message = JSON.parse(event.data);
        await handleSignalingMessage(message);
      };

      signalingSocket.onerror = (err) => {
        console.warn('Signaling error:', err);
      };

      signalingSocket.onclose = () => {
        console.log('Signaling disconnected');
      };
    } catch (err) {
      console.warn('Could not connect to signaling server:', err);
    }
  }

  async function handleSignalingMessage(message) {
    switch (message.type) {
      case 'offer':
        await handleOffer(message);
        break;
      case 'answer':
        if (peerConnection) {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(message.sdp));
        }
        break;
      case 'ice-candidate':
        if (peerConnection && message.candidate) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate));
        }
        break;
      case 'stream-ready':
        updateStatus('streaming', 'Stream Ready');
        break;
    }
  }

  async function handleOffer(message) {
    peerConnection = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    
    peerConnection.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        videoEl.srcObject = event.streams[0];
        videoEl.classList.add('active');
        canvasEl.classList.add('hidden');
        isStreaming = true;
        stopFallbackDemo();
        updateStatus('streaming', 'Streaming');
      }
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate && signalingSocket && signalingSocket.readyState === WebSocket.OPEN) {
        signalingSocket.send(JSON.stringify({
          type: 'ice-candidate',
          candidate: event.candidate
        }));
      }
    };

    peerConnection.onconnectionstatechange = () => {
      console.log('Connection state:', peerConnection.connectionState);
      if (peerConnection.connectionState === 'disconnected' || 
          peerConnection.connectionState === 'failed') {
        videoEl.classList.remove('active');
        canvasEl.classList.remove('hidden');
        isStreaming = false;
        startFallbackDemo();
        updateStatus('connected', 'Stream Lost - Demo Mode');
      }
    };

    await peerConnection.setRemoteDescription(new RTCSessionDescription(message.sdp));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    if (signalingSocket && signalingSocket.readyState === WebSocket.OPEN) {
      signalingSocket.send(JSON.stringify({
        type: 'answer',
        sdp: answer
      }));
    }
  }

  async function handleJoinRace() {
    if (!isConnected) {
      alert('Please connect your wallet first!');
      return;
    }

    updateStatus('connected', 'Joining Race...');
    
    if (signalingSocket && signalingSocket.readyState === WebSocket.OPEN) {
      signalingSocket.send(JSON.stringify({
        type: 'join-race',
        clientId: walletAddress
      }));
    }
    
    setTimeout(() => {
      if (!isStreaming) {
        updateStatus('connected', 'Demo Mode - No Streamer Available');
      }
    }, 3000);
  }

  async function handlePayEntry() {
    if (!isConnected || !walletAddress) {
      alert('Please connect your wallet first!');
      return;
    }

    try {
      updateStatus('connected', 'Confirming Payment...');
      
      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from: walletAddress,
          to: '0x742d35Cc6634C0532925a3b844Bc9e7595f7E4b2',
          value: '0x38D7EA4C68000',
          data: '0x'
        }]
      });
      
      console.log('Transaction sent:', txHash);
      updateStatus('connected', 'Payment Sent! Tx: ' + txHash.slice(0, 10) + '...');
      
      if (signalingSocket && signalingSocket.readyState === WebSocket.OPEN) {
        signalingSocket.send(JSON.stringify({
          type: 'payment-confirmed',
          clientId: walletAddress,
          txHash: txHash
        }));
      }
    } catch (err) {
      console.error('Payment failed:', err);
      updateStatus('error', 'Payment Failed');
      setTimeout(() => {
        if (isConnected) {
          updateStatus('connected', `Connected: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`);
        }
      }, 2000);
    }
  }

  function handleKeyDown(e) {
    const speed = 15;
    switch (e.key) {
      case 'ArrowUp':
      case 'w':
        kart.vy = -Math.abs(kart.vy) - speed * 0.1;
        break;
      case 'ArrowDown':
      case 's':
        kart.vy = Math.abs(kart.vy) + speed * 0.1;
        break;
      case 'ArrowLeft':
      case 'a':
        kart.vx = -Math.abs(kart.vx) - speed * 0.1;
        break;
      case 'ArrowRight':
      case 'd':
        kart.vx = Math.abs(kart.vx) + speed * 0.1;
        break;
    }
  }

  function handleTouch(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvasEl.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    const centerX = canvasEl.width / 2;
    const centerY = canvasEl.height / 2;
    
    kart.vx = (x - centerX) * 0.02;
    kart.vy = (y - centerY) * 0.02;
  }

  function resizeCanvas() {
    canvasEl.width = window.innerWidth;
    canvasEl.height = window.innerHeight - 48;
  }

  function updateStatus(type, text) {
    statusEl.textContent = text;
    statusEl.className = type;
  }

  function startFallbackDemo() {
    if (animationId) return;
    
    kart.x = canvasEl.width / 2 - kart.width / 2;
    kart.y = canvasEl.height / 2 - kart.height / 2;
    kart.trail = [];
    
    animateFallback();
  }

  function stopFallbackDemo() {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }

  function animateFallback() {
    ctx.fillStyle = '#0b0f14';
    ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);

    drawTrack();
    
    kart.trail.push({ x: kart.x + kart.width / 2, y: kart.y + kart.height / 2 });
    if (kart.trail.length > 50) kart.trail.shift();
    
    drawTrail();
    
    kart.x += kart.vx;
    kart.y += kart.vy;
    
    if (kart.x <= 0 || kart.x + kart.width >= canvasEl.width) {
      kart.vx *= -0.95;
      kart.x = Math.max(0, Math.min(kart.x, canvasEl.width - kart.width));
    }
    if (kart.y <= 0 || kart.y + kart.height >= canvasEl.height) {
      kart.vy *= -0.95;
      kart.y = Math.max(0, Math.min(kart.y, canvasEl.height - kart.height));
    }
    
    kart.vx *= 0.995;
    kart.vy *= 0.995;
    
    const minSpeed = 1.5;
    if (Math.abs(kart.vx) < minSpeed && Math.abs(kart.vy) < minSpeed) {
      kart.vx = (Math.random() - 0.5) * 4;
      kart.vy = (Math.random() - 0.5) * 4;
    }
    
    drawKart();
    drawUI();
    
    animationId = requestAnimationFrame(animateFallback);
  }

  function drawTrack() {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2;
    
    const gridSize = 50;
    for (let x = 0; x < canvasEl.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasEl.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvasEl.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasEl.width, y);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(102, 126, 234, 0.3)';
    ctx.lineWidth = 4;
    const padding = 80;
    ctx.strokeRect(padding, padding, canvasEl.width - padding * 2, canvasEl.height - padding * 2);
  }

  function drawTrail() {
    for (let i = 0; i < kart.trail.length - 1; i++) {
      const alpha = i / kart.trail.length * 0.5;
      ctx.strokeStyle = `rgba(102, 126, 234, ${alpha})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(kart.trail[i].x, kart.trail[i].y);
      ctx.lineTo(kart.trail[i + 1].x, kart.trail[i + 1].y);
      ctx.stroke();
    }
  }

  function drawKart() {
    ctx.save();
    ctx.translate(kart.x + kart.width / 2, kart.y + kart.height / 2);
    
    const angle = Math.atan2(kart.vy, kart.vx);
    ctx.rotate(angle);

    const gradient = ctx.createLinearGradient(-kart.width / 2, 0, kart.width / 2, 0);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');
    ctx.fillStyle = gradient;
    
    ctx.beginPath();
    ctx.moveTo(kart.width / 2, 0);
    ctx.lineTo(-kart.width / 2, -kart.height / 2);
    ctx.lineTo(-kart.width / 3, 0);
    ctx.lineTo(-kart.width / 2, kart.height / 2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#45b7d1';
    ctx.beginPath();
    ctx.arc(kart.width / 4, 0, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#333';
    ctx.fillRect(-kart.width / 2 - 5, -kart.height / 2 - 5, 12, 10);
    ctx.fillRect(-kart.width / 2 - 5, kart.height / 2 - 5, 12, 10);

    ctx.restore();
  }

  function drawUI() {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CRYPTO KART', canvasEl.width / 2, 40);
    
    ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillText('Demo Mode - Connect wallet & join race for multiplayer', canvasEl.width / 2, 65);
    
    ctx.fillText('Arrow keys / WASD to control • Touch to steer', canvasEl.width / 2, canvasEl.height - 20);

    const speed = Math.sqrt(kart.vx * kart.vx + kart.vy * kart.vy);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.textAlign = 'left';
    ctx.fillText(`Speed: ${(speed * 10).toFixed(0)} km/h`, 20, canvasEl.height - 20);
  }

  init();
})();
