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
  let startTime = 0;
  let elapsedTime = 0;
  let bestTime = parseInt(localStorage.getItem('maze_best_time') || '999999');

  const mazeSize = 15;
  let cellSize = 30;
  let maze = [];
  let player = { x: 1, y: 1 };
  let exit = { x: mazeSize - 2, y: mazeSize - 2 };
  let keys = {};

  function init() {
    registerServiceWorker();
    setupEventListeners();
    setupInstallPrompt();
    resizeCanvas();
    generateMaze();
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
    startBtn.addEventListener('click', newGame);
    installBtn.addEventListener('click', handleInstall);
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('keydown', handleKeyDown);
    
    canvas.addEventListener('touchstart', handleTouch, { passive: false });
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
    cellSize = Math.min(
      Math.floor((canvas.width - 40) / mazeSize),
      Math.floor((canvas.height - 40) / mazeSize)
    );
  }

  function generateMaze() {
    maze = [];
    for (let y = 0; y < mazeSize; y++) {
      maze[y] = [];
      for (let x = 0; x < mazeSize; x++) {
        maze[y][x] = 1;
      }
    }

    const stack = [];
    const startX = 1;
    const startY = 1;
    maze[startY][startX] = 0;
    stack.push({ x: startX, y: startY });

    while (stack.length > 0) {
      const current = stack[stack.length - 1];
      const neighbors = getUnvisitedNeighbors(current.x, current.y);

      if (neighbors.length > 0) {
        const next = neighbors[Math.floor(Math.random() * neighbors.length)];
        maze[(current.y + next.y) / 2][(current.x + next.x) / 2] = 0;
        maze[next.y][next.x] = 0;
        stack.push(next);
      } else {
        stack.pop();
      }
    }

    maze[1][1] = 0;
    maze[mazeSize - 2][mazeSize - 2] = 0;
    
    player = { x: 1, y: 1 };
    exit = { x: mazeSize - 2, y: mazeSize - 2 };
  }

  function getUnvisitedNeighbors(x, y) {
    const neighbors = [];
    const directions = [
      { x: 0, y: -2 },
      { x: 2, y: 0 },
      { x: 0, y: 2 },
      { x: -2, y: 0 }
    ];

    for (const dir of directions) {
      const nx = x + dir.x;
      const ny = y + dir.y;
      if (nx > 0 && nx < mazeSize - 1 && ny > 0 && ny < mazeSize - 1 && maze[ny][nx] === 1) {
        neighbors.push({ x: nx, y: ny });
      }
    }

    return neighbors;
  }

  function newGame() {
    generateMaze();
    gameRunning = true;
    startTime = Date.now();
    startBtn.textContent = 'Restart';
    updateStatus();
  }

  function handleKeyDown(e) {
    if (!gameRunning) {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(e.key.toLowerCase())) {
        newGame();
      }
      return;
    }

    let newX = player.x;
    let newY = player.y;

    switch (e.key.toLowerCase()) {
      case 'arrowup':
      case 'w':
        newY--;
        break;
      case 'arrowdown':
      case 's':
        newY++;
        break;
      case 'arrowleft':
      case 'a':
        newX--;
        break;
      case 'arrowright':
      case 'd':
        newX++;
        break;
    }

    if (newX >= 0 && newX < mazeSize && newY >= 0 && newY < mazeSize && maze[newY][newX] === 0) {
      player.x = newX;
      player.y = newY;

      if (player.x === exit.x && player.y === exit.y) {
        gameComplete();
      }
    }

    e.preventDefault();
  }

  let lastTouchX = 0;
  let lastTouchY = 0;
  function handleTouch(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const touchX = touch.clientX - rect.left;
    const touchY = touch.clientY - rect.top;

    if (!gameRunning) {
      newGame();
      lastTouchX = touchX;
      lastTouchY = touchY;
      return;
    }

    const offsetX = canvas.width / 2 - (mazeSize * cellSize) / 2;
    const offsetY = canvas.height / 2 - (mazeSize * cellSize) / 2;
    
    const playerScreenX = offsetX + player.x * cellSize + cellSize / 2;
    const playerScreenY = offsetY + player.y * cellSize + cellSize / 2;

    const dx = touchX - playerScreenX;
    const dy = touchY - playerScreenY;

    let newX = player.x;
    let newY = player.y;

    if (Math.abs(dx) > Math.abs(dy)) {
      newX += dx > 0 ? 1 : -1;
    } else {
      newY += dy > 0 ? 1 : -1;
    }

    if (newX >= 0 && newX < mazeSize && newY >= 0 && newY < mazeSize && maze[newY][newX] === 0) {
      player.x = newX;
      player.y = newY;

      if (player.x === exit.x && player.y === exit.y) {
        gameComplete();
      }
    }
  }

  function gameComplete() {
    gameRunning = false;
    elapsedTime = Date.now() - startTime;
    
    if (elapsedTime < bestTime) {
      bestTime = elapsedTime;
      localStorage.setItem('maze_best_time', bestTime.toString());
      anchorTime(elapsedTime);
    }

    startBtn.textContent = 'New Maze';
    statusEl.textContent = `Complete! Time: ${formatTime(elapsedTime)} | Best: ${formatTime(bestTime)}`;
  }

  function anchorTime(time) {
    if (window.P3 && window.P3.anchor) {
      window.P3.anchor({
        type: 'maze_complete',
        game: 'maze_runner',
        time: time,
        timestamp: Date.now()
      });
    }
  }

  function formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  function updateStatus() {
    if (gameRunning) {
      elapsedTime = Date.now() - startTime;
      statusEl.textContent = `Time: ${formatTime(elapsedTime)} | Best: ${bestTime < 999999 ? formatTime(bestTime) : '--:--'}`;
    }
  }

  function draw() {
    ctx.fillStyle = '#0b0f14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const offsetX = canvas.width / 2 - (mazeSize * cellSize) / 2;
    const offsetY = canvas.height / 2 - (mazeSize * cellSize) / 2;

    for (let y = 0; y < mazeSize; y++) {
      for (let x = 0; x < mazeSize; x++) {
        const cellX = offsetX + x * cellSize;
        const cellY = offsetY + y * cellSize;

        if (maze[y][x] === 1) {
          ctx.fillStyle = '#2a3142';
          ctx.fillRect(cellX, cellY, cellSize, cellSize);
        } else {
          ctx.fillStyle = '#1a1f2e';
          ctx.fillRect(cellX, cellY, cellSize, cellSize);
        }

        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.strokeRect(cellX, cellY, cellSize, cellSize);
      }
    }

    const exitGradient = ctx.createRadialGradient(
      offsetX + exit.x * cellSize + cellSize / 2,
      offsetY + exit.y * cellSize + cellSize / 2,
      0,
      offsetX + exit.x * cellSize + cellSize / 2,
      offsetY + exit.y * cellSize + cellSize / 2,
      cellSize / 2
    );
    exitGradient.addColorStop(0, '#38ef7d');
    exitGradient.addColorStop(1, '#11998e');
    ctx.fillStyle = exitGradient;
    ctx.beginPath();
    ctx.arc(
      offsetX + exit.x * cellSize + cellSize / 2,
      offsetY + exit.y * cellSize + cellSize / 2,
      cellSize / 3,
      0, Math.PI * 2
    );
    ctx.fill();

    const playerGradient = ctx.createRadialGradient(
      offsetX + player.x * cellSize + cellSize / 2,
      offsetY + player.y * cellSize + cellSize / 2,
      0,
      offsetX + player.x * cellSize + cellSize / 2,
      offsetY + player.y * cellSize + cellSize / 2,
      cellSize / 2
    );
    playerGradient.addColorStop(0, '#667eea');
    playerGradient.addColorStop(1, '#764ba2');
    ctx.fillStyle = playerGradient;
    ctx.beginPath();
    ctx.arc(
      offsetX + player.x * cellSize + cellSize / 2,
      offsetY + player.y * cellSize + cellSize / 2,
      cellSize / 3,
      0, Math.PI * 2
    );
    ctx.fill();

    if (!gameRunning && elapsedTime === 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('MAZE RUNNER', canvas.width / 2, offsetY - 30);
      ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText('Arrow keys / WASD to move • Reach the green exit!', canvas.width / 2, offsetY - 10);
    }
  }

  function gameLoop() {
    if (gameRunning) {
      updateStatus();
    }
    draw();
    animationId = requestAnimationFrame(gameLoop);
  }

  init();
})();
