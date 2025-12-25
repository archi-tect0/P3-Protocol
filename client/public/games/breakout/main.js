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
  let level = 1;
  let lives = 3;

  const paddle = {
    width: 100,
    height: 15,
    x: 0,
    speed: 10
  };

  const ball = {
    x: 0,
    y: 0,
    radius: 10,
    dx: 4,
    dy: -4,
    speed: 5
  };

  let bricks = [];
  const brickRowCount = 5;
  const brickColumnCount = 8;
  const brickPadding = 10;
  const brickOffsetTop = 60;
  const brickOffsetLeft = 30;
  let brickWidth = 75;
  let brickHeight = 25;

  const colors = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#9b59b6'];
  let keys = {};

  function init() {
    registerServiceWorker();
    setupEventListeners();
    setupInstallPrompt();
    resizeCanvas();
    initBricks();
    resetBall();
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
    window.addEventListener('keydown', (e) => { keys[e.key] = true; });
    window.addEventListener('keyup', (e) => { keys[e.key] = false; });
    
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('mousemove', handleMouseMove);
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
    paddle.x = (canvas.width - paddle.width) / 2;
    
    brickWidth = (canvas.width - brickOffsetLeft * 2 - brickPadding * (brickColumnCount - 1)) / brickColumnCount;
    initBricks();
  }

  function initBricks() {
    bricks = [];
    for (let c = 0; c < brickColumnCount; c++) {
      bricks[c] = [];
      for (let r = 0; r < brickRowCount; r++) {
        bricks[c][r] = { 
          x: 0, 
          y: 0, 
          status: 1,
          color: colors[r % colors.length]
        };
      }
    }
  }

  function resetBall() {
    ball.x = canvas.width / 2;
    ball.y = canvas.height - 50;
    ball.dx = (Math.random() > 0.5 ? 1 : -1) * ball.speed;
    ball.dy = -ball.speed;
  }

  function toggleGame() {
    if (gameRunning) {
      gameRunning = false;
      startBtn.textContent = 'Start Game';
    } else {
      score = 0;
      level = 1;
      lives = 3;
      initBricks();
      resetBall();
      gameRunning = true;
      startBtn.textContent = 'Stop Game';
      updateStatus();
      anchorGameStart();
    }
  }

  function anchorGameStart() {
    if (window.P3 && window.P3.anchor) {
      window.P3.anchor({
        type: 'game_start',
        game: 'breakout',
        score: 0,
        level: 1,
        timestamp: Date.now()
      });
    }
  }

  function handleTouchMove(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    paddle.x = touch.clientX - rect.left - paddle.width / 2;
    paddle.x = Math.max(0, Math.min(paddle.x, canvas.width - paddle.width));
  }

  function handleMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    paddle.x = e.clientX - rect.left - paddle.width / 2;
    paddle.x = Math.max(0, Math.min(paddle.x, canvas.width - paddle.width));
  }

  function updatePaddle() {
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) {
      paddle.x -= paddle.speed;
    }
    if (keys['ArrowRight'] || keys['d'] || keys['D']) {
      paddle.x += paddle.speed;
    }
    paddle.x = Math.max(0, Math.min(paddle.x, canvas.width - paddle.width));
  }

  function updateBall() {
    if (!gameRunning) return;

    ball.x += ball.dx;
    ball.y += ball.dy;

    if (ball.x + ball.radius > canvas.width || ball.x - ball.radius < 0) {
      ball.dx = -ball.dx;
    }
    if (ball.y - ball.radius < 0) {
      ball.dy = -ball.dy;
    }

    if (ball.y + ball.radius > canvas.height - paddle.height - 10 &&
        ball.x > paddle.x && ball.x < paddle.x + paddle.width) {
      const hitPoint = (ball.x - paddle.x) / paddle.width;
      const angle = (hitPoint - 0.5) * Math.PI * 0.7;
      const speed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
      ball.dx = Math.sin(angle) * speed;
      ball.dy = -Math.abs(Math.cos(angle) * speed);
    }

    if (ball.y + ball.radius > canvas.height) {
      lives--;
      if (lives <= 0) {
        gameOver();
      } else {
        resetBall();
        updateStatus();
      }
    }
  }

  function checkBrickCollision() {
    for (let c = 0; c < brickColumnCount; c++) {
      for (let r = 0; r < brickRowCount; r++) {
        const brick = bricks[c][r];
        if (brick.status === 1) {
          const brickX = c * (brickWidth + brickPadding) + brickOffsetLeft;
          const brickY = r * (brickHeight + brickPadding) + brickOffsetTop;
          brick.x = brickX;
          brick.y = brickY;

          if (ball.x > brickX && ball.x < brickX + brickWidth &&
              ball.y > brickY && ball.y < brickY + brickHeight) {
            ball.dy = -ball.dy;
            brick.status = 0;
            score += 10 * level;
            updateStatus();

            if (checkLevelComplete()) {
              levelUp();
            }
          }
        }
      }
    }
  }

  function checkLevelComplete() {
    for (let c = 0; c < brickColumnCount; c++) {
      for (let r = 0; r < brickRowCount; r++) {
        if (bricks[c][r].status === 1) return false;
      }
    }
    return true;
  }

  function levelUp() {
    level++;
    ball.speed += 0.5;
    initBricks();
    resetBall();
    updateStatus();
    anchorLevelClear(level - 1);
  }

  function gameOver() {
    gameRunning = false;
    startBtn.textContent = 'Play Again';
    statusEl.textContent = `Game Over! Final Score: ${score}`;
    anchorScore(score);
  }

  function anchorLevelClear(clearedLevel) {
    if (window.P3 && window.P3.anchor) {
      window.P3.anchor({
        type: 'level_clear',
        game: 'breakout',
        level: clearedLevel,
        score: score,
        timestamp: Date.now()
      });
    }
  }

  function anchorScore(finalScore) {
    if (window.P3 && window.P3.anchor) {
      window.P3.anchor({
        type: 'game_over',
        game: 'breakout',
        score: finalScore,
        level: level,
        timestamp: Date.now()
      });
    }
  }

  function updateStatus() {
    statusEl.textContent = `Score: ${score} | Level: ${level} | Lives: ${'❤️'.repeat(lives)}`;
  }

  function draw() {
    ctx.fillStyle = '#0b0f14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let c = 0; c < brickColumnCount; c++) {
      for (let r = 0; r < brickRowCount; r++) {
        const brick = bricks[c][r];
        if (brick.status === 1) {
          const brickX = c * (brickWidth + brickPadding) + brickOffsetLeft;
          const brickY = r * (brickHeight + brickPadding) + brickOffsetTop;
          
          ctx.fillStyle = brick.color;
          ctx.beginPath();
          ctx.roundRect(brickX, brickY, brickWidth, brickHeight, 4);
          ctx.fill();
          
          ctx.strokeStyle = 'rgba(255,255,255,0.2)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    const paddleGradient = ctx.createLinearGradient(paddle.x, 0, paddle.x + paddle.width, 0);
    paddleGradient.addColorStop(0, '#667eea');
    paddleGradient.addColorStop(1, '#764ba2');
    ctx.fillStyle = paddleGradient;
    ctx.beginPath();
    ctx.roundRect(paddle.x, canvas.height - paddle.height - 10, paddle.width, paddle.height, 8);
    ctx.fill();

    const ballGradient = ctx.createRadialGradient(ball.x, ball.y, 0, ball.x, ball.y, ball.radius);
    ballGradient.addColorStop(0, '#ffffff');
    ballGradient.addColorStop(1, '#45b7d1');
    ctx.fillStyle = ballGradient;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();

    if (!gameRunning && score === 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = 'bold 32px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('BREAKOUT', canvas.width / 2, canvas.height / 2 - 40);
      ctx.font = '16px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText('Arrow keys / mouse to move paddle', canvas.width / 2, canvas.height / 2);
      ctx.fillText('Press "Start Game" to begin', canvas.width / 2, canvas.height / 2 + 30);
    }
  }

  function gameLoop() {
    updatePaddle();
    updateBall();
    checkBrickCollision();
    draw();
    animationId = requestAnimationFrame(gameLoop);
  }

  init();
})();
