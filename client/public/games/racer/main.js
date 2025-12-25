(function() {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const lapEl = document.getElementById('lap');
  const timeEl = document.getElementById('time');
  const bestLapEl = document.getElementById('bestLap');
  const startBtn = document.getElementById('startBtn');
  const anchorBtn = document.getElementById('anchorBtn');
  const installBtn = document.getElementById('installBtn');

  let deferredInstallPrompt = null;

  const TRACK_POINTS = [
    { x: 0.5, y: 0.15 },
    { x: 0.85, y: 0.25 },
    { x: 0.9, y: 0.5 },
    { x: 0.8, y: 0.75 },
    { x: 0.5, y: 0.85 },
    { x: 0.2, y: 0.75 },
    { x: 0.1, y: 0.5 },
    { x: 0.15, y: 0.25 }
  ];

  let gameState = {
    isRacing: false,
    car: { x: 0, y: 0, angle: 0, speed: 0 },
    lap: 0,
    totalLaps: 3,
    lapStartTime: 0,
    raceStartTime: 0,
    bestLapTime: null,
    lapTimes: [],
    checkpoints: [],
    currentCheckpoint: 0,
    keys: { up: false, down: false, left: false, right: false },
    particles: []
  };

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => console.log('[Racer] SW registered:', reg.scope))
      .catch((err) => console.warn('[Racer] SW failed:', err));
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
    initTrack();
  }

  function initTrack() {
    const rect = canvas.getBoundingClientRect();
    gameState.checkpoints = TRACK_POINTS.map(p => ({
      x: p.x * rect.width,
      y: p.y * rect.height
    }));
    resetCar();
  }

  function resetCar() {
    const rect = canvas.getBoundingClientRect();
    gameState.car = {
      x: 0.5 * rect.width,
      y: 0.15 * rect.height + 30,
      angle: Math.PI / 2,
      speed: 0
    };
    gameState.currentCheckpoint = 0;
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  function startRace() {
    gameState.isRacing = true;
    gameState.lap = 0;
    gameState.lapTimes = [];
    gameState.raceStartTime = performance.now();
    gameState.lapStartTime = performance.now();
    resetCar();
    startBtn.textContent = 'Racing...';
    startBtn.disabled = true;
  }

  function completeLap() {
    const lapTime = (performance.now() - gameState.lapStartTime) / 1000;
    gameState.lapTimes.push(lapTime);
    gameState.lap++;

    if (gameState.bestLapTime === null || lapTime < gameState.bestLapTime) {
      gameState.bestLapTime = lapTime;
      bestLapEl.textContent = `Best: ${lapTime.toFixed(2)}s`;
    }

    if (gameState.lap >= gameState.totalLaps) {
      endRace();
    } else {
      gameState.lapStartTime = performance.now();
      gameState.currentCheckpoint = 0;
    }
  }

  function endRace() {
    gameState.isRacing = false;
    const totalTime = (performance.now() - gameState.raceStartTime) / 1000;
    startBtn.textContent = `${totalTime.toFixed(2)}s - Race Again`;
    startBtn.disabled = false;
  }

  function update() {
    if (!gameState.isRacing) return;

    const car = gameState.car;
    const friction = 0.98;
    const acceleration = 0.15;
    const turnSpeed = 0.05;
    const maxSpeed = 8;

    if (gameState.keys.up) {
      car.speed = Math.min(car.speed + acceleration, maxSpeed);
      if (Math.random() < 0.3) addParticle(car.x, car.y, '#ffd93d');
    }
    if (gameState.keys.down) {
      car.speed = Math.max(car.speed - acceleration * 0.5, -maxSpeed / 2);
    }

    if (gameState.keys.left) car.angle -= turnSpeed * (car.speed > 0 ? 1 : -1);
    if (gameState.keys.right) car.angle += turnSpeed * (car.speed > 0 ? 1 : -1);

    car.speed *= friction;
    car.x += Math.cos(car.angle) * car.speed;
    car.y += Math.sin(car.angle) * car.speed;

    const rect = canvas.getBoundingClientRect();
    car.x = Math.max(20, Math.min(rect.width - 20, car.x));
    car.y = Math.max(20, Math.min(rect.height - 20, car.y));

    const nextCheckpoint = gameState.checkpoints[(gameState.currentCheckpoint + 1) % gameState.checkpoints.length];
    const dx = car.x - nextCheckpoint.x;
    const dy = car.y - nextCheckpoint.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 50) {
      gameState.currentCheckpoint++;
      if (gameState.currentCheckpoint >= gameState.checkpoints.length) {
        completeLap();
      }
    }

    for (let i = gameState.particles.length - 1; i >= 0; i--) {
      const p = gameState.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.03;
      if (p.life <= 0) gameState.particles.splice(i, 1);
    }

    const currentTime = (performance.now() - gameState.lapStartTime) / 1000;
    timeEl.textContent = `Time: ${currentTime.toFixed(1)}s`;
    lapEl.textContent = `Lap: ${gameState.lap}/${gameState.totalLaps}`;
  }

  function addParticle(x, y, color) {
    gameState.particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      life: 1,
      color,
      size: 3 + Math.random() * 3
    });
  }

  function render() {
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);

    ctx.fillStyle = '#1a472a';
    ctx.fillRect(0, 0, rect.width, rect.height);

    ctx.strokeStyle = '#333';
    ctx.lineWidth = 80;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(gameState.checkpoints[0].x, gameState.checkpoints[0].y);
    for (let i = 1; i < gameState.checkpoints.length; i++) {
      ctx.lineTo(gameState.checkpoints[i].x, gameState.checkpoints[i].y);
    }
    ctx.closePath();
    ctx.stroke();

    ctx.strokeStyle = '#444';
    ctx.lineWidth = 70;
    ctx.stroke();

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.setLineDash([20, 20]);
    ctx.stroke();
    ctx.setLineDash([]);

    const nextIdx = (gameState.currentCheckpoint + 1) % gameState.checkpoints.length;
    const nextCp = gameState.checkpoints[nextIdx];
    ctx.beginPath();
    ctx.arc(nextCp.x, nextCp.y, 15, 0, Math.PI * 2);
    ctx.fillStyle = '#4ecdc4';
    ctx.fill();

    for (const p of gameState.particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    const car = gameState.car;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);

    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.moveTo(15, 0);
    ctx.lineTo(-10, -8);
    ctx.lineTo(-10, 8);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(8, 0, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    if (!gameState.isRacing) {
      ctx.font = '20px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText('Arrow keys to drive', rect.width / 2, rect.height / 2 - 20);
      ctx.fillText('Complete 3 laps!', rect.width / 2, rect.height / 2 + 10);
    }
  }

  function gameLoop() {
    update();
    render();
    requestAnimationFrame(gameLoop);
  }

  document.addEventListener('keydown', (e) => {
    switch(e.key) {
      case 'ArrowUp': case 'w': gameState.keys.up = true; break;
      case 'ArrowDown': case 's': gameState.keys.down = true; break;
      case 'ArrowLeft': case 'a': gameState.keys.left = true; break;
      case 'ArrowRight': case 'd': gameState.keys.right = true; break;
    }
  });

  document.addEventListener('keyup', (e) => {
    switch(e.key) {
      case 'ArrowUp': case 'w': gameState.keys.up = false; break;
      case 'ArrowDown': case 's': gameState.keys.down = false; break;
      case 'ArrowLeft': case 'a': gameState.keys.left = false; break;
      case 'ArrowRight': case 'd': gameState.keys.right = false; break;
    }
  });

  let touchStartX = 0;
  let touchStartY = 0;

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    gameState.keys.up = true;
  });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartX;
    gameState.keys.left = dx < -20;
    gameState.keys.right = dx > 20;
  });

  canvas.addEventListener('touchend', () => {
    gameState.keys = { up: false, down: false, left: false, right: false };
  });

  startBtn.addEventListener('click', startRace);

  anchorBtn.addEventListener('click', async () => {
    if (gameState.bestLapTime === null) {
      alert('Complete a race first to record a best lap time!');
      return;
    }

    const proofData = {
      game: 'mini-racer',
      bestLapTime: gameState.bestLapTime,
      lapTimes: gameState.lapTimes,
      totalLaps: gameState.lapTimes.length,
      timestamp: Date.now()
    };

    try {
      if (window.P3 && window.P3.proofs) {
        await window.P3.proofs.publish(proofData);
        alert(`Best lap ${gameState.bestLapTime.toFixed(2)}s anchored on-chain!`);
      } else {
        console.log('[Racer] Proof data:', proofData);
        alert(`Best lap ${gameState.bestLapTime.toFixed(2)}s recorded! (Demo mode)`);
      }
    } catch (err) {
      console.error('[Racer] Anchor failed:', err);
      alert('Failed to anchor proof: ' + err.message);
    }
  });

  console.log('[Mini Racer] Initialized');
  gameLoop();
})();
