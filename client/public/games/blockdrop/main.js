(function() {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const nextCanvas = document.getElementById('nextPiece');
  const nextCtx = nextCanvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const linesEl = document.getElementById('lines');
  const levelEl = document.getElementById('level');
  const startBtn = document.getElementById('startBtn');
  const anchorBtn = document.getElementById('anchorBtn');
  const installBtn = document.getElementById('installBtn');

  const leftBtn = document.getElementById('leftBtn');
  const rightBtn = document.getElementById('rightBtn');
  const rotateBtn = document.getElementById('rotateBtn');
  const downBtn = document.getElementById('downBtn');

  let deferredInstallPrompt = null;

  const COLS = 10;
  const ROWS = 20;
  let BLOCK = 24;

  const COLORS = {
    I: '#00f5ff',
    O: '#ffd93d',
    T: '#9b59b6',
    S: '#2ecc71',
    Z: '#e74c3c',
    J: '#3498db',
    L: '#e67e22'
  };

  const SHAPES = {
    I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    O: [[1, 1], [1, 1]],
    T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
    J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]]
  };

  const SHAPE_NAMES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

  let board = [];
  let currentPiece = null;
  let nextPiece = null;
  let score = 0;
  let lines = 0;
  let level = 1;
  let gameRunning = false;
  let gameOver = false;
  let lastDropTime = 0;
  let dropInterval = 1000;
  let animationId = null;

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => console.log('[BlockDrop] SW registered:', reg.scope))
      .catch((err) => console.warn('[BlockDrop] SW failed:', err));
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
    const container = document.getElementById('gameContainer');
    const rect = container.getBoundingClientRect();
    const maxHeight = rect.height - 40;
    const maxWidth = rect.width - 140;
    
    BLOCK = Math.floor(Math.min(maxHeight / ROWS, maxWidth / COLS));
    BLOCK = Math.max(16, Math.min(BLOCK, 32));

    canvas.width = COLS * BLOCK;
    canvas.height = ROWS * BLOCK;

    nextCanvas.width = 100;
    nextCanvas.height = 100;
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  function createBoard() {
    board = [];
    for (let r = 0; r < ROWS; r++) {
      board[r] = [];
      for (let c = 0; c < COLS; c++) {
        board[r][c] = null;
      }
    }
  }

  function getRandomPiece() {
    const name = SHAPE_NAMES[Math.floor(Math.random() * SHAPE_NAMES.length)];
    const shape = SHAPES[name].map(row => [...row]);
    return {
      name,
      shape,
      color: COLORS[name],
      x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
      y: 0
    };
  }

  function rotatePiece(piece) {
    const shape = piece.shape;
    const N = shape.length;
    const rotated = [];
    for (let i = 0; i < N; i++) {
      rotated[i] = [];
      for (let j = 0; j < N; j++) {
        rotated[i][j] = shape[N - 1 - j][i];
      }
    }
    return rotated;
  }

  function isValidMove(piece, offsetX = 0, offsetY = 0, newShape = null) {
    const shape = newShape || piece.shape;
    const newX = piece.x + offsetX;
    const newY = piece.y + offsetY;

    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c]) {
          const boardX = newX + c;
          const boardY = newY + r;

          if (boardX < 0 || boardX >= COLS || boardY >= ROWS) {
            return false;
          }

          if (boardY >= 0 && board[boardY][boardX] !== null) {
            return false;
          }
        }
      }
    }
    return true;
  }

  function lockPiece() {
    const shape = currentPiece.shape;
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c]) {
          const boardY = currentPiece.y + r;
          const boardX = currentPiece.x + c;
          if (boardY >= 0) {
            board[boardY][boardX] = currentPiece.color;
          }
        }
      }
    }
  }

  function clearLines() {
    let linesCleared = 0;

    for (let r = ROWS - 1; r >= 0; r--) {
      let full = true;
      for (let c = 0; c < COLS; c++) {
        if (board[r][c] === null) {
          full = false;
          break;
        }
      }

      if (full) {
        linesCleared++;
        board.splice(r, 1);
        const newRow = [];
        for (let c = 0; c < COLS; c++) {
          newRow[c] = null;
        }
        board.unshift(newRow);
        r++;
      }
    }

    if (linesCleared > 0) {
      const points = [0, 100, 300, 500, 800];
      score += points[linesCleared] * level;
      lines += linesCleared;
      level = Math.floor(lines / 10) + 1;
      dropInterval = Math.max(100, 1000 - (level - 1) * 100);
      updateUI();
    }

    return linesCleared;
  }

  function spawnPiece() {
    currentPiece = nextPiece || getRandomPiece();
    nextPiece = getRandomPiece();

    if (!isValidMove(currentPiece)) {
      endGame();
    }
  }

  function hardDrop() {
    if (!gameRunning || gameOver) return;

    let dropDistance = 0;
    while (isValidMove(currentPiece, 0, 1)) {
      currentPiece.y++;
      dropDistance++;
    }
    score += dropDistance * 2;
    
    lockPiece();
    clearLines();
    spawnPiece();
    updateUI();
  }

  function movePiece(dx, dy) {
    if (!gameRunning || gameOver) return;

    if (isValidMove(currentPiece, dx, dy)) {
      currentPiece.x += dx;
      currentPiece.y += dy;
      return true;
    }
    return false;
  }

  function rotate() {
    if (!gameRunning || gameOver) return;

    const rotated = rotatePiece(currentPiece);
    
    if (isValidMove(currentPiece, 0, 0, rotated)) {
      currentPiece.shape = rotated;
      return;
    }

    const kicks = [-1, 1, -2, 2];
    for (const kick of kicks) {
      if (isValidMove(currentPiece, kick, 0, rotated)) {
        currentPiece.x += kick;
        currentPiece.shape = rotated;
        return;
      }
    }
  }

  function startGame() {
    createBoard();
    score = 0;
    lines = 0;
    level = 1;
    dropInterval = 1000;
    gameRunning = true;
    gameOver = false;
    lastDropTime = performance.now();
    
    nextPiece = getRandomPiece();
    spawnPiece();
    updateUI();
    
    startBtn.textContent = 'Playing...';
    startBtn.disabled = true;
  }

  function endGame() {
    gameOver = true;
    gameRunning = false;
    startBtn.textContent = `Game Over - Score: ${score} - Play Again`;
    startBtn.disabled = false;
  }

  function updateUI() {
    scoreEl.textContent = `Score: ${score}`;
    linesEl.textContent = `Lines: ${lines}`;
    levelEl.textContent = `Level: ${level}`;
  }

  function drawBlock(context, x, y, color, size = BLOCK) {
    context.fillStyle = color;
    context.fillRect(x * size, y * size, size - 1, size - 1);

    context.fillStyle = 'rgba(255,255,255,0.3)';
    context.fillRect(x * size, y * size, size - 1, 3);
    context.fillRect(x * size, y * size, 3, size - 1);

    context.fillStyle = 'rgba(0,0,0,0.3)';
    context.fillRect(x * size, y * size + size - 4, size - 1, 3);
    context.fillRect(x * size + size - 4, y * size, 3, size - 1);
  }

  function drawBoard() {
    ctx.fillStyle = '#0b0f14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * BLOCK);
      ctx.lineTo(COLS * BLOCK, r * BLOCK);
      ctx.stroke();
    }
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * BLOCK, 0);
      ctx.lineTo(c * BLOCK, ROWS * BLOCK);
      ctx.stroke();
    }

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c] !== null) {
          drawBlock(ctx, c, r, board[r][c]);
        }
      }
    }
  }

  function drawPiece() {
    if (!currentPiece) return;

    const shape = currentPiece.shape;
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c]) {
          drawBlock(ctx, currentPiece.x + c, currentPiece.y + r, currentPiece.color);
        }
      }
    }

    let ghostY = currentPiece.y;
    while (isValidMove(currentPiece, 0, ghostY - currentPiece.y + 1)) {
      ghostY++;
    }

    if (ghostY > currentPiece.y) {
      ctx.globalAlpha = 0.3;
      for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
          if (shape[r][c]) {
            drawBlock(ctx, currentPiece.x + c, ghostY + r, currentPiece.color);
          }
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawNextPiece() {
    nextCtx.fillStyle = 'rgba(0,0,0,0.3)';
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

    if (!nextPiece) return;

    const shape = nextPiece.shape;
    const blockSize = 20;
    const offsetX = (nextCanvas.width - shape[0].length * blockSize) / 2;
    const offsetY = (nextCanvas.height - shape.length * blockSize) / 2;

    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c]) {
          nextCtx.fillStyle = nextPiece.color;
          nextCtx.fillRect(
            offsetX + c * blockSize,
            offsetY + r * blockSize,
            blockSize - 2,
            blockSize - 2
          );
        }
      }
    }
  }

  function drawGameOver() {
    if (!gameOver) return;

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 20);
    ctx.font = '16px sans-serif';
    ctx.fillText(`Score: ${score}`, canvas.width / 2, canvas.height / 2 + 10);
    ctx.fillText(`Lines: ${lines}`, canvas.width / 2, canvas.height / 2 + 35);
  }

  function drawStartScreen() {
    if (gameRunning || gameOver) return;

    ctx.fillStyle = '#0b0f14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BLOCK FALL', canvas.width / 2, canvas.height / 2 - 40);

    ctx.font = '14px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('← → to move', canvas.width / 2, canvas.height / 2);
    ctx.fillText('↑ to rotate', canvas.width / 2, canvas.height / 2 + 25);
    ctx.fillText('Space to drop', canvas.width / 2, canvas.height / 2 + 50);
    ctx.fillText('Press Start to begin', canvas.width / 2, canvas.height / 2 + 85);
  }

  function update(timestamp) {
    if (!gameRunning || gameOver) return;

    if (timestamp - lastDropTime > dropInterval) {
      if (!movePiece(0, 1)) {
        lockPiece();
        clearLines();
        spawnPiece();
      }
      lastDropTime = timestamp;
    }
  }

  function render() {
    drawBoard();
    drawPiece();
    drawNextPiece();
    drawGameOver();
    drawStartScreen();
  }

  function gameLoop(timestamp) {
    update(timestamp);
    render();
    animationId = requestAnimationFrame(gameLoop);
  }

  document.addEventListener('keydown', (e) => {
    if (!gameRunning || gameOver) return;

    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        e.preventDefault();
        movePiece(-1, 0);
        break;
      case 'ArrowRight':
      case 'KeyD':
        e.preventDefault();
        movePiece(1, 0);
        break;
      case 'ArrowDown':
      case 'KeyS':
        e.preventDefault();
        if (movePiece(0, 1)) {
          score += 1;
          updateUI();
        }
        break;
      case 'ArrowUp':
      case 'KeyW':
        e.preventDefault();
        rotate();
        break;
      case 'Space':
        e.preventDefault();
        hardDrop();
        break;
    }
  });

  if (leftBtn) leftBtn.addEventListener('click', () => movePiece(-1, 0));
  if (rightBtn) rightBtn.addEventListener('click', () => movePiece(1, 0));
  if (rotateBtn) rotateBtn.addEventListener('click', () => rotate());
  if (downBtn) downBtn.addEventListener('click', () => {
    if (movePiece(0, 1)) {
      score += 1;
      updateUI();
    }
  });

  let touchStartX = 0;
  let touchStartY = 0;

  canvas.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  canvas.addEventListener('touchend', (e) => {
    if (!gameRunning || gameOver) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const dx = touchEndX - touchStartX;
    const dy = touchEndY - touchStartY;
    const threshold = 30;

    if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) {
      rotate();
    } else if (Math.abs(dx) > Math.abs(dy)) {
      movePiece(dx > 0 ? 1 : -1, 0);
    } else if (dy > threshold) {
      hardDrop();
    }
  }, { passive: true });

  startBtn.addEventListener('click', startGame);

  anchorBtn.addEventListener('click', async () => {
    if (score === 0) {
      alert('Play a game first to record a score!');
      return;
    }

    const proofData = {
      game: 'blockdrop',
      score: score,
      lines: lines,
      level: level,
      timestamp: Date.now()
    };

    try {
      if (window.P3 && window.P3.proofs) {
        await window.P3.proofs.publish(proofData);
        alert(`Score ${score} anchored on-chain!`);
      } else {
        console.log('[BlockDrop] Proof data:', proofData);
        alert(`Score ${score} recorded! (Demo mode)`);
      }
    } catch (err) {
      console.error('[BlockDrop] Anchor failed:', err);
      alert('Failed to anchor proof: ' + err.message);
    }
  });

  console.log('[BlockDrop] Initialized');
  createBoard();
  gameLoop(performance.now());
})();
