// js/rogue.js
// Mode Rogue-like — 3 actes, 4 rounds, récompenses

// ===== CONFIG =====
const ACTS = 3;
const ROUNDS_PER_ACT = 4;
const STARTING_LIVES = 3;
const FLAGS_PER_ROUND = 5;

// ===== REWARDS =====
const ALL_REWARDS = [
  {
    id: "extra_life",
    name: "+1 Vie",
    icon: "❤️",
    desc: "Récupérez une vie immédiatement.",
    type: "instant", // applied immediately, not stored
  },
  {
    id: "second_wind",
    name: "Second souffle",
    icon: "💨",
    desc: "Permanent — La première fois que vous tombez à 0 vie, revenez à 1.",
    type: "permanent",
  },
  {
    id: "show_continent",
    name: "Continent affiché",
    icon: "🗺️",
    desc: "Permanent — Le continent du pays est toujours visible.",
    type: "permanent",
  },
  {
    id: "reveal_letter",
    name: "Lettre révélée",
    icon: "🔤",
    desc: "Consommable — Révèle une lettre au hasard sur la question en cours.",
    type: "consumable",
  },
  {
    id: "swap_flag",
    name: "Changement de drapeau",
    icon: "🔄",
    desc: "Consommable — Remplace le drapeau actuel par un autre du même niveau.",
    type: "consumable",
  },
  {
    id: "time_travel",
    name: "Voyage temporel",
    icon: "⏳",
    desc: "Consommable — Répondez à 2 drapeaux faciles pour passer le drapeau actuel.",
    type: "consumable",
  },
];

const CONTINENT_NAMES = {
  europe: "Europe", asie: "Asie", afrique: "Afrique",
  amerique_nord: "Amérique du Nord", amerique_sud: "Amérique du Sud", oceanie: "Océanie",
};

// ===== STATE =====
let lives = STARTING_LIVES;
let act = 1;
let round = 1;
let roundFlags = [];
let flagIndex = 0;
let answered = false;
let totalCorrect = 0;
let totalWrong = 0;
let usedCountries = new Set();
let history = [];

// Rewards state
let permanents = {};       // { second_wind: true, show_continent: true }
let consumables = {};      // { reveal_letter: 2, swap_flag: 1 }
let secondWindUsed = false;
let revealedLettersOnCurrent = []; // letters revealed on current flag by consumable

// ===== HELPERS =====

function getPool(tierNum) {
  return COUNTRIES.filter(c => c.tier === tierNum && !usedCountries.has(c.code));
}

function generateRoundFlags() {
  const count = FLAGS_PER_ROUND;
  let picked = [];
  const tierOrder = act === 1 ? [1, 2, 3] : act === 2 ? [2, 1, 3] : [3, 2, 1];

  for (const tier of tierOrder) {
    if (picked.length >= count) break;
    const available = shuffle(getPool(tier)).filter(c => !picked.find(p => p.code === c.code));
    const need = count - picked.length;
    picked = [...picked, ...available.slice(0, need)];
  }

  if (picked.length < count) {
    const extra = shuffle(COUNTRIES.filter(c => !usedCountries.has(c.code) && !picked.find(p => p.code === c.code)));
    picked = [...picked, ...extra.slice(0, count - picked.length)];
  }

  picked = shuffle(picked);
  picked.forEach(c => usedCountries.add(c.code));
  return picked;
}

function hasPermanent(id) { return !!permanents[id]; }
function consumableCount(id) { return consumables[id] || 0; }

function buildHintDisplay(name, revealed) {
  const n = normalize(name);
  let display = '';
  for (let i = 0; i < n.length; i++) {
    const found = revealed.find(l => l.index === i);
    if (found) {
      display += found.char.toUpperCase();
    } else if (n[i] === ' ' || n[i] === '-') {
      display += n[i];
    } else {
      display += '_ ';
    }
  }
  return display.trim();
}

// ===== UI: LIVES =====

function updateLivesDisplay() {
  const el = $('livesDisplay');
  let html = '';
  for (let i = 0; i < lives; i++) html += '❤️';
  if (hasPermanent("second_wind") && !secondWindUsed) html += ' 💨';
  el.innerHTML = html;
}

// ===== UI: INVENTORY (active cards row) =====

function renderInventory() {
  const el = $('activeCardsDisplay');
  let html = '';

  // Permanents
  for (const id of Object.keys(permanents)) {
    const r = ALL_REWARDS.find(r => r.id === id);
    html += `<span class="inv-badge inv-permanent" title="${r.desc}">${r.icon}</span>`;
  }

  // Consumables
  for (const id of Object.keys(consumables)) {
    if (consumables[id] <= 0) continue;
    const r = ALL_REWARDS.find(r => r.id === id);
    const count = consumables[id];
    const disabled = answered ? ' inv-disabled' : '';
    html += `<span class="inv-badge inv-consumable${disabled}" data-id="${id}" title="${r.desc}" onclick="useConsumable('${id}')">${r.icon}${count > 1 ? ' ×' + count : ''}</span>`;
  }

  el.innerHTML = html;
}

// ===== UI: CONFIRMATION MODAL =====

function showConfirm(message, onConfirm) {
  const overlay = $('confirmOverlay');
  $('confirmMessage').textContent = message;
  overlay.style.display = 'flex';

  // Store callback
  overlay._onConfirm = onConfirm;
}

function confirmYes() {
  const overlay = $('confirmOverlay');
  overlay.style.display = 'none';
  if (overlay._onConfirm) overlay._onConfirm();
}

function confirmNo() {
  $('confirmOverlay').style.display = 'none';
}

// ===== CONSUMABLE USAGE =====

function useConsumable(id) {
  if (answered) return;
  if (consumableCount(id) <= 0) return;

  const r = ALL_REWARDS.find(r => r.id === id);
  showConfirm(`Utiliser ${r.icon} ${r.name} ?`, () => {
    consumables[id]--;
    applyConsumable(id);
    renderInventory();
  });
}

function applyConsumable(id) {
  const q = roundFlags[flagIndex];

  if (id === "reveal_letter") {
    // Reveal one random letter not already revealed
    const n = normalize(q.names[0]);
    const available = [];
    for (let i = 0; i < n.length; i++) {
      if (n[i] !== ' ' && !revealedLettersOnCurrent.find(l => l.index === i)) {
        available.push(i);
      }
    }
    if (available.length > 0) {
      const idx = available[Math.floor(Math.random() * available.length)];
      revealedLettersOnCurrent.push({ index: idx, char: n[idx] });
      updateLetterHint();
    }
  }

  if (id === "swap_flag") {
    const currentTier = q.tier;
    const candidates = COUNTRIES.filter(c =>
      c.tier === currentTier &&
      !usedCountries.has(c.code) &&
      c.code !== q.code
    );
    if (candidates.length > 0) {
      const newFlag = candidates[Math.floor(Math.random() * candidates.length)];
      usedCountries.delete(q.code);
      usedCountries.add(newFlag.code);
      roundFlags[flagIndex] = newFlag;
      revealedLettersOnCurrent = [];
      loadRogueFlag();
    }
  }

  if (id === "time_travel") {
    startTimeTravel();
  }
}

function updateLetterHint() {
  const q = roundFlags[flagIndex];
  if (revealedLettersOnCurrent.length > 0) {
    $('rogueLetterHint').textContent = buildHintDisplay(q.names[0], revealedLettersOnCurrent);
    $('rogueLetterHint').style.display = 'block';
  } else {
    $('rogueLetterHint').style.display = 'none';
  }
}

// ===== UI: ACT/ROUND =====

function updateActRoundDisplay() {
  $('actDisplay').textContent = `Acte ${act}`;
  $('roundDisplay').textContent = `Round ${round} / ${ROUNDS_PER_ACT}`;
}

function updateRogueProgress() {
  const totalRounds = ACTS * ROUNDS_PER_ACT;
  const done = (act - 1) * ROUNDS_PER_ACT + (round - 1);
  $('rogueProgress').style.width = (done / totalRounds * 100) + '%';
}

// ===== REWARD CHOICE SCREEN =====

function showRewardChoice() {
  $('rogueGame').style.display = 'none';
  $('cardChoiceScreen').style.display = 'block';

  // Build available pool: permanents already owned are excluded
  let available = ALL_REWARDS.filter(r => {
    if (r.type === 'permanent' && hasPermanent(r.id)) return false;
    return true;
  });
  if (available.length < 2) available = ALL_REWARDS.filter(r => r.type !== 'permanent');

  const picks = shuffle(available).slice(0, 2);

  const container = $('cardChoices');
  container.innerHTML = '';
  picks.forEach(reward => {
    const el = document.createElement('div');
    el.className = 'card-choice fade-in';

    let typeLabel = '';
    if (reward.type === 'permanent') typeLabel = '<span class="card-type-tag permanent">Permanent</span>';
    else if (reward.type === 'consumable') typeLabel = '<span class="card-type-tag consumable">Consommable</span>';
    else typeLabel = '<span class="card-type-tag instant">Immédiat</span>';

    el.innerHTML = `
      <div class="card-choice-icon">${reward.icon}</div>
      <div class="card-choice-name">${reward.name}</div>
      ${typeLabel}
      <div class="card-choice-desc">${reward.desc}</div>
    `;
    el.onclick = () => pickReward(reward.id);
    container.appendChild(el);
  });
}

function pickReward(rewardId) {
  const r = ALL_REWARDS.find(r => r.id === rewardId);

  if (r.type === 'instant') {
    if (rewardId === 'extra_life') lives++;
  } else if (r.type === 'permanent') {
    permanents[rewardId] = true;
  } else if (r.type === 'consumable') {
    consumables[rewardId] = (consumables[rewardId] || 0) + 1;
  }

  $('cardChoiceScreen').style.display = 'none';
  startNextRound();
}

// ===== ACT TRANSITION =====

function showActScreen() {
  $('rogueGame').style.display = 'none';
  $('cardChoiceScreen').style.display = 'none';
  $('actScreen').style.display = 'block';
  const titles = { 1: "Acte I — Terres connues", 2: "Acte II — Horizons lointains", 3: "Acte III — Terra incognita" };
  $('actTitle').textContent = titles[act] || `Acte ${act}`;
  $('actSubtitle').textContent = act === 1 ? "Les drapeaux les plus célèbres" : act === 2 ? "La difficulté augmente..." : "Seuls les experts survivent";
}

function dismissActScreen() {
  $('actScreen').style.display = 'none';
  $('rogueGame').style.display = 'block';
  startNextRound();
}

// ===== GAME FLOW =====

function startRun() {
  lives = STARTING_LIVES;
  act = 1; round = 0;
  totalCorrect = 0; totalWrong = 0;
  usedCountries = new Set();
  permanents = {};
  consumables = {};
  secondWindUsed = false;
  revealedLettersOnCurrent = [];
  history = [];

  $('rogueEnd').style.display = 'none';
  $('cardChoiceScreen').style.display = 'none';
  showActScreen();
}

function startNextRound() {
  round++;

  if (round > ROUNDS_PER_ACT) {
    act++;
    round = 1;
    if (act > ACTS) {
      victory();
      return;
    }
    showActScreen();
    return;
  }

  roundFlags = generateRoundFlags();
  flagIndex = 0;
  answered = false;

  $('rogueGame').style.display = 'block';
  updateActRoundDisplay();
  updateActDots();
  updateLivesDisplay();
  updateRogueProgress();
  renderInventory();
  loadRogueFlag();
}

function loadRogueFlag() {
  answered = false;
  revealedLettersOnCurrent = [];

  const q = roundFlags[flagIndex];
  $('rogueFlag').src = flagUrl(q.code);
  $('rogueFlagCount').textContent = `${flagIndex + 1} / ${roundFlags.length}`;
  $('rogueInput').value = '';
  $('rogueInput').disabled = false;
  $('rogueSubmitBtn').disabled = false;
  $('rogueFeedback').classList.remove('visible');
  $('rogueNextBtn').style.display = 'none';
  $('rogueNextHint').style.display = 'none';
  $('rogueCard').classList.remove('success', 'fail');

  // Permanent: continent
  if (hasPermanent("show_continent")) {
    $('rogueContinentHint').textContent = CONTINENT_NAMES[q.c] || '';
    $('rogueContinentHint').style.display = 'block';
  } else {
    $('rogueContinentHint').style.display = 'none';
  }

  // Reset letter hint
  $('rogueLetterHint').style.display = 'none';

  // Re-enable consumables in inventory
  renderInventory();

  $('rogueInput').focus();
}

function checkRogueAnswer() {
  if (answered) return;
  const input = $('rogueInput').value;
  if (!input.trim()) return;

  const q = roundFlags[flagIndex];
  const correct = q.names.some(n => isCloseEnough(input, n));

  answered = true;
  $('rogueInput').disabled = true;
  $('rogueSubmitBtn').disabled = true;

  if (correct) {
    totalCorrect++;

    $('rogueResultText').textContent = 'Correct ! ✓';
    $('rogueResultText').className = 'result-text correct';
    $('rogueAnswerReveal').textContent = cap(q.names[0]);
    $('rogueCard').classList.add('success', 'pop');

    history.push({ code: q.code, name: cap(q.names[0]), status: 'ok', userAnswer: input });
  } else {
    totalWrong++;
    lives--;

    // Second wind check
    if (lives <= 0 && hasPermanent("second_wind") && !secondWindUsed) {
      secondWindUsed = true;
      lives = 1;
      $('rogueResultText').textContent = '💨 Second souffle ! Vous revenez à 1 vie !';
    } else {
      $('rogueResultText').textContent = 'Raté ! -1 ❤️';
    }
    $('rogueResultText').className = 'result-text wrong';
    $('rogueAnswerReveal').textContent = 'Réponse : ' + cap(q.names[0]);
    $('rogueCard').classList.add('fail', 'shake');

    history.push({ code: q.code, name: cap(q.names[0]), status: 'ko', userAnswer: input });
  }

  $('rogueFeedback').classList.add('visible');
  $('rogueNextBtn').style.display = 'block';
  $('rogueNextHint').style.display = 'block';
  updateLivesDisplay();
  renderInventory(); // grey out consumables
  setTimeout(() => $('rogueCard').classList.remove('shake', 'pop'), 500);

  if (lives <= 0) {
    setTimeout(() => gameOver(), 800);
  }
}

function nextRogueFlag() {
  if (lives <= 0) return;
  flagIndex++;
  if (flagIndex >= roundFlags.length) {
    // Round complete — reward choice every 2 rounds
    if (round % 2 === 0 && !(act > ACTS)) {
      showRewardChoice();
    } else {
      startNextRound();
    }
  } else {
    loadRogueFlag();
  }
}

// ===== END SCREENS =====

function gameOver() {
  $('rogueGame').style.display = 'none';
  $('rogueEnd').style.display = 'block';
  $('rogueEndTitle').textContent = '💀 Game Over';
  $('rogueEndTitle').style.color = 'var(--red)';
  $('rogueEndScore').textContent = `${totalCorrect} bonnes réponses`;
  const totalItems = Object.keys(permanents).length + Object.values(consumables).reduce((a, b) => a + b, 0);
  $('rogueEndDetail').textContent = `Acte ${act} — Round ${round}`;
  buildRogueRecap();
}

function victory() {
  $('rogueGame').style.display = 'none';
  $('cardChoiceScreen').style.display = 'none';
  $('rogueEnd').style.display = 'block';
  $('rogueEndTitle').textContent = '🏆 Victoire !';
  $('rogueEndTitle').style.color = 'var(--accent)';
  $('rogueEndScore').textContent = `${totalCorrect} bonnes réponses`;
  $('rogueEndDetail').textContent = `Run complétée avec ${lives} vie${lives > 1 ? 's' : ''} restante${lives > 1 ? 's' : ''}`;
  buildRogueRecap();
}

function buildRogueRecap() {
  const grid = $('rogueRecapGrid');
  grid.innerHTML = '';
  history.forEach((h, i) => {
    const row = document.createElement('div');
    row.className = `recap-row ${h.status} fade-in`;
    row.style.animationDelay = (i * 0.03) + 's';
    const detail = `Votre réponse : ${h.userAnswer}`;
    const badge = h.status === 'ok' ? '✓' : '✗';
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

// ===== ACT PROGRESS DOTS =====

function updateActDots() {
  const el = $('actDots');
  let html = '';
  for (let r = 1; r <= ROUNDS_PER_ACT; r++) {
    let cls = 'act-dot';
    if (r < round) cls += ' act-dot-done';
    else if (r === round) cls += ' act-dot-current';
    html += `<span class="${cls}"></span>`;
  }
  el.innerHTML = html;
}

// ===== TIME TRAVEL MINI-GAME =====

let ttFlags = [];
let ttIndex = 0;
let ttAnswered = false;
let ttCorrectCount = 0;

function startTimeTravel() {
  // Pick 2 flags from previous act tier (or current if act 1)
  const ttTier = act > 1 ? act - 1 : 1;
  const pool = COUNTRIES.filter(c => c.tier === ttTier && !usedCountries.has(c.code));
  ttFlags = shuffle(pool).slice(0, 2);
  // If not enough, fill from any easy tier
  if (ttFlags.length < 2) {
    const extra = COUNTRIES.filter(c => c.tier <= 2 && !usedCountries.has(c.code) && !ttFlags.find(f => f.code === c.code));
    ttFlags = [...ttFlags, ...shuffle(extra).slice(0, 2 - ttFlags.length)];
  }
  ttIndex = 0;
  ttCorrectCount = 0;
  ttAnswered = false;

  $('rogueGame').style.display = 'none';
  $('timeTravelScreen').style.display = 'block';
  loadTimeTravelFlag();
}

function loadTimeTravelFlag() {
  ttAnswered = false;
  const q = ttFlags[ttIndex];
  $('ttFlag').src = flagUrl(q.code);
  $('ttCount').textContent = `${ttIndex + 1} / 2`;
  $('ttInput').value = '';
  $('ttInput').disabled = false;
  $('ttSubmitBtn').disabled = false;
  $('ttFeedback').classList.remove('visible');
  $('ttNextBtn').style.display = 'none';
  $('ttCard').classList.remove('success', 'fail');
  $('ttInput').focus();
}

function checkTimeTravelAnswer() {
  if (ttAnswered) return;
  const input = $('ttInput').value;
  if (!input.trim()) return;

  const q = ttFlags[ttIndex];
  const correct = q.names.some(n => isCloseEnough(input, n));

  ttAnswered = true;
  $('ttInput').disabled = true;
  $('ttSubmitBtn').disabled = true;

  if (correct) {
    ttCorrectCount++;
    $('ttResultText').textContent = 'Correct ! ✓';
    $('ttResultText').className = 'result-text correct';
    $('ttCard').classList.add('success', 'pop');
  } else {
    $('ttResultText').textContent = 'Raté !';
    $('ttResultText').className = 'result-text wrong';
    $('ttCard').classList.add('fail', 'shake');
  }
  $('ttAnswerReveal').textContent = cap(q.names[0]);
  $('ttFeedback').classList.add('visible');
  $('ttNextBtn').style.display = 'block';
  setTimeout(() => $('ttCard').classList.remove('shake', 'pop'), 500);
}

function nextTimeTravelFlag() {
  ttIndex++;
  if (ttIndex >= 2) {
    // Done — if both correct, skip the current rogue flag
    $('timeTravelScreen').style.display = 'none';
    $('rogueGame').style.display = 'block';

    if (ttCorrectCount === 2) {
      // Mark current flag as skipped via time travel
      const q = roundFlags[flagIndex];
      history.push({ code: q.code, name: cap(q.names[0]), status: 'ok', userAnswer: '⏳ Voyage temporel' });
      totalCorrect++;

      // Move to next flag
      answered = true;
      nextRogueFlag();
    } else {
      // Failed time travel — back to the same flag, no penalty
      loadRogueFlag();
    }
  } else {
    loadTimeTravelFlag();
  }
}

// ===== GOD MODE =====

function godModeAddLife() {
  lives++;
  updateLivesDisplay();
}

// ===== KEYBOARD =====

document.addEventListener('DOMContentLoaded', () => {
  $('rogueInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') { answered ? nextRogueFlag() : checkRogueAnswer(); }
  });

  $('ttInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') { ttAnswered ? nextTimeTravelFlag() : checkTimeTravelAnswer(); }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      // Time travel screen
      if ($('timeTravelScreen').style.display !== 'none' && ttAnswered) {
        e.preventDefault();
        nextTimeTravelFlag();
        return;
      }
      // Main game
      if (!answered) return;
      e.preventDefault();
      nextRogueFlag();
    }
  });

  initMobileScrollFix();
  startRun();
});
