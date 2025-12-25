(function() {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const statusEl = document.getElementById('status');
  const startBtn = document.getElementById('startBtn');
  const installBtn = document.getElementById('installBtn');

  let deferredPrompt = null;
  let animationId = null;
  let gameRunning = false;
  let coins = 0;
  let totalCoins = 0;
  let timeLeft = 60;
  let lastTime = 0;

  const player = {
    x: 0,
    y: 0,
    width: 40,
    height: 40,
    speed: 6,
    color: '#667eea'
  };

  let coinList = [];
  let particles = [];
  let keys = {};
  const milestones = [10, 25, 50, 100, 200];
  let achievedMilestones = new Set();

  function init() {
    registerServiceWorker();
    setupEventListeners();
    setupInstallPrompt();
    resizeCanvas();
    resetGame();
    gameLoop();
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('SW registered:', reg.scope))
        .catch(err => console.warn('SW registration failed:', err));
    }
  }

  function setupEventListeners() {
    startBtn.addEventListener('click', toggleGame);
    installBtn.addEventListener('click', handleInstall);
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('keydown', (e) => { keys[e.key] = true; e.preventDefault(); });
    window.addEventListener('keyup', (e) => { keys[e.key] = false; });
    
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
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
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.hidden = true;
  }

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight - 48;
    player.x = canvas.width / 2 - player.width / 2;
    player.y = canvas.height / 2 - player.height / 2;
  }

  function resetGame() {
    coins = 0;
    totalCoins = 0;
    timeLeft = 60;
    coinList = [];
    particles = [];
    achievedMilestones = new Set();
    player.x = canvas.width / 2 - player.width / 2;
    player.y = canvas.height / 2 - player.height / 2;
    spawnCoins(10);
    updateStatus();
  }

  function spawnCoins(count) {
    for (let i = 0; i < count; i++) {
      coinList.push({
        x: Math.random() * (canvas.width - 30) + 15,
        y: Math.random() * (canvas.height - 30) + 15,
        radius: 15,
        rotation: Math.random() * Math.PI * 2,
        value: Math.random() < 0.1 ? 5 : 1,
        pulse: 0
      });
    }
  }

  function toggleGame() {
    if (gameRunning) {
      gameRunning = false;
      startBtn.textContent = 'Start Game';
    } else {
      resetGame();
      gameRunning = true;
      lastTime = Date.now();
      startBtn.textContent = 'Stop Game';
      anchorGameStart();
    }
  }

  function anchorGameStart() {
    if (window.P3 && window.P3.anchor) {
      window.P3.anchor({
        type: 'game_start',
        game: 'coin_collector',
        coins: 0,
        timestamp: Date.now()
      });
    }
  }

  let touchTargetX = null;
  let touchTargetY = null;
  
  function handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    touchTargetX = touch.clientX - rect.left;
    touchTargetY = touch.clientY - rect.top;
  }

  function handleTouchMove(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    touchTargetX = touch.clientX - rect.left;
    touchTargetY = touch.clientY - rect.top;
  }

  function updatePlayer() {
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) {
      player.x -= player.speed;
    }
    if (keys['ArrowRight'] || keys['d'] || keys['D']) {
      player.x += player.speed;
    }
    if (keys['ArrowUp'] || keys['w'] || keys['W']) {
      player.y -= player.speed;
    }
    if (keys['ArrowDown'] || keys['s'] || keys['S']) {
      player.y += player.speed;
    }

    if (touchTargetX !== null && touchTargetY !== null) {
      const dx = touchTargetX - (player.x + player.width / 2);
      const dy = touchTargetY - (player.y + player.height / 2);
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > 5) {
        player.x += (dx / distance) * player.speed;
        player.y += (dy / distance) * player.speed;
      }
    }

    player.x = Math.max(0, Math.min(player.x, canvas.width - player.width));
    player.y = Math.max(0, Math.min(player.y, canvas.height - player.height));
  }

  function updateCoins() {
    for (let i = coinList.length - 1; i >= 0; i--) {
      const coin = coinList[i];
      coin.rotation += 0.05;
      coin.pulse = (coin.pulse + 0.1) % (Math.PI * 2);

      const dx = (player.x + player.width / 2) - coin.x;
      const dy = (player.y + player.height / 2) - coin.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < player.width / 2 + coin.radius) {
        coins += coin.value;
        totalCoins += coin.value;
        
        anchorCoinCollect(coin.value, totalCoins);
        
        for (let j = 0; j < 8; j++) {
          particles.push({
            x: coin.x,
            y: coin.y,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            life: 1,
            color: coin.value > 1 ? '#ffd93d' : '#f0c000'
          });
        }

        coinList.splice(i, 1);
        updateStatus();
        checkMilestones();
        
        if (coinList.length < 5) {
          spawnCoins(5);
        }
      }
    }
  }

  function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.03;
      p.vy += 0.2;
      
      if (p.life <= 0) {
        particles.splice(i, 1);
      }
    }
  }

  function checkMilestones() {
    for (const milestone of milestones) {
      if (totalCoins >= milestone && !achievedMilestones.has(milestone)) {
        achievedMilestones.add(milestone);
        anchorMilestone(milestone);
      }
    }
  }

  function anchorCoinCollect(value, total) {
    if (window.P3 && window.P3.anchor) {
      window.P3.anchor({
        type: 'coin_collect',
        game: 'coin_collector',
        value: value,
        totalCoins: total,
        timestamp: Date.now()
      });
    }
  }

  function anchorMilestone(milestone) {
    if (window.P3 && window.P3.anchor) {
      window.P3.anchor({
        type: 'coin_milestone',
        game: 'coin_collector',
        milestone: milestone,
        totalCoins: totalCoins,
        timestamp: Date.now()
      });
    }
  }

  function updateTimer() {
    if (!gameRunning) return;
    
    const now = Date.now();
    if (now - lastTime >= 1000) {
      timeLeft--;
      lastTime = now;
      updateStatus();
      
      if (timeLeft <= 0) {
        gameOver();
      }
    }
  }

  function gameOver() {
    gameRunning = false;
    startBtn.textContent = 'Play Again';
    statusEl.textContent = `Time's Up! Total: ${totalCoins} coins`;
    anchorFinalScore(totalCoins);
  }

  function anchorFinalScore(finalCoins) {
    if (window.P3 && window.P3.anchor) {
      window.P3.anchor({
        type: 'game_over',
        game: 'coin_collector',
        coins: finalCoins,
        score: finalCoins,
        timestamp: Date.now()
      });
    }
  }

  function updateStatus() {
    if (gameRunning) {
      statusEl.textContent = `Coins: ${coins} | Time: ${timeLeft}s`;
    } else if (totalCoins === 0) {
      statusEl.textContent = `Coins: 0`;
    }
  }

  function draw() {
    ctx.fillStyle = '#0b0f14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    for (const coin of coinList) {
      ctx.save();
      ctx.translate(coin.x, coin.y);
      
      const pulseScale = 1 + Math.sin(coin.pulse) * 0.1;
      ctx.scale(pulseScale, pulseScale);

      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, coin.radius);
      if (coin.value > 1) {
        gradient.addColorStop(0, '#ffd93d');
        gradient.addColorStop(1, '#f0a000');
      } else {
        gradient.addColorStop(0, '#f0c000');
        gradient.addColorStop(1, '#c09000');
      }
      ctx.fillStyle = gradient;
      
      ctx.beginPath();
      ctx.arc(0, 0, coin.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.arc(-coin.radius * 0.3, -coin.radius * 0.3, coin.radius * 0.3, 0, Math.PI * 2);
      ctx.fill();

      if (coin.value > 1) {
        ctx.fillStyle = '#1a1a2e';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('5', 0, 0);
      }
      
      ctx.restore();
    }

    for (const p of particles) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(player.x + player.width / 2, player.y + player.height / 2);
    
    const playerGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, player.width / 2);
    playerGradient.addColorStop(0, '#764ba2');
    playerGradient.addColorStop(1, '#667eea');
    ctx.fillStyle = playerGradient;
    
    ctx.beginPath();
    ctx.arc(0, 0, player.width / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.arc(-5, -5, 4, 0, Math.PI * 2);
    ctx.arc(5, -5, 4, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();

    if (!gameRunning && totalCoins === 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = 'bold 32px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('COIN COLLECTOR', canvas.width / 2, canvas.height / 2 - 40);
      ctx.font = '16px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText('Arrow keys / WASD to move • Collect as many coins as you can!', canvas.width / 2, canvas.height / 2);
      ctx.fillText('Press "Start Game" to begin', canvas.width / 2, canvas.height / 2 + 30);
    }
  }

  function gameLoop() {
    if (gameRunning) {
      updatePlayer();
      updateCoins();
      updateParticles();
      updateTimer();
    }
    draw();
    animationId = requestAnimationFrame(gameLoop);
  }

  init();
})();
