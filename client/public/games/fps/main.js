(function() {
  'use strict';

  const statusEl = document.getElementById('status');
  const connectBtn = document.getElementById('connectBtn');
  const buyBtn = document.getElementById('buyBtn');
  const squadBtn = document.getElementById('squadBtn');
  const installBtn = document.getElementById('installBtn');
  const gameVideo = document.getElementById('gameVideo');
  const fallbackCanvas = document.getElementById('fallbackCanvas');

  let peerConnection = null;
  let signalingSocket = null;
  let isConnected = false;
  let deferredInstallPrompt = null;

  const SIGNALING_URL = window.location.origin.replace(/^http/, 'ws') + '/signaling';

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => console.log('[Arena FPS] SW registered:', reg.scope))
      .catch((err) => console.warn('[Arena FPS] SW registration failed:', err));
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    installBtn.hidden = false;
  });

  installBtn.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    console.log('[Arena FPS] Install outcome:', outcome);
    deferredInstallPrompt = null;
    installBtn.hidden = true;
  });

  function updateStatus(text, className) {
    statusEl.textContent = text;
    statusEl.className = className || '';
  }

  async function connectWebRTC() {
    if (isConnected) {
      disconnectWebRTC();
      return;
    }

    updateStatus('Connecting...', '');
    document.body.classList.add('loading');

    try {
      signalingSocket = new WebSocket(SIGNALING_URL);

      signalingSocket.onopen = () => {
        console.log('[Arena FPS] Signaling connected');
        signalingSocket.send(JSON.stringify({ type: 'join', room: 'arena-fps' }));
      };

      signalingSocket.onmessage = async (event) => {
        const msg = JSON.parse(event.data);

        if (msg.type === 'offer') {
          await handleOffer(msg);
        } else if (msg.type === 'ice-candidate' && peerConnection) {
          try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(msg.candidate));
          } catch (e) {
            console.warn('[Arena FPS] Failed to add ICE candidate:', e);
          }
        } else if (msg.type === 'stream-unavailable') {
          console.log('[Arena FPS] Stream unavailable, using WebGL fallback');
          showFallback();
        }
      };

      signalingSocket.onerror = (err) => {
        console.error('[Arena FPS] Signaling error:', err);
        showFallback();
      };

      signalingSocket.onclose = () => {
        console.log('[Arena FPS] Signaling closed');
        if (isConnected) {
          showFallback();
        }
      };

      setTimeout(() => {
        if (!peerConnection || peerConnection.connectionState !== 'connected') {
          console.log('[Arena FPS] No stream available, showing WebGL fallback');
          showFallback();
        }
      }, 3000);

    } catch (err) {
      console.error('[Arena FPS] Connection failed:', err);
      showFallback();
    }
  }

  async function handleOffer(msg) {
    const config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    peerConnection = new RTCPeerConnection(config);

    peerConnection.ontrack = (event) => {
      console.log('[Arena FPS] Received track:', event.track.kind);
      if (event.streams && event.streams[0]) {
        gameVideo.srcObject = event.streams[0];
        gameVideo.classList.add('active');
        fallbackCanvas.classList.add('hidden');
        updateStatus('Streaming', 'streaming');
        document.body.classList.remove('loading');
      }
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate && signalingSocket.readyState === WebSocket.OPEN) {
        signalingSocket.send(JSON.stringify({
          type: 'ice-candidate',
          candidate: event.candidate
        }));
      }
    };

    peerConnection.onconnectionstatechange = () => {
      console.log('[Arena FPS] Connection state:', peerConnection.connectionState);
      if (peerConnection.connectionState === 'connected') {
        isConnected = true;
        connectBtn.textContent = 'Disconnect';
        connectBtn.classList.add('connected');
      } else if (peerConnection.connectionState === 'failed' || 
                 peerConnection.connectionState === 'disconnected') {
        showFallback();
      }
    };

    await peerConnection.setRemoteDescription(new RTCSessionDescription(msg.sdp));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    signalingSocket.send(JSON.stringify({
      type: 'answer',
      sdp: peerConnection.localDescription
    }));
  }

  function disconnectWebRTC() {
    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }
    if (signalingSocket) {
      signalingSocket.close();
      signalingSocket = null;
    }
    
    isConnected = false;
    gameVideo.srcObject = null;
    gameVideo.classList.remove('active');
    fallbackCanvas.classList.remove('hidden');
    
    connectBtn.textContent = 'Connect';
    connectBtn.classList.remove('connected');
    updateStatus('Disconnected', '');
    document.body.classList.remove('loading');
  }

  function showFallback() {
    isConnected = true;
    connectBtn.textContent = 'Disconnect';
    connectBtn.classList.add('connected');
    updateStatus('Connected (Demo)', 'connected');
    document.body.classList.remove('loading');
    
    gameVideo.classList.remove('active');
    fallbackCanvas.classList.remove('hidden');
    
    initWebGLFallback();
  }

  let gl = null;
  let animationId = null;
  let particleProgram = null;
  let particleBuffer = null;
  let numParticles = 0;
  let startTime = 0;

  function initWebGLFallback() {
    if (gl) return;

    gl = fallbackCanvas.getContext('webgl') || fallbackCanvas.getContext('experimental-webgl');
    if (!gl) {
      console.warn('[Arena FPS] WebGL not supported');
      fallbackCanvas.style.background = 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)';
      return;
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const vsSource = `
      attribute vec3 aPosition;
      attribute vec3 aVelocity;
      attribute float aSize;
      attribute vec3 aColor;
      
      uniform float uTime;
      uniform vec2 uResolution;
      
      varying vec3 vColor;
      varying float vAlpha;
      
      void main() {
        float t = uTime * 0.5;
        
        vec3 pos = aPosition;
        pos.x += sin(t + aPosition.y * 2.0) * 0.3 + aVelocity.x * t * 0.1;
        pos.y += cos(t + aPosition.x * 2.0) * 0.3 + aVelocity.y * t * 0.1;
        pos.z += sin(t * 0.5 + aPosition.x) * 0.5;
        
        pos = mod(pos + 1.5, 3.0) - 1.5;
        
        float depth = (pos.z + 1.5) / 3.0;
        float scale = 1.0 - depth * 0.5;
        
        gl_Position = vec4(pos.xy * scale, pos.z * 0.1, 1.0);
        gl_PointSize = aSize * (1.0 - depth * 0.7) * min(uResolution.x, uResolution.y) * 0.015;
        
        vColor = aColor;
        vAlpha = (1.0 - depth * 0.8) * (0.5 + 0.5 * sin(t * 2.0 + aPosition.x * 10.0));
      }
    `;

    const fsSource = `
      precision mediump float;
      
      varying vec3 vColor;
      varying float vAlpha;
      
      void main() {
        vec2 coord = gl_PointCoord - 0.5;
        float dist = length(coord);
        
        if (dist > 0.5) discard;
        
        float glow = 1.0 - dist * 2.0;
        glow = pow(glow, 1.5);
        
        gl_FragColor = vec4(vColor * glow, vAlpha * glow);
      }
    `;

    const vs = compileShader(gl.VERTEX_SHADER, vsSource);
    const fs = compileShader(gl.FRAGMENT_SHADER, fsSource);

    particleProgram = gl.createProgram();
    gl.attachShader(particleProgram, vs);
    gl.attachShader(particleProgram, fs);
    gl.linkProgram(particleProgram);

    if (!gl.getProgramParameter(particleProgram, gl.LINK_STATUS)) {
      console.error('[Arena FPS] Shader program failed:', gl.getProgramInfoLog(particleProgram));
      return;
    }

    numParticles = 2000;
    const particleData = new Float32Array(numParticles * 10);

    const colors = [
      [1.0, 0.4, 0.4],
      [0.4, 0.8, 1.0],
      [0.8, 0.4, 1.0],
      [0.4, 1.0, 0.6],
      [1.0, 0.8, 0.3]
    ];

    for (let i = 0; i < numParticles; i++) {
      const offset = i * 10;
      
      particleData[offset + 0] = (Math.random() - 0.5) * 3;
      particleData[offset + 1] = (Math.random() - 0.5) * 3;
      particleData[offset + 2] = (Math.random() - 0.5) * 3;
      
      particleData[offset + 3] = (Math.random() - 0.5) * 0.5;
      particleData[offset + 4] = (Math.random() - 0.5) * 0.5;
      particleData[offset + 5] = (Math.random() - 0.5) * 0.5;
      
      particleData[offset + 6] = 2 + Math.random() * 4;
      
      const color = colors[Math.floor(Math.random() * colors.length)];
      particleData[offset + 7] = color[0];
      particleData[offset + 8] = color[1];
      particleData[offset + 9] = color[2];
    }

    particleBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, particleBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, particleData, gl.STATIC_DRAW);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    startTime = performance.now();
    renderLoop();
  }

  function compileShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('[Arena FPS] Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    
    return shader;
  }

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = fallbackCanvas.getBoundingClientRect();
    
    fallbackCanvas.width = rect.width * dpr;
    fallbackCanvas.height = rect.height * dpr;
    
    if (gl) {
      gl.viewport(0, 0, fallbackCanvas.width, fallbackCanvas.height);
    }
  }

  function renderLoop() {
    if (!gl || fallbackCanvas.classList.contains('hidden')) {
      animationId = null;
      return;
    }

    gl.clearColor(0.043, 0.059, 0.078, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(particleProgram);

    const timeUniform = gl.getUniformLocation(particleProgram, 'uTime');
    const resolutionUniform = gl.getUniformLocation(particleProgram, 'uResolution');
    
    const elapsed = (performance.now() - startTime) / 1000;
    gl.uniform1f(timeUniform, elapsed);
    gl.uniform2f(resolutionUniform, fallbackCanvas.width, fallbackCanvas.height);

    gl.bindBuffer(gl.ARRAY_BUFFER, particleBuffer);

    const posAttr = gl.getAttribLocation(particleProgram, 'aPosition');
    const velAttr = gl.getAttribLocation(particleProgram, 'aVelocity');
    const sizeAttr = gl.getAttribLocation(particleProgram, 'aSize');
    const colorAttr = gl.getAttribLocation(particleProgram, 'aColor');

    const stride = 10 * 4;
    
    gl.enableVertexAttribArray(posAttr);
    gl.vertexAttribPointer(posAttr, 3, gl.FLOAT, false, stride, 0);
    
    gl.enableVertexAttribArray(velAttr);
    gl.vertexAttribPointer(velAttr, 3, gl.FLOAT, false, stride, 12);
    
    gl.enableVertexAttribArray(sizeAttr);
    gl.vertexAttribPointer(sizeAttr, 1, gl.FLOAT, false, stride, 24);
    
    gl.enableVertexAttribArray(colorAttr);
    gl.vertexAttribPointer(colorAttr, 3, gl.FLOAT, false, stride, 28);

    gl.drawArrays(gl.POINTS, 0, numParticles);

    animationId = requestAnimationFrame(renderLoop);
  }

  connectBtn.addEventListener('click', () => {
    if (isConnected) {
      disconnectWebRTC();
      if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
      gl = null;
    } else {
      connectWebRTC();
    }
  });

  buyBtn.addEventListener('click', async () => {
    if (typeof window.ethereum === 'undefined') {
      alert('Please install a Web3 wallet like MetaMask to purchase weapon packs!');
      return;
    }

    try {
      buyBtn.disabled = true;
      buyBtn.textContent = 'Processing...';

      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const from = accounts[0];

      const txParams = {
        from: from,
        to: '0x0000000000000000000000000000000000000000',
        value: '0x71afd498d0000',
        gas: '0x5208'
      };

      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [txParams]
      });

      console.log('[Arena FPS] Weapon pack purchase tx:', txHash);
      alert('Weapon pack purchased! TX: ' + txHash.slice(0, 10) + '...');

    } catch (err) {
      console.error('[Arena FPS] Purchase failed:', err);
      if (err.code !== 4001) {
        alert('Purchase failed: ' + (err.message || 'Unknown error'));
      }
    } finally {
      buyBtn.disabled = false;
      buyBtn.textContent = 'Buy Weapon Pack (0.002 ETH)';
    }
  });

  squadBtn.addEventListener('click', () => {
    alert('Squad Chat coming soon! Join your teammates in voice chat during matches.');
  });

  updateStatus('Demo Mode', 'connected');
  console.log('[Arena FPS] Initialized');
  
  // Auto-start WebGL fallback demo on load
  initWebGLFallback();

})();
