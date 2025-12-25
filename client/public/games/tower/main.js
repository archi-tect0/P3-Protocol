(function() {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const heightEl = document.getElementById('height');
  const bestEl = document.getElementById('best');
  const comboEl = document.getElementById('combo');
  const startBtn = document.getElementById('startBtn');
  const anchorBtn = document.getElementById('anchorBtn');
  const installBtn = document.getElementById('installBtn');

  let deferredInstallPrompt = null;

  const COLORS = ['#ff6b6b', '#4ecdc4', '#ffd93d', '#f093fb', '#667eea', '#38ef7d'];

  let gameState = {
    isPlaying: false,
    blocks: [],
    movingBlock: null,
    blockWidth: 120,
    blockHeight: 30,
    speed: 2,
    direction: 1,
    height: 0,
    bestHeight: 0,
    combo: 0,
    particles: [],
    cameraY: 0,
    gameOver: false
  };

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => console.log('[Tower] SW registered:', reg.scope))
      .catch((err) => console.warn('[Tower] SW failed:', err));
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
    const rect = canvas.getBoundingClientRect();
    gameState = {
      isPlaying: true,
      blocks: [{
        x: rect.width / 2 - 60,
        y: rect.height - 50,
        width: 120,
        height: 30,
        color: COLORS[0]
      }],
      movingBlock: null,
      blockWidth: 120,
      blockHeight: 30,
      speed: 2,
      direction: 1,
      height: 0,
      bestHeight: gameState.bestHeight,
      combo: 0,
      particles: [],
      cameraY: 0,
      gameOver: false
    };
    spawnBlock();
    startBtn.textContent = 'Playing...';
    startBtn.disabled = true;
    updateUI();
  }

  function spawnBlock() {
    const rect = canvas.getBoundingClientRect();
    const topBlock = gameState.blocks[gameState.blocks.length - 1];
    const y = topBlock.y - gameState.blockHeight - 5;
    
    gameState.movingBlock = {
      x: 0,
      y: y,
      width: gameState.blockWidth,
      height: gameState.blockHeight,
      color: COLORS[(gameState.blocks.length) % COLORS.length]
    };
  }

  function dropBlock() {
    if (!gameState.movingBlock || gameState.gameOver) return;

    const moving = gameState.movingBlock;
    const top = gameState.blocks[gameState.blocks.length - 1];

    const overlapLeft = Math.max(moving.x, top.x);
    const overlapRight = Math.min(moving.x + moving.width, top.x + top.width);
    const overlapWidth = overlapRight - overlapLeft;

    if (overlapWidth <= 0) {
      endGame();
      return;
    }

    const perfectThreshold = 5;
    const isPerfect = Math.abs(moving.x - top.x) < perfectThreshold && 
                      Math.abs(moving.width - top.width) < perfectThreshold;

    if (isPerfect) {
      gameState.combo++;
      moving.x = top.x;
      moving.width = top.width;
      addParticles(moving.x + moving.width / 2, moving.y, '#ffd93d', 20);
    } else {
      gameState.combo = 0;
      
      if (moving.x < top.x) {
        addFallingPiece(moving.x, moving.y, top.x - moving.x, moving.height, moving.color);
      }
      if (moving.x + moving.width > top.x + top.width) {
        const excessStart = top.x + top.width;
        addFallingPiece(excessStart, moving.y, (moving.x + moving.width) - excessStart, moving.height, moving.color);
      }

      moving.x = overlapLeft;
      moving.width = overlapWidth;
    }

    gameState.blocks.push({
      x: moving.x,
      y: moving.y,
      width: moving.width,
      height: moving.height,
      color: moving.color
    });

    gameState.height = gameState.blocks.length - 1;
    gameState.blockWidth = moving.width;

    if (gameState.height > gameState.bestHeight) {
      gameState.bestHeight = gameState.height;
    }

    gameState.speed = Math.min(8, 2 + gameState.height * 0.1);

    updateUI();
    spawnBlock();
  }

  function addFallingPiece(x, y, width, height, color) {
    for (let i = 0; i < 5; i++) {
      gameState.particles.push({
        x: x + Math.random() * width,
        y: y + Math.random() * height,
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 2,
        size: 5 + Math.random() * 10,
        color: color,
        life: 1,
        gravity: 0.2
      });
    }
  }

  function addParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      gameState.particles.push({
        x, y,
        vx: Math.cos(angle) * (2 + Math.random() * 2),
        vy: Math.sin(angle) * (2 + Math.random() * 2) - 2,
        size: 4 + Math.random() * 4,
        color: color,
        life: 1,
        gravity: 0.1
      });
    }
  }

  function endGame() {
    gameState.gameOver = true;
    gameState.isPlaying = false;
    gameState.movingBlock = null;
    startBtn.textContent = `Height: ${gameState.height} - Play Again`;
    startBtn.disabled = false;
  }

  function updateUI() {
    heightEl.textContent = `Height: ${gameState.height}`;
    bestEl.textContent = `Best: ${gameState.bestHeight}`;
    comboEl.textContent = `Combo: x${gameState.combo + 1}`;
  }

  function update() {
    if (!gameState.isPlaying || !gameState.movingBlock) return;

    const rect = canvas.getBoundingClientRect();
    const moving = gameState.movingBlock;

    moving.x += gameState.speed * gameState.direction;

    if (moving.x + moving.width > rect.width) {
      moving.x = rect.width - moving.width;
      gameState.direction = -1;
    } else if (moving.x < 0) {
      moving.x = 0;
      gameState.direction = 1;
    }

    const targetCameraY = Math.max(0, (gameState.blocks.length - 5) * (gameState.blockHeight + 5));
    gameState.cameraY += (targetCameraY - gameState.cameraY) * 0.1;

    for (let i = gameState.particles.length - 1; i >= 0; i--) {
      const p = gameState.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.life -= 0.02;
      if (p.life <= 0 || p.y > rect.height + 50) {
        gameState.particles.splice(i, 1);
      }
    }
  }

  function render() {
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);

    const gradient = ctx.createLinearGradient(0, 0, 0, rect.height);
    gradient.addColorStop(0, '#0b0f14');
    gradient.addColorStop(1, '#1a1a2e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, rect.width, rect.height);

    ctx.save();
    ctx.translate(0, gameState.cameraY);

    for (const block of gameState.blocks) {
      ctx.fillStyle = block.color;
      ctx.fillRect(block.x, block.y, block.width, block.height);
      
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(block.x, block.y, block.width, 5);
      
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(block.x, block.y + block.height - 5, block.width, 5);
    }

    if (gameState.movingBlock) {
      const m = gameState.movingBlock;
      ctx.fillStyle = m.color;
      ctx.fillRect(m.x, m.y, m.width, m.height);
      
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(m.x, m.y, m.width, 5);

      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(m.x, m.y + m.height);
      ctx.lineTo(m.x, rect.height);
      ctx.moveTo(m.x + m.width, m.y + m.height);
      ctx.lineTo(m.x + m.width, rect.height);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    for (const p of gameState.particles) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    if (!gameState.isPlaying && !gameState.gameOver) {
      ctx.font = '20px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText('Press Space or Tap to drop blocks', rect.width / 2, rect.height / 2 - 20);
      ctx.fillText('Stack them perfectly for combos!', rect.width / 2, rect.height / 2 + 10);
    }

    if (gameState.combo > 0 && gameState.isPlaying) {
      ctx.font = 'bold 32px sans-serif';
      ctx.fillStyle = '#ffd93d';
      ctx.textAlign = 'center';
      ctx.fillText(`PERFECT x${gameState.combo}!`, rect.width / 2, 100);
    }
  }

  function gameLoop() {
    update();
    render();
    requestAnimationFrame(gameLoop);
  }

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      if (gameState.isPlaying) {
        dropBlock();
      }
    }
  });

  canvas.addEventListener('click', () => {
    if (gameState.isPlaying) {
      dropBlock();
    }
  });

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameState.isPlaying) {
      dropBlock();
    }
  });

  startBtn.addEventListener('click', startGame);

  anchorBtn.addEventListener('click', async () => {
    if (gameState.bestHeight === 0) {
      alert('Play a round first to record a best height!');
      return;
    }

    const proofData = {
      game: 'tower-builder',
      bestHeight: gameState.bestHeight,
      currentHeight: gameState.height,
      timestamp: Date.now()
    };

    try {
      if (window.P3 && window.P3.proofs) {
        await window.P3.proofs.publish(proofData);
        alert(`Best height ${gameState.bestHeight} anchored on-chain!`);
      } else {
        console.log('[Tower] Proof data:', proofData);
        alert(`Best height ${gameState.bestHeight} recorded! (Demo mode)`);
      }
    } catch (err) {
      console.error('[Tower] Anchor failed:', err);
      alert('Failed to anchor proof: ' + err.message);
    }
  });

  console.log('[Tower Builder] Initialized');
  gameLoop();
})();
