const boardEl = document.getElementById('board');
const diskCountEl = document.getElementById('diskCount');
const movesEl = document.getElementById('moves');
const timeEl = document.getElementById('time');
const minimumEl = document.getElementById('minimum');
const bestEl = document.getElementById('best');
const messageEl = document.getElementById('message');
const winDialog = document.getElementById('winDialog');
const winText = document.getElementById('winText');

const colors = ['#f04f30','#ff9f1c','#ffd21f','#9bdc28','#28d7ba','#27a9e8','#4050e8','#9235dc','#f238a7','#7d3cff'];
let pegs = [[], [], []];
let selectedPeg = null;
let moves = 0;
let elapsed = 0;
let timer = null;
let started = false;
let autoRunning = false;

function formatTime(totalSeconds) {
  const m = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const s = String(totalSeconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function currentDiskCount() { return Number(diskCountEl.value); }
function minimumMoves(n = currentDiskCount()) { return 2 ** n - 1; }
function bestKey() { return `hanoi-best-${currentDiskCount()}`; }

function startTimer() {
  if (started) return;
  started = true;
  timer = setInterval(() => {
    elapsed += 1;
    timeEl.textContent = formatTime(elapsed);
  }, 1000);
}

function stopTimer() {
  clearInterval(timer);
  timer = null;
}

function setMessage(text = '', type = '') {
  messageEl.textContent = text;
  messageEl.className = `message ${type}`.trim();
}

function updateBest() {
  const best = JSON.parse(localStorage.getItem(bestKey()) || 'null');
  bestEl.textContent = best ? `${best.moves} / ${formatTime(best.time)}` : '—';
}

function render() {
  document.querySelectorAll('.peg').forEach((pegEl, index) => {
    pegEl.classList.toggle('selected', index === selectedPeg);
    const stackEl = pegEl.querySelector('.stack');
    stackEl.innerHTML = '';
    pegs[index].forEach(size => {
      const disk = document.createElement('div');
      disk.className = 'disk';
      const max = currentDiskCount();
      disk.style.width = `${28 + (size / max) * 68}%`;
      disk.style.background = `linear-gradient(90deg, ${colors[(size - 1) % colors.length]}, #ffffff88 48%, ${colors[(size - 1) % colors.length]})`;
      disk.setAttribute('aria-label', `Disco ${size}`);
      stackEl.appendChild(disk);
    });
  });
  movesEl.textContent = moves;
}

function newGame() {
  autoRunning = false;
  stopTimer();
  const n = currentDiskCount();
  pegs = [Array.from({ length: n }, (_, i) => n - i), [], []];
  selectedPeg = null;
  moves = 0;
  elapsed = 0;
  started = false;
  movesEl.textContent = '0';
  timeEl.textContent = '00:00';
  minimumEl.textContent = minimumMoves(n);
  updateBest();
  setMessage('Sposta la torre dal piolo sinistro a quello destro.');
  render();
}

function canMove(from, to) {
  if (from === to || pegs[from].length === 0) return false;
  const disk = pegs[from][pegs[from].length - 1];
  const target = pegs[to][pegs[to].length - 1];
  return target === undefined || disk < target;
}

function performMove(from, to, countMove = true) {
  if (!canMove(from, to)) return false;
  pegs[to].push(pegs[from].pop());
  if (countMove) moves += 1;
  render();
  if (pegs[2].length === currentDiskCount()) finishGame();
  return true;
}

function handlePegClick(index) {
  if (autoRunning) return;
  startTimer();
  if (selectedPeg === null) {
    if (pegs[index].length === 0) {
      setMessage('Questo piolo è vuoto.', 'error');
      return;
    }
    selectedPeg = index;
    setMessage('Ora scegli il piolo di destinazione.');
    render();
    return;
  }

  if (index === selectedPeg) {
    selectedPeg = null;
    setMessage('Selezione annullata.');
    render();
    return;
  }

  if (!performMove(selectedPeg, index)) {
    setMessage('Mossa non consentita: un disco grande non può stare sopra uno più piccolo.', 'error');
    selectedPeg = null;
    render();
    return;
  }

  selectedPeg = null;
  setMessage('Mossa eseguita.', 'ok');
  render();
}

function finishGame() {
  stopTimer();
  autoRunning = false;
  const previous = JSON.parse(localStorage.getItem(bestKey()) || 'null');
  if (!previous || moves < previous.moves || (moves === previous.moves && elapsed < previous.time)) {
    localStorage.setItem(bestKey(), JSON.stringify({ moves, time: elapsed }));
  }
  updateBest();
  winText.textContent = `Hai completato il gioco in ${moves} mosse e ${formatTime(elapsed)}. Il minimo teorico è ${minimumMoves()}.`;
  winDialog.showModal();
}

function solveState(state) {
  const n = currentDiskCount();
  const target = Array.from({ length: n }, (_, i) => n - i);
  const queue = [{ state: state.map(p => [...p]), path: [] }];
  const seen = new Set([JSON.stringify(state)]);
  while (queue.length) {
    const node = queue.shift();
    if (JSON.stringify(node.state[2]) === JSON.stringify(target)) return node.path;
    for (let from = 0; from < 3; from++) {
      for (let to = 0; to < 3; to++) {
        if (from === to || node.state[from].length === 0) continue;
        const d = node.state[from][node.state[from].length - 1];
        const t = node.state[to][node.state[to].length - 1];
        if (t !== undefined && d > t) continue;
        const next = node.state.map(p => [...p]);
        next[to].push(next[from].pop());
        const key = JSON.stringify(next);
        if (!seen.has(key)) {
          seen.add(key);
          queue.push({ state: next, path: [...node.path, [from, to]] });
        }
      }
    }
  }
  return [];
}

function showHint() {
  if (autoRunning) return;
  const path = solveState(pegs);
  if (!path.length) return;
  const [from, to] = path[0];
  document.querySelectorAll('.peg')[from].classList.add('hint');
  document.querySelectorAll('.peg')[to].classList.add('hint');
  setTimeout(() => document.querySelectorAll('.peg').forEach(p => p.classList.remove('hint')), 1800);
  setMessage(`Suggerimento: sposta il disco dal piolo ${from + 1} al piolo ${to + 1}.`, 'ok');
}

async function autoSolve() {
  if (autoRunning) return;
  const path = solveState(pegs);
  if (!path.length) return;
  autoRunning = true;
  startTimer();
  setMessage('Soluzione automatica in corso…');
  for (const [from, to] of path) {
    if (!autoRunning) break;
    selectedPeg = from;
    render();
    await new Promise(r => setTimeout(r, 300));
    selectedPeg = null;
    performMove(from, to);
    await new Promise(r => setTimeout(r, 420));
  }
  autoRunning = false;
}

document.querySelectorAll('.peg').forEach((peg, index) => peg.addEventListener('click', () => handlePegClick(index)));
document.getElementById('newGameBtn').addEventListener('click', newGame);
document.getElementById('hintBtn').addEventListener('click', showHint);
document.getElementById('autoBtn').addEventListener('click', autoSolve);
diskCountEl.addEventListener('change', newGame);
document.getElementById('closeDialog').addEventListener('click', () => winDialog.close());
document.getElementById('fullscreenBtn').addEventListener('click', async () => {
  try {
    if (!document.fullscreenEnabled) return;
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  } catch (_) {
    setMessage('La modalità schermo intero non è disponibile in questo browser.', 'error');
  }
});

newGame();

const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const installHelp = document.getElementById('installHelp');
const fullscreenBtn = document.getElementById('fullscreenBtn');

if (isIOS && !isStandalone && installHelp) installHelp.hidden = false;
if (!document.fullscreenEnabled && fullscreenBtn) fullscreenBtn.hidden = true;
