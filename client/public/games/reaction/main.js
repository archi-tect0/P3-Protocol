(function() {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const bestTimeEl = document.getElementById('bestTime');
  const startBtn = document.getElementById('startBtn');
  const anchorBtn = document.getElementById('anchorBtn');
  const installBtn = document.getElementById('installBtn');

  let deferredInstallPrompt = null;
  let gameState = {
    isPlaying: false,
    isWaiting: false,
    targetVisible: false,
    targetX: 0,
    targetY: 0,
    targetRadius: 40,
    targetAppearTime: 0,
    score: 0,
    bestTime: null,
    reactionTimes: [],
    particles: [],
    ripples: []
  };

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => console.log('[Reaction] SW registered:', reg.scope))
      .catch((err) => console.warn('[Reaction] SW failed:', err));
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    installBtn.hidden = false;
  });

  installBtn.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installBtn.hidden = true;
  });

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  function startGame() {
    gameState.isPlaying = true;
    gameState.isWaiting = true;
    gameState.targetVisible = false;
    gameState.score = 0;
    updateScore();
    startBtn.textContent = 'Playing...';
    startBtn.disabled = true;

    const delay = 1000 + Math.random() * 3000;
    setTimeout(showTarget, delay);
  }

  function showTarget() {
    if (!gameState.isPlaying) return;

    const rect = canvas.getBoundingClientRect();
    const padding = gameState.targetRadius + 20;
    gameState.targetX = padding + Math.random() * (rect.width - padding * 2);
    gameState.targetY = padding + Math.random() * (rect.height - padding * 2);
    gameState.targetVisible = true;
    gameState.targetAppearTime = performance.now();
    gameState.isWaiting = false;
  }

  function handleClick(x, y) {
    if (!gameState.isPlaying) return;

    if (gameState.isWaiting) {
      gameState.isPlaying = false;
      gameState.isWaiting = false;
      startBtn.textContent = 'Too Early! Retry';
      startBtn.disabled = false;
      addRipple(x, y, '#ff6b6b');
      return;
    }

    if (!gameState.targetVisible) return;

    const dx = x - gameState.targetX;
    const dy = y - gameState.targetY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= gameState.targetRadius) {
      const reactionTime = Math.round(performance.now() - gameState.targetAppearTime);
      gameState.reactionTimes.push(reactionTime);
      gameState.score++;
      updateScore();

      if (gameState.bestTime === null || reactionTime < gameState.bestTime) {
        gameState.bestTime = reactionTime;
        bestTimeEl.textContent = `Best: ${reactionTime}ms`;
      }

      addParticles(gameState.targetX, gameState.targetY, '#4ecdc4');
      addRipple(gameState.targetX, gameState.targetY, '#4ecdc4');

      gameState.targetVisible = false;
      gameState.isWaiting = true;

      if (gameState.score < 10) {
        const delay = 500 + Math.random() * 2000;
        setTimeout(showTarget, delay);
      } else {
        endGame();
      }
    } else {
      addRipple(x, y, '#ff6b6b');
    }
  }

  function endGame() {
    gameState.isPlaying = false;
    gameState.targetVisible = false;

    const avgTime = Math.round(
      gameState.reactionTimes.reduce((a, b) => a + b, 0) / gameState.reactionTimes.length
    );

    startBtn.textContent = `Avg: ${avgTime}ms - Play Again`;
    startBtn.disabled = false;
  }

  function addParticles(x, y, color) {
    for (let i = 0; i < 20; i++) {
      const angle = (Math.PI * 2 * i) / 20;
      const speed = 2 + Math.random() * 4;
      gameState.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        color,
        size: 3 + Math.random() * 4
      });
    }
  }

  function addRipple(x, y, color) {
    gameState.ripples.push({ x, y, radius: 0, life: 1, color });
  }

  function updateScore() {
    scoreEl.textContent = `Score: ${gameState.score}/10`;
  }

  function update() {
    for (let i = gameState.particles.length - 1; i >= 0; i--) {
      const p = gameState.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1;
      p.life -= 0.02;
      if (p.life <= 0) gameState.particles.splice(i, 1);
    }

    for (let i = gameState.ripples.length - 1; i >= 0; i--) {
      const r = gameState.ripples[i];
      r.radius += 4;
      r.life -= 0.03;
      if (r.life <= 0) gameState.ripples.splice(i, 1);
    }
  }

  function render() {
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);

    ctx.fillStyle = '#0b0f14';
    ctx.fillRect(0, 0, rect.width, rect.height);

    for (const r of gameState.ripples) {
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = r.life * 0.5;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    if (gameState.targetVisible) {
      const pulse = 1 + Math.sin(performance.now() * 0.01) * 0.1;
      const radius = gameState.targetRadius * pulse;

      const gradient = ctx.createRadialGradient(
        gameState.targetX, gameState.targetY, 0,
        gameState.targetX, gameState.targetY, radius
      );
      gradient.addColorStop(0, '#ff6b6b');
      gradient.addColorStop(0.7, '#f5576c');
      gradient.addColorStop(1, 'rgba(245, 87, 108, 0)');

      ctx.beginPath();
      ctx.arc(gameState.targetX, gameState.targetY, radius * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(245, 87, 108, 0.2)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(gameState.targetX, gameState.targetY, radius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(gameState.targetX, gameState.targetY, radius * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }

    for (const p of gameState.particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (gameState.isWaiting && gameState.isPlaying) {
      ctx.font = '24px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText('Wait for the target...', rect.width / 2, rect.height / 2);
    }

    if (!gameState.isPlaying && gameState.score === 0) {
      ctx.font = '20px sans-serif';
      ctx.fillStyle = '#888';
      ctx.textAlign = 'center';
      ctx.fillText('Click Start to begin', rect.width / 2, rect.height / 2);
      ctx.fillText('Tap targets as fast as you can!', rect.width / 2, rect.height / 2 + 30);
    }
  }

  function gameLoop() {
    update();
    render();
    requestAnimationFrame(gameLoop);
  }

  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    handleClick(e.clientX - rect.left, e.clientY - rect.top);
  });

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    handleClick(touch.clientX - rect.left, touch.clientY - rect.top);
  });

  startBtn.addEventListener('click', startGame);

  anchorBtn.addEventListener('click', async () => {
    if (gameState.bestTime === null) {
      alert('Play a round first to record a best time!');
      return;
    }

    const proofData = {
      game: 'reaction-tapper',
      bestReactionTime: gameState.bestTime,
      averageTime: Math.round(
        gameState.reactionTimes.reduce((a, b) => a + b, 0) / gameState.reactionTimes.length
      ),
      totalRounds: gameState.reactionTimes.length,
      timestamp: Date.now()
    };

    try {
      if (window.P3 && window.P3.proofs) {
        await window.P3.proofs.publish(proofData);
        alert(`Best time ${gameState.bestTime}ms anchored on-chain!`);
      } else {
        console.log('[Reaction] Proof data:', proofData);
        alert(`Best time ${gameState.bestTime}ms recorded! (Demo mode)`);
      }
    } catch (err) {
      console.error('[Reaction] Anchor failed:', err);
      alert('Failed to anchor proof: ' + err.message);
    }
  });

  console.log('[Reaction Tapper] Initialized');
  gameLoop();
})();
