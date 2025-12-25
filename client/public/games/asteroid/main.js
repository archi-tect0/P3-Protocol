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
  let score = 0;
  let highScore = parseInt(localStorage.getItem('asteroid_high_score') || '0');

  const ship = {
    x: 0,
    y: 0,
    width: 40,
    height: 50,
    speed: 8
  };

  let asteroids = [];
  let stars = [];
  let keys = {};

  function init() {
    registerServiceWorker();
    setupEventListeners();
    setupInstallPrompt();
    resizeCanvas();
    createStars();
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
    ship.x = canvas.width / 2 - ship.width / 2;
    ship.y = canvas.height - ship.height - 30;
  }

  function createStars() {
    stars = [];
    for (let i = 0; i < 100; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2 + 0.5,
        speed: Math.random() * 2 + 0.5
      });
    }
  }

  function resetGame() {
    score = 0;
    asteroids = [];
    ship.x = canvas.width / 2 - ship.width / 2;
    ship.y = canvas.height - ship.height - 30;
    updateStatus();
  }

  function toggleGame() {
    if (gameRunning) {
      gameRunning = false;
      startBtn.textContent = 'Start Game';
    } else {
      resetGame();
      gameRunning = true;
      startBtn.textContent = 'Stop Game';
      anchorGameStart();
    }
  }

  function anchorGameStart() {
    if (window.P3 && window.P3.anchor) {
      window.P3.anchor({
        type: 'game_start',
        game: 'asteroid_dodger',
        score: 0,
        timestamp: Date.now()
      });
    }
  }

  function spawnAsteroid() {
    if (!gameRunning) return;
    
    const size = Math.random() * 30 + 20;
    asteroids.push({
      x: Math.random() * (canvas.width - size),
      y: -size,
      size: size,
      speed: Math.random() * 3 + 2 + score / 100,
      rotation: 0,
      rotationSpeed: (Math.random() - 0.5) * 0.1
    });
  }

  function updateShip() {
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) {
      ship.x -= ship.speed;
    }
    if (keys['ArrowRight'] || keys['d'] || keys['D']) {
      ship.x += ship.speed;
    }
    if (keys['ArrowUp'] || keys['w'] || keys['W']) {
      ship.y -= ship.speed;
    }
    if (keys['ArrowDown'] || keys['s'] || keys['S']) {
      ship.y += ship.speed;
    }

    ship.x = Math.max(0, Math.min(ship.x, canvas.width - ship.width));
    ship.y = Math.max(0, Math.min(ship.y, canvas.height - ship.height));
  }

  function updateAsteroids() {
    for (let i = asteroids.length - 1; i >= 0; i--) {
      const asteroid = asteroids[i];
      asteroid.y += asteroid.speed;
      asteroid.rotation += asteroid.rotationSpeed;

      if (asteroid.y > canvas.height + asteroid.size) {
        asteroids.splice(i, 1);
        if (gameRunning) {
          score += 10;
          updateStatus();
        }
        continue;
      }

      if (gameRunning && checkCollision(ship, asteroid)) {
        gameOver();
      }
    }
  }

  function checkCollision(ship, asteroid) {
    const shipCenterX = ship.x + ship.width / 2;
    const shipCenterY = ship.y + ship.height / 2;
    const asteroidCenterX = asteroid.x + asteroid.size / 2;
    const asteroidCenterY = asteroid.y + asteroid.size / 2;
    
    const dx = shipCenterX - asteroidCenterX;
    const dy = shipCenterY - asteroidCenterY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    return distance < (ship.width / 2 + asteroid.size / 2) * 0.7;
  }

  function gameOver() {
    gameRunning = false;
    startBtn.textContent = 'Play Again';
    
    if (score > highScore) {
      highScore = score;
      localStorage.setItem('asteroid_high_score', highScore.toString());
      anchorScore(score);
    }
    
    statusEl.textContent = `Game Over! Score: ${score} | High: ${highScore}`;
  }

  function anchorScore(finalScore) {
    if (window.P3 && window.P3.anchor) {
      window.P3.anchor({
        type: 'game_over',
        game: 'asteroid_dodger',
        score: finalScore,
        timestamp: Date.now()
      });
    }
  }

  function updateStatus() {
    statusEl.textContent = `Score: ${score} | High: ${highScore}`;
  }

  function updateStars() {
    for (const star of stars) {
      star.y += star.speed;
      if (star.y > canvas.height) {
        star.y = 0;
        star.x = Math.random() * canvas.width;
      }
    }
  }

  let touchStartX = 0;
  function handleTouchStart(e) {
    e.preventDefault();
    touchStartX = e.touches[0].clientX;
  }

  function handleTouchMove(e) {
    e.preventDefault();
    const touchX = e.touches[0].clientX;
    const diff = touchX - touchStartX;
    ship.x += diff * 0.5;
    ship.x = Math.max(0, Math.min(ship.x, canvas.width - ship.width));
    touchStartX = touchX;
  }

  function draw() {
    ctx.fillStyle = '#0b0f14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'white';
    for (const star of stars) {
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const asteroid of asteroids) {
      ctx.save();
      ctx.translate(asteroid.x + asteroid.size / 2, asteroid.y + asteroid.size / 2);
      ctx.rotate(asteroid.rotation);
      
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, asteroid.size / 2);
      gradient.addColorStop(0, '#888');
      gradient.addColorStop(1, '#444');
      ctx.fillStyle = gradient;
      
      ctx.beginPath();
      const points = 8;
      for (let i = 0; i < points; i++) {
        const angle = (i / points) * Math.PI * 2;
        const radius = asteroid.size / 2 * (0.7 + Math.random() * 0.3);
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(ship.x + ship.width / 2, ship.y + ship.height / 2);
    
    const shipGradient = ctx.createLinearGradient(0, -ship.height / 2, 0, ship.height / 2);
    shipGradient.addColorStop(0, '#4ecdc4');
    shipGradient.addColorStop(1, '#44a08d');
    ctx.fillStyle = shipGradient;
    
    ctx.beginPath();
    ctx.moveTo(0, -ship.height / 2);
    ctx.lineTo(-ship.width / 2, ship.height / 2);
    ctx.lineTo(0, ship.height / 3);
    ctx.lineTo(ship.width / 2, ship.height / 2);
    ctx.closePath();
    ctx.fill();

    if (gameRunning) {
      ctx.fillStyle = '#ff6b6b';
      ctx.beginPath();
      ctx.moveTo(-ship.width / 4, ship.height / 2);
      ctx.lineTo(0, ship.height / 2 + 15 + Math.random() * 10);
      ctx.lineTo(ship.width / 4, ship.height / 2);
      ctx.closePath();
      ctx.fill();
    }
    
    ctx.restore();

    if (!gameRunning && score === 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = 'bold 32px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ASTEROID DODGER', canvas.width / 2, canvas.height / 2 - 40);
      ctx.font = '16px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText('Arrow keys / WASD to move • Dodge the asteroids!', canvas.width / 2, canvas.height / 2);
      ctx.fillText('Press "Start Game" to begin', canvas.width / 2, canvas.height / 2 + 30);
    }
  }

  let lastSpawn = 0;
  function gameLoop(timestamp = 0) {
    if (gameRunning) {
      updateShip();
      
      if (timestamp - lastSpawn > 1000 - Math.min(score * 2, 700)) {
        spawnAsteroid();
        lastSpawn = timestamp;
      }
    }
    
    updateAsteroids();
    updateStars();
    draw();
    
    animationId = requestAnimationFrame(gameLoop);
  }

  init();
})();
