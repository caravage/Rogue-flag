// js/normal.js
// Mode normal — quiz classique avec catégories, 3 essais, recap

const MAX_ATTEMPTS = 3;

let questions = [], current = 0, scoreCorrect = 0, scoreWrong = 0;
let streak = 0, bestStreak = 0, skipped = 0;
let attemptsLeft = MAX_ATTEMPTS, answered = false;
let totalQuestions = 20, currentCategory = null;
let history = [];

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

function buildMenu() {
  const grid = $('catGrid');
  grid.innerHTML = '';
  CATEGORIES.forEach((cat, i) => {
    const count = cat.filter().length;
    const hasSub = cat.sub && cat.sub.length > 0;

    const btn = document.createElement('div');
    btn.className = 'cat-btn fade-in';
    btn.style.animationDelay = (i * 0.06) + 's';
    btn.innerHTML = `
      <div class="cat-icon">${cat.icon}</div>
      <div class="cat-info">
        <div class="cat-name">${cat.name}</div>
        <div class="cat-count">${count} pays</div>
      </div>
      <div class="cat-arrow">${hasSub ? '▼' : '→'}</div>`;

    if (hasSub) {
      // Create sub-menu container
      const subGrid = document.createElement('div');
      subGrid.className = 'sub-grid';
      subGrid.style.display = 'none';

      cat.sub.forEach(sub => {
        const subCount = sub.filter().length;
        const subBtn = document.createElement('div');
        subBtn.className = 'cat-btn cat-btn-sub fade-in';
        subBtn.innerHTML = `
          ${sub.icon ? '<div class="cat-icon">' + sub.icon + '</div>' : ''}
          <div class="cat-info">
            <div class="cat-name">${sub.name}</div>
            <div class="cat-count">${subCount} pays</div>
          </div>
          <div class="cat-arrow">→</div>`;
        subBtn.onclick = (e) => { e.stopPropagation(); startGame(sub.id); };
        subGrid.appendChild(subBtn);
      });

      btn.onclick = () => {
        const visible = subGrid.style.display !== 'none';
        subGrid.style.display = visible ? 'none' : 'flex';
        btn.querySelector('.cat-arrow').textContent = visible ? '▼' : '▲';
      };

      grid.appendChild(btn);
      grid.appendChild(subGrid);
    } else {
      btn.onclick = () => startGame(cat.id);
      grid.appendChild(btn);
    }
  });
}

function showMenu() {
  $('menuScreen').style.display = '';
  $('gameZone').style.display = 'none';
  buildMenu();
}

function findCategory(catId) {
  for (const cat of CATEGORIES) {
    if (cat.id === catId) return cat;
    if (cat.sub) {
      const sub = cat.sub.find(s => s.id === catId);
      if (sub) return sub;
    }
  }
  return null;
}

function startGame(catId) {
  currentCategory = catId;
  const cat = findCategory(catId);
  if (!cat) return;
  const pool = cat.filter();
  totalQuestions = Math.min(20, pool.length);
  questions = shuffle(pool).slice(0, totalQuestions);
  current = 0; scoreCorrect = 0; scoreWrong = 0;
  streak = 0; bestStreak = 0; skipped = 0;
  answered = false; history = [];
  $('menuScreen').style.display = 'none';
  $('gameZone').style.display = 'block';
  $('endScreen').style.display = 'none';
  $('gameCard').style.display = 'block';
  $('totalQ').textContent = totalQuestions;
  $('catTag').textContent = cat.icon + ' ' + cat.name;
  updateScore(); loadQuestion();
}

function loadQuestion() {
  answered = false; attemptsLeft = MAX_ATTEMPTS;
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
  if (isSkip) skipped++;
  scoreWrong++; streak = 0;
  history.push({ code: q.code, name: cap(q.names[0]), status: isSkip ? 'skip' : 'ko', userAnswer: isSkip ? '—' : $('answerInput').value });
  $('gameCard').classList.add('fail', 'shake');
  $('resultText').textContent = isSkip ? 'Passé !' : '3 essais épuisés !';
  $('resultText').className = 'result-text wrong';
  $('answerReveal').textContent = 'Réponse : ' + cap(q.names[0]);
  $('feedback').classList.add('visible');
  lockQuestion();
  setTimeout(() => $('gameCard').classList.remove('shake', 'pop'), 500);
  updateScore();
}

function skipQuestion() { if (!answered) revealAnswer(true); }

function checkAnswer() {
  if (answered) return;
  const input = $('answerInput').value;
  if (!input.trim()) return;
  const q = questions[current];
  const correct = q.names.some(n => isCloseEnough(input, n));
  if (correct) {
    answered = true; scoreCorrect++; streak++;
    if (streak > bestStreak) bestStreak = streak;
    history.push({ code: q.code, name: cap(q.names[0]), status: 'ok', userAnswer: input });
    $('gameCard').classList.add('success', 'pop');
    const used = MAX_ATTEMPTS - attemptsLeft;
    $('resultText').textContent = used === 0 ? (streak > 1 ? `Parfait ! 🔥 Série de ${streak}` : 'Parfait du 1er coup ! ✓') : used === 1 ? 'Trouvé au 2e essai !' : 'Trouvé au dernier essai !';
    $('resultText').className = 'result-text correct';
    $('answerReveal').textContent = cap(q.names[0]);
    $('feedback').classList.add('visible');
    lockQuestion();
    setTimeout(() => $('gameCard').classList.remove('shake', 'pop'), 500);
  } else {
    attemptsLeft--; updateAttemptDots();
    if (attemptsLeft <= 0) { revealAnswer(false); return; }
    $('gameCard').classList.add('shake');
    setTimeout(() => $('gameCard').classList.remove('shake'), 500);
    $('resultText').textContent = `Mauvaise réponse — encore ${attemptsLeft} essai${attemptsLeft > 1 ? 's' : ''}`;
    $('resultText').className = 'result-text warning';
    $('answerReveal').textContent = '';
    $('feedback').classList.add('visible');
    $('answerInput').value = '';
    $('answerInput').focus();
  }
  updateScore();
}

function nextQuestion() {
  current++;
  current >= totalQuestions ? endGame() : loadQuestion();
}

function endGame() {
  $('progress').style.width = '100%';
  $('gameCard').style.display = 'none';
  $('endScreen').style.display = 'block';
  $('finalScore').textContent = `${scoreCorrect} / ${totalQuestions}`;
  const pct = scoreCorrect / totalQuestions;
  let msg = pct === 1 ? 'Parfait ! Vous êtes un expert ! 🏆' : pct >= 0.8 ? 'Excellent ! Très bonne connaissance ! 🌍' : pct >= 0.6 ? 'Bien joué ! Continuez à apprendre ! 📚' : pct >= 0.4 ? 'Pas mal ! Encore de la marge.' : 'Courage ! Rejouez pour progresser ! 💪';
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
    const detail = h.status === 'skip' ? 'Question passée' : `Votre réponse : ${h.userAnswer}`;
    const badge = h.status === 'ok' ? '✓ Correct' : h.status === 'skip' ? '⏭ Passé' : '✗ Raté';
    row.innerHTML = `
      <img class="recap-flag" src="${flagUrl(h.code)}" alt="${h.name}">
      <div class="recap-info">
        <div class="recap-country">${h.name}</div>
        <div class="recap-detail">${detail}</div>
      </div>
      <span class="recap-badge ${h.status}">${badge}</span>`;
    grid.appendChild(row);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  $('answerInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') { answered ? nextQuestion() : checkAnswer(); }
  });
  document.addEventListener('keydown', e => {
    if (!answered) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nextQuestion(); }
  });
  initMobileScrollFix();
  showMenu();
});
