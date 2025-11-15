(() => {
  const SIZE = 4;
  const boardEl = document.getElementById('board');
  const tileLayer = document.getElementById('tileLayer');
  const scoreEl = document.getElementById('score');
  const undoBtn = document.getElementById('undoBtn');
  const restartBtn = document.getElementById('restartBtn');
  const leaderBtn = document.getElementById('leaderBtn');
  const leaderBackdrop = document.getElementById('leaderBackdrop');
  const leaderTableBody = document.querySelector('#leaderTable tbody');
  const closeLeader = document.getElementById('closeLeader');
  const clearLeader = document.getElementById('clearLeader');
  const mobileControls = document.getElementById('mobileControls');

  const gameOverOverlay = document.getElementById('gameOverOverlay');
  const saveRow = document.getElementById('saveRow');
  const savedMsg = document.getElementById('savedMsg');
  const playerName = document.getElementById('playerName');
  const saveScoreBtn = document.getElementById('saveScoreBtn');
  const restartAfterGame = document.getElementById('restartAfterGame');

  const KEY_STATE = 'lab2048_state_v1';
  const KEY_LEAD = 'lab2048_leader_v1';

  let grid = createEmpty();
  let score = 0;
  let prevState = null;
  let gameOver = false;

  // Создание пустого игрового поля
  function createEmpty() {
    return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  }

  // Сохраняем состояние игры
  function saveState() {
    localStorage.setItem(KEY_STATE, JSON.stringify({ grid, score, gameOver }));
  }

  // Загружаем состояние игры
  function loadState() {
    try {
      const data = JSON.parse(localStorage.getItem(KEY_STATE));
      if (!data) return false;
      grid = data.grid || createEmpty();
      score = data.score || 0;
      gameOver = data.gameOver || false;
      return true;
    } catch { return false; }
  }

  // Сохраняем результат в таблицу лидеров
  function saveLeaderboardEntry(name, score) {
    if (!name) name = 'Аноним';
    const dt = new Date().toLocaleString();
    const arr = JSON.parse(localStorage.getItem(KEY_LEAD) || '[]');
    arr.push({ name, score, date: dt });
    arr.sort((a, b) => b.score - a.score);
    while (arr.length > 10) arr.pop();
    localStorage.setItem(KEY_LEAD, JSON.stringify(arr));
  }

  // Отображение таблицы лидеров
  function renderLeader() {
    while (leaderTableBody.firstChild) leaderTableBody.removeChild(leaderTableBody.firstChild);

    const arr = JSON.parse(localStorage.getItem(KEY_LEAD) || '[]');
    arr.forEach((r, i) => {
      const tr = document.createElement('tr');

      const tdIndex = document.createElement('td');
      tdIndex.textContent = i + 1;
      tr.appendChild(tdIndex);

      const tdName = document.createElement('td');
      tdName.textContent = r.name;
      tr.appendChild(tdName);

      const tdScore = document.createElement('td');
      tdScore.textContent = r.score;
      tr.appendChild(tdScore);

      const tdDate = document.createElement('td');
      tdDate.textContent = r.date;
      tr.appendChild(tdDate);

      leaderTableBody.appendChild(tr);
    });
  }

  // Функция сборки фона (ячейки)
  function buildBackground() {
    while (boardEl.firstChild) boardEl.removeChild(boardEl.firstChild);

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const div = document.createElement('div');
        div.className = 'cell';
        boardEl.appendChild(div);
      }
    }
  }

  // Получаем позицию ячейки для плитки
  function cellRect(r, c) {
    const style = getComputedStyle(boardEl);
    const gap = parseFloat(style.gap);
    const boardWidth = boardEl.clientWidth;
    const cellW = (boardWidth - gap * (SIZE - 1)) / SIZE;
    const x = c * (cellW + gap);
    const y = r * (cellW + gap);
    return { x, y, w: cellW };
  }

  // Отрисовка плиток
  function renderTiles() {
    while (tileLayer.firstChild) tileLayer.removeChild(tileLayer.firstChild);

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const v = grid[r][c];
        if (!v) continue;

        const tile = document.createElement('div');
        tile.className = 'tile';
        tile.dataset.value = v;
        tile.textContent = v;

        const rect = cellRect(r, c);
        tile.style.width = rect.w + 'px';
        tile.style.height = rect.w + 'px';
        tile.style.transform = `translate(${rect.x}px, ${rect.y}px)`;

        tileLayer.appendChild(tile);
      }
    }
  }

  // Генератор случайных чисел
  function randomInt(max) { return Math.floor(Math.random() * max); }

  // Спавн случайных плиток
  function spawnRandom(count=1) {
    const empties = [];
    for (let r=0; r<SIZE; r++) for (let c=0; c<SIZE; c++) if (!grid[r][c]) empties.push([r,c]);
    if (empties.length === 0) return;
    count = Math.min(count, empties.length);
    for (let i=0; i<count; i++) {
      const idx = randomInt(empties.length);
      const [r,c] = empties.splice(idx,1)[0];
      grid[r][c] = Math.random() < 0.9 ? 2 : 4;
    }
    renderTiles();
  }

  // Инициализация доски
  function initBoard() {
    buildBackground();
    if (!loadState()) {
      grid = createEmpty();
      score = 0;
      gameOver = false;
      spawnRandom(randomInt(3)+1);
    }
    render();
  }

  // Отрисовка счета и плиток
  function render() {
    scoreEl.textContent = score;
    renderTiles();
    saveState();
  }

  // Поворот сетки
  function rotateGrid(times) {
    for (let t=0; t<times; t++) {
      const newG = createEmpty();
      for (let r=0; r<SIZE; r++) for (let c=0; c<SIZE; c++) newG[c][SIZE-1-r] = grid[r][c];
      grid = newG;
    }
  }

  // Сжатие и слияние ряда
  function compressAndMergeRow(row) {
    const newRow = row.filter(v => v);
    let points = 0;
    for (let i=0; i<newRow.length-1; i++) {
      if (newRow[i] === newRow[i+1]) {
        newRow[i] *= 2;
        points += newRow[i];
        newRow.splice(i+1,1);
      }
    }
    while(newRow.length < SIZE) newRow.push(0);
    return { row: newRow, points };
  }

  // Проверка возможности хода
  function canMove() {
    for (let r=0; r<SIZE; r++) for (let c=0; c<SIZE; c++) {
      if(grid[r][c] === 0) return true;
      if(r+1<SIZE && grid[r+1][c]===grid[r][c]) return true;
      if(c+1<SIZE && grid[r][c+1]===grid[r][c]) return true;
    }
    return false;
  }

function move(direction) {
  if (gameOver) return;
  const dirMap = { left:0, down:1, right:2, up:3 };
  const times = dirMap[direction];
  prevState = { grid: grid.map(r=>r.slice()), score };

  rotateGrid(times);

  let moved = false, gained = 0;
  for (let r=0; r<SIZE; r++) {
    const { row, points } = compressAndMergeRow(grid[r]);
    for(let c=0;c<SIZE;c++) if(grid[r][c]!==row[c]) moved=true;
    grid[r] = row;
    gained += points;
  }

  rotateGrid((4-times)%4);

  if (moved) {
    score += gained;
    spawnRandom(Math.random()<0.25?2:1);
    render();

    for (let r=0;r<SIZE;r++) {
      for (let c=0;c<SIZE;c++) {
        if(grid[r][c] === 2048) {
          endGame();
          return; // игра закончилась
        }
      }
    }

    if (!canMove()) endGame();
  }
}


  // Конец игры
  function endGame() {
    gameOver = true;
    saveState();
    gameOverOverlay.classList.remove('hidden');
    saveRow.classList.remove('hidden');
    savedMsg.classList.add('hidden');
    mobileControls.style.display = 'none';
  }

  function hideGameOver() {
    gameOverOverlay.classList.add('hidden');
    mobileControls.style.display = '';
  }

  // Отмена хода
  function undo() {
    if (!prevState || gameOver) return;
    grid = prevState.grid.map(r=>r.slice());
    score = prevState.score;
    prevState = null;
    render();
  }

  // Клавиатура
  document.addEventListener('keydown', e => {
    const keys = { ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right' };
    if(keys[e.key]) { e.preventDefault(); move(keys[e.key]); }
    if(e.key==='z' && (e.ctrlKey||e.metaKey)) undo();
  });

  // Мобильные кнопки
  mobileControls.addEventListener('click', e => {
    const btn = e.target.closest('.dir-btn');
    if(!btn || leaderBackdrop.style.display==='flex') return;
    move(btn.dataset.dir);
  });

  // Свайпы
  let touchStart = null;
  tileLayer.addEventListener('touchstart', e => { if(e.touches.length===1) touchStart = {x:e.touches[0].clientX,y:e.touches[0].clientY}; });
  tileLayer.addEventListener('touchend', e => {
    if(!touchStart) return;
    const dx = e.changedTouches[0].clientX - touchStart.x;
    const dy = e.changedTouches[0].clientY - touchStart.y;
    if(Math.abs(dx)<30 && Math.abs(dy)<30) return;
    move(Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up'));
    touchStart=null;
  });

  // Кнопки управления
  undoBtn.addEventListener('click', undo);
  restartBtn.addEventListener('click', ()=>{
    if(confirm('Начать новую игру?')) { grid=createEmpty(); score=0; prevState=null; gameOver=false; spawnRandom(randomInt(3)+1); render(); hideGameOver(); }
  });

  leaderBtn.addEventListener('click', ()=>{ renderLeader(); leaderBackdrop.classList.remove('hidden'); mobileControls.style.display='none'; });
  closeLeader.addEventListener('click', ()=>{ leaderBackdrop.classList.add('hidden'); mobileControls.style.display=''; });
  clearLeader.addEventListener('click', ()=>{ if(confirm('Очистить таблицу лидеров?')) { localStorage.removeItem(KEY_LEAD); renderLeader(); } });

  saveScoreBtn.addEventListener('click', ()=>{
    const name = playerName.value.trim() || 'Аноним';
    saveLeaderboardEntry(name, score);
    saveRow.classList.add('hidden');
    savedMsg.classList.remove('hidden');
    renderLeader();
  });

  restartAfterGame.addEventListener('click', ()=>{ grid=createEmpty(); score=0; prevState=null; gameOver=false; spawnRandom(randomInt(3)+1); render(); hideGameOver(); });

  renderLeader();
  window.addEventListener('resize', render);
  initBoard();
})();
