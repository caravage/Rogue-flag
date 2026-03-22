// js/game.js
// Game logic for the flag quiz

const MAX_ATTEMPTS = 3;
const FLAG_BASE_URL = "https://flagcdn.com/w320/";

let questions = [];
let current = 0;
let scoreCorrect = 0;
let scoreWrong = 0;
let streak = 0;
let bestStreak = 0;
let skipped = 0;
let attemptsLeft = MAX_ATTEMPTS;
let answered = false;
let totalQuestions = 20;
let currentCategory = null;
let history = []; // { code, name, status: "ok"|"ko"|"skip", userAnswer }

// ===== Utility =====

function normalize(s) {
  return s.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, "")
    .trim();
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] !== b[j - 1] ? 1 : 0)
      );
  return dp[m][n];
}

function isCloseEnough(input, target) {
  const ni = normalize(input);
  const nt = normalize(target);
  if (!ni) return false;
  if (ni === nt) return true;
  if (nt.includes(ni) || ni.includes(nt)) return true;
  return levenshtein(ni, nt) <= Math.max(1, Math.floor(nt.length * 0.3));
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function cap(s) {
  return s.split(/[\s-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(s.includes('-') ? '-' : ' ');
}

function flagUrl(code) {
  return FLAG_BASE_URL + code + ".png";
}

// ===== DOM helpers =====

function $(id) { return document.getElementById(id); }

function updateAttemptDots() {
  document.querySelectorAll('#attemptsBar .attempt-dot').forEach((d, i) => {
    d.className = 'attempt-dot';
    d.classList.add(i < attemptsLeft ? 'available' : 'used');
  });
}

function updateScore() {
  $('scoreCorrect').textContent = scoreCorrect;
  $('scoreWrong').textContent = scoreWrong;
  $('scoreStreak').textContent = streak;
}

function lockQuestion() {
  $('answerInput').disabled = true;
  $('submitBtn').disabled = true;
  $('hintBtn').style.display = 'none';
  $('skipBtn').style.display = 'none';
  $('nextBtn').style.display = 'block';
  $('nextHint').style.display = 'block';
}

// ===== Menu =====

function buildMenu() {
  const grid = $('catGrid');
  grid.innerHTML = '';
  CATEGORIES.forEach((cat, i) => {
    const count = cat.filter().length;
    const btn = document.createElement('div');
    btn.className = 'cat-btn fade-in';
    btn.style.animationDelay = (i * 0.06) + 's';
    btn.innerHTML = `
      <div class="cat-icon">${cat.icon}</div>
      <div class="cat-info">
        <div class="cat-name">${cat.name}</div>
        <div class="cat-count">${count} pays</div>
      </div>
      <div class="cat-arrow">→</div>
    `;
    btn.onclick = () => startGame(cat.id);
    grid.appendChild(btn);
  });
}

function showMenu() {
  $('menuScreen').style.display = '';
  $('gameZone').style.display = 'none';
  buildMenu();
}

// ===== Game =====

function startGame(catId) {
  currentCategory = catId;
  const cat = CATEGORIES.find(c => c.id === catId);
  const pool = cat.filter();
  totalQuestions = Math.min(20, pool.length);
  questions = shuffle([...pool]).slice(0, totalQuestions);
  current = 0;
  scoreCorrect = 0;
  scoreWrong = 0;
  streak = 0;
  bestStreak = 0;
  skipped = 0;
  answered = false;
  history = [];

  $('menuScreen').style.display = 'none';
  $('gameZone').style.display = 'block';
  $('endScreen').style.display = 'none';
  $('gameCard').style.display = 'block';
  $('totalQ').textContent = totalQuestions;
  $('catTag').textContent = cat.icon + ' ' + cat.name;

  updateScore();
  loadQuestion();
}

function loadQuestion() {
  answered = false;
  attemptsLeft = MAX_ATTEMPTS;
  const q = questions[current];

  $('flagImg').src = flagUrl(q.code);
  $('questionNum').textContent = current + 1;
  $('progress').style.width = (current / totalQuestions * 100) + '%';
  $('answerInput').value = '';
  $('answerInput').disabled = false;
  $('submitBtn').disabled = false;
  $('feedback').classList.remove('visible');
  $('nextBtn').style.display = 'none';
  $('nextHint').style.display = 'none';
  $('hintText').textContent = '';
  $('hintBtn').style.display = '';
  $('skipBtn').style.display = '';
  $('gameCard').classList.remove('success', 'fail');

  updateAttemptDots();
  $('answerInput').focus();
}

function showHint() {
  const n = questions[current].names[0];
  $('hintText').textContent = `Commence par « ${n.charAt(0).toUpperCase()} », ${n.length} lettres`;
  $('hintBtn').style.display = 'none';
}

function revealAnswer(isSkip) {
  answered = true;
  const q = questions[current];
  const card = $('gameCard');
  const rt = $('resultText');
  const ar = $('answerReveal');
  const fb = $('feedback');

  if (isSkip) skipped++;
  scoreWrong++;
  streak = 0;

  history.push({
    code: q.code,
    name: cap(q.names[0]),
    status: isSkip ? 'skip' : 'ko',
    userAnswer: isSkip ? '—' : $('answerInput').value
  });

  card.classList.add('fail', 'shake');
  rt.textContent = isSkip ? 'Passé !' : '3 essais épuisés !';
  rt.className = 'result-text wrong';
  ar.textContent = 'Réponse : ' + cap(q.names[0]);
  fb.classList.add('visible');

  lockQuestion();
  setTimeout(() => card.classList.remove('shake', 'pop'), 500);
  updateScore();
}

function skipQuestion() {
  if (!answered) revealAnswer(true);
}

function checkAnswer() {
  if (answered) return;
  const input = $('answerInput').value;
  if (!input.trim()) return;

  const q = questions[current];
  const correct = q.names.some(n => isCloseEnough(input, n));
  const card = $('gameCard');
  const rt = $('resultText');
  const ar = $('answerReveal');
  const fb = $('feedback');

  if (correct) {
    answered = true;
    scoreCorrect++;
    streak++;
    if (streak > bestStreak) bestStreak = streak;

    history.push({
      code: q.code,
      name: cap(q.names[0]),
      status: 'ok',
      userAnswer: input
    });

    card.classList.add('success', 'pop');
    const used = MAX_ATTEMPTS - attemptsLeft;
    if (used === 0) {
      rt.textContent = streak > 1 ? `Parfait ! 🔥 Série de ${streak}` : 'Parfait du 1er coup ! ✓';
    } else if (used === 1) {
      rt.textContent = 'Trouvé au 2e essai !';
    } else {
      rt.textContent = 'Trouvé au dernier essai !';
    }
    rt.className = 'result-text correct';
    ar.textContent = cap(q.names[0]);
    fb.classList.add('visible');
    lockQuestion();
    setTimeout(() => card.classList.remove('shake', 'pop'), 500);
  } else {
    attemptsLeft--;
    updateAttemptDots();
    if (attemptsLeft <= 0) { revealAnswer(false); return; }
    card.classList.add('shake');
    setTimeout(() => card.classList.remove('shake'), 500);
    rt.textContent = `Mauvaise réponse — encore ${attemptsLeft} essai${attemptsLeft > 1 ? 's' : ''}`;
    rt.className = 'result-text warning';
    ar.textContent = '';
    fb.classList.add('visible');
    $('answerInput').value = '';
    $('answerInput').focus();
  }
  updateScore();
}

function nextQuestion() {
  current++;
  if (current >= totalQuestions) {
    endGame();
  } else {
    loadQuestion();
  }
}

// ===== End & Recap =====

function endGame() {
  $('progress').style.width = '100%';
  $('gameCard').style.display = 'none';
  $('endScreen').style.display = 'block';
  $('finalScore').textContent = `${scoreCorrect} / ${totalQuestions}`;

  const pct = scoreCorrect / totalQuestions;
  let msg = '';
  if (pct === 1) msg = 'Parfait ! Vous êtes un expert ! 🏆';
  else if (pct >= 0.8) msg = 'Excellent ! Très bonne connaissance ! 🌍';
  else if (pct >= 0.6) msg = 'Bien joué ! Continuez à apprendre ! 📚';
  else if (pct >= 0.4) msg = 'Pas mal ! Encore de la marge.';
  else msg = 'Courage ! Rejouez pour progresser ! 💪';
  if (bestStreak > 2) msg += `\nMeilleure série : ${bestStreak} 🔥`;
  if (skipped > 0) msg += `\nQuestions passées : ${skipped}`;
  $('endMessage').textContent = msg;

  buildRecap();
}

function buildRecap() {
  const grid = $('recapGrid');
  grid.innerHTML = '';

  history.forEach((h, i) => {
    const row = document.createElement('div');
    row.className = `recap-row ${h.status} fade-in`;
    row.style.animationDelay = (i * 0.04) + 's';

    let detail = '';
    if (h.status === 'ok') {
      detail = `Votre réponse : ${h.userAnswer}`;
    } else if (h.status === 'skip') {
      detail = 'Question passée';
    } else {
      detail = `Votre réponse : ${h.userAnswer}`;
    }

    let badgeText = '';
    if (h.status === 'ok') badgeText = '✓ Correct';
    else if (h.status === 'skip') badgeText = '⏭ Passé';
    else badgeText = '✗ Raté';

    row.innerHTML = `
      <img class="recap-flag" src="${flagUrl(h.code)}" alt="${h.name}">
      <div class="recap-info">
        <div class="recap-country">${h.name}</div>
        <div class="recap-detail">${detail}</div>
      </div>
      <span class="recap-badge ${h.status}">${badgeText}</span>
    `;
    grid.appendChild(row);
  });
}

// ===== Keyboard =====

document.addEventListener('DOMContentLoaded', () => {
  $('answerInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      if (answered) nextQuestion();
      else checkAnswer();
    }
  });

  document.addEventListener('keydown', e => {
    if (!answered) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      nextQuestion();
    }
  });

  // Start at menu
  showMenu();
});
