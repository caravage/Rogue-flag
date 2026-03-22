// js/rogue.js — Mode Rogue-like

// ===== CONFIG =====
const ACTS = 3;
const ROUNDS_PER_ACT = 4;
const STARTING_LIVES = 3;
const FLAGS_PER_ROUND = 5;
const BOSS_FLAGS = 3;

// ===== REWARDS =====
// Cards pool for EVEN rounds (no extra_life here)
const CARD_REWARDS = [
  { id: "second_wind", name: "Second souffle", icon: "💨", desc: "Permanent — Première mort annulée, revenez à 1 vie.", type: "permanent" },
  { id: "show_continent", name: "Continent affiché", icon: "🗺️", desc: "Permanent — Le continent est toujours visible.", type: "permanent" },
  { id: "reveal_letter", name: "Lettre révélée", icon: "🔤", desc: "Consommable — Révèle une lettre au hasard.", type: "consumable" },
  { id: "swap_flag", name: "Changement de drapeau", icon: "🔄", desc: "Consommable — Remplace le drapeau par un autre du même niveau.", type: "consumable" },
  { id: "time_travel", name: "Voyage temporel", icon: "⏳", desc: "Consommable — 2 drapeaux faciles pour passer le drapeau actuel.", type: "consumable" },
  { id: "qcm", name: "QCM", icon: "🎯", desc: "Consommable — Affiche 6 choix possibles dont la bonne réponse.", type: "consumable" },
];

// ODD round choices
const ODD_REWARDS = [
  { id: "extra_life", name: "+1 Vie", icon: "❤️", desc: "Récupérez une vie immédiatement.", type: "instant" },
  { id: "bonus_points", name: "+3 Points", icon: "⭐", desc: "Ajoutez 3 points à votre score.", type: "instant" },
];

// Boss types
const BOSS_TYPES = [
  { id: "mirror", name: "Boss Miroir", icon: "🪞", desc: "Drapeaux inversés horizontalement", css: "boss-mirror" },
  { id: "flip", name: "Boss Renversé", icon: "🙃", desc: "Drapeaux inversés verticalement", css: "boss-flip" },
  { id: "negative", name: "Boss Négatif", icon: "🌑", desc: "Drapeaux en couleurs négatives", css: "boss-negative" },
];

const CONTINENT_NAMES = {
  europe: "Europe", asie: "Asie", afrique: "Afrique",
  amerique_nord: "Amérique du Nord", amerique_sud: "Amérique du Sud", oceanie: "Océanie",
};

// ===== STATE =====
let lives = STARTING_LIVES;
let score = 0;
let act = 1;
let round = 1;
let roundFlags = [];
let flagIndex = 0;
let answered = false;
let totalCorrect = 0;
let totalWrong = 0;
let usedCountries = new Set();
let history = [];
let roundResults = []; // 'ok'|'ko' per flag in current round

// Rewards
let permanents = {};
let consumables = {};
let secondWindUsed = false;
let revealedLettersOnCurrent = [];
let qcmActive = false; // is QCM overlay showing

// Boss
let inBoss = false;
let currentBossType = null;

// ===== HELPERS =====

function getPool(tierNum) {
  return COUNTRIES.filter(c => c.tier === tierNum && !usedCountries.has(c.code));
}

function generateFlags(count, forAct) {
  let picked = [];
  const tierOrder = forAct === 1 ? [1, 2, 3] : forAct === 2 ? [2, 1, 3] : [3, 2, 1];
  for (const tier of tierOrder) {
    if (picked.length >= count) break;
    const available = shuffle(getPool(tier)).filter(c => !picked.find(p => p.code === c.code));
    picked = [...picked, ...available.slice(0, count - picked.length)];
  }
  if (picked.length < count) {
    const extra = shuffle(COUNTRIES.filter(c => !usedCountries.has(c.code) && !picked.find(p => p.code === c.code)));
    picked = [...picked, ...extra.slice(0, count - picked.length)];
  }
  picked = shuffle(picked);
  picked.forEach(c => usedCountries.add(c.code));
  return picked;
}

function pointsPerFlag() { return act; }

function hasPermanent(id) { return !!permanents[id]; }
function consumableCount(id) { return consumables[id] || 0; }

function buildHintDisplay(name, revealed) {
  const n = normalize(name);
  let display = '';
  for (let i = 0; i < n.length; i++) {
    const found = revealed.find(l => l.index === i);
    if (found) display += found.char.toUpperCase();
    else if (n[i] === ' ' || n[i] === '-') display += n[i];
    else display += '_ ';
  }
  return display.trim();
}

// ===== UI =====

function updateScore() { $('rogueScore').textContent = score; }

function updateLivesDisplay() {
  let html = '';
  for (let i = 0; i < lives; i++) html += '❤️';
  if (hasPermanent("second_wind") && !secondWindUsed) html += ' 💨';
  $('livesDisplay').innerHTML = html;
}

function updateActRoundDisplay() {
  $('actDisplay').textContent = `Acte ${act}`;
  $('roundDisplay').textContent = inBoss ? 'BOSS' : `Round ${round} / ${ROUNDS_PER_ACT}`;
}

function updateActDots() {
  const el = $('actTracker');
  let html = '';
  
  // Boss at top
  let bossCls = 'tracker-node tracker-boss';
  if (inBoss) bossCls += ' tracker-current';
  else if (round > ROUNDS_PER_ACT) bossCls += ' tracker-done';
  html += `<div class="${bossCls}"><span class="tracker-icon">💀</span><span class="tracker-label">Boss</span></div>`;
  html += '<div class="tracker-line"></div>';

  // Rounds from top (4) to bottom (1)
  for (let r = ROUNDS_PER_ACT; r >= 1; r--) {
    let cls = 'tracker-node';
    if (r < round || (r === round && inBoss)) cls += ' tracker-done';
    else if (r === round && !inBoss) cls += ' tracker-current';
    
    // Show reward icon between rounds
    let rewardIcon = '';
    if (r < round || (r === round && inBoss)) {
      rewardIcon = r % 2 === 1 ? '🎁' : '🃏';
    }
    
    html += `<div class="${cls}"><span class="tracker-dot"></span><span class="tracker-label">R${r}</span></div>`;
    if (r > 1) html += '<div class="tracker-line"></div>';
  }

  el.innerHTML = html;
}

function updateRogueProgress() {
  const totalRounds = ACTS * (ROUNDS_PER_ACT + 1); // +1 for boss
  const done = (act - 1) * (ROUNDS_PER_ACT + 1) + (round - 1) + (inBoss ? ROUNDS_PER_ACT : 0);
  $('rogueProgress').style.width = (done / totalRounds * 100) + '%';
}

function updateFlagDots() {
  let html = '';
  for (let i = 0; i < roundFlags.length; i++) {
    if (i < roundResults.length) {
      html += roundResults[i] === 'ok' ? '<span class="flag-dot flag-dot-ok"></span>' : '<span class="flag-dot flag-dot-ko"></span>';
    } else if (i === flagIndex) {
      html += '<span class="flag-dot flag-dot-current"></span>';
    } else {
      html += '<span class="flag-dot flag-dot-pending"></span>';
    }
  }
  $('rogueFlagDots').innerHTML = html;
}

function renderInventory() {
  let html = '';
  for (const id of Object.keys(permanents)) {
    const r = CARD_REWARDS.find(r => r.id === id);
    if (r) html += `<span class="inv-badge inv-permanent" title="${r.desc}">${r.icon}</span>`;
  }
  for (const id of Object.keys(consumables)) {
    if (consumables[id] <= 0) continue;
    const r = CARD_REWARDS.find(r => r.id === id);
    if (!r) continue;
    const count = consumables[id];
    const disabled = answered ? ' inv-disabled' : '';
    html += `<span class="inv-badge inv-consumable${disabled}" title="${r.desc}" onclick="useConsumable('${id}')">${r.icon}${count > 1 ? ' ×' + count : ''}</span>`;
  }
  $('activeCardsDisplay').innerHTML = html;
}

// ===== CONFIRMATION MODAL =====

function showConfirm(message, onConfirm) {
  $('confirmMessage').textContent = message;
  $('confirmOverlay').style.display = 'flex';
  $('confirmOverlay')._onConfirm = onConfirm;
}
function confirmYes() { $('confirmOverlay').style.display = 'none'; if ($('confirmOverlay')._onConfirm) $('confirmOverlay')._onConfirm(); }
function confirmNo() { $('confirmOverlay').style.display = 'none'; }

// ===== CONSUMABLES =====

function useConsumable(id) {
  if (answered) return;
  if (consumableCount(id) <= 0) return;
  const r = CARD_REWARDS.find(r => r.id === id);
  showConfirm(`Utiliser ${r.icon} ${r.name} ?`, () => {
    consumables[id]--;
    applyConsumable(id);
    renderInventory();
  });
}

function applyConsumable(id) {
  const q = roundFlags[flagIndex];

  if (id === "reveal_letter") {
    const n = normalize(q.names[0]);
    const avail = [];
    for (let i = 0; i < n.length; i++) {
      if (n[i] !== ' ' && !revealedLettersOnCurrent.find(l => l.index === i)) avail.push(i);
    }
    if (avail.length > 0) {
      const idx = avail[Math.floor(Math.random() * avail.length)];
      revealedLettersOnCurrent.push({ index: idx, char: n[idx] });
      updateLetterHint();
    }
  }

  if (id === "swap_flag") {
    const candidates = COUNTRIES.filter(c => c.tier === q.tier && !usedCountries.has(c.code) && c.code !== q.code);
    if (candidates.length > 0) {
      const nf = candidates[Math.floor(Math.random() * candidates.length)];
      usedCountries.delete(q.code);
      usedCountries.add(nf.code);
      roundFlags[flagIndex] = nf;
      revealedLettersOnCurrent = [];
      loadRogueFlag();
    }
  }

  if (id === "time_travel") startTimeTravel();
  if (id === "qcm") showQCM();
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

// ===== QCM =====

function showQCM() {
  const q = roundFlags[flagIndex];
  // Pick 5 wrong answers from similar tier
  const wrong = shuffle(COUNTRIES.filter(c => c.code !== q.code)).slice(0, 5);
  const choices = shuffle([q, ...wrong]);

  qcmActive = true;
  let html = '<div class="qcm-grid">';
  choices.forEach(c => {
    html += `<button class="qcm-btn" onclick="pickQCM('${c.code}')">${cap(c.names[0])}</button>`;
  });
  html += '</div>';
  $('qcmOverlay').innerHTML = html;
  $('qcmOverlay').style.display = 'block';
}

function pickQCM(code) {
  if (!qcmActive) return;
  qcmActive = false;
  $('qcmOverlay').style.display = 'none';
  const q = roundFlags[flagIndex];
  // Fill the input with the chosen answer and submit
  $('rogueInput').value = COUNTRIES.find(c => c.code === code).names[0];
  checkRogueAnswer();
}

// ===== REWARD SCREENS =====

function showOddReward() {
  $('rogueGame').style.display = 'none';
  $('cardChoiceScreen').style.display = 'block';
  const container = $('cardChoices');
  container.innerHTML = '';
  ODD_REWARDS.forEach(reward => {
    const el = document.createElement('div');
    el.className = 'card-choice fade-in';
    el.innerHTML = `
      <div class="card-choice-icon">${reward.icon}</div>
      <div class="card-choice-name">${reward.name}</div>
      <span class="card-type-tag instant">Immédiat</span>
      <div class="card-choice-desc">${reward.desc}</div>`;
    el.onclick = () => pickReward(reward.id);
    container.appendChild(el);
  });
}

function showEvenReward() {
  $('rogueGame').style.display = 'none';
  $('cardChoiceScreen').style.display = 'block';
  let available = CARD_REWARDS.filter(r => {
    if (r.type === 'permanent' && hasPermanent(r.id)) return false;
    return true;
  });
  if (available.length < 2) available = CARD_REWARDS.filter(r => r.type !== 'permanent');
  const picks = shuffle(available).slice(0, 2);
  const container = $('cardChoices');
  container.innerHTML = '';
  picks.forEach(reward => {
    const el = document.createElement('div');
    el.className = 'card-choice fade-in';
    let tag = reward.type === 'permanent' ? '<span class="card-type-tag permanent">Permanent</span>' : '<span class="card-type-tag consumable">Consommable</span>';
    el.innerHTML = `
      <div class="card-choice-icon">${reward.icon}</div>
      <div class="card-choice-name">${reward.name}</div>
      ${tag}
      <div class="card-choice-desc">${reward.desc}</div>`;
    el.onclick = () => pickReward(reward.id);
    container.appendChild(el);
  });
}

function pickReward(id) {
  if (id === 'extra_life') lives++;
  else if (id === 'bonus_points') score += 3;
  else {
    const r = CARD_REWARDS.find(r => r.id === id);
    if (r && r.type === 'permanent') permanents[id] = true;
    else if (r && r.type === 'consumable') consumables[id] = (consumables[id] || 0) + 1;
  }
  $('cardChoiceScreen').style.display = 'none';
  updateScore();
  updateLivesDisplay();
  startNextRound();
}

// ===== BOSS =====

function startBoss() {
  inBoss = true;
  currentBossType = BOSS_TYPES[Math.floor(Math.random() * BOSS_TYPES.length)];
  roundFlags = generateFlags(BOSS_FLAGS, act);
  flagIndex = 0;
  roundResults = [];
  answered = false;

  // Show boss intro
  $('rogueGame').style.display = 'none';
  $('cardChoiceScreen').style.display = 'none';
  $('bossIntro').style.display = 'block';
  $('bossIntroIcon').textContent = currentBossType.icon;
  $('bossIntroName').textContent = currentBossType.name;
  $('bossIntroDesc').textContent = currentBossType.desc;
}

function dismissBossIntro() {
  $('bossIntro').style.display = 'none';
  $('rogueGame').style.display = 'block';
  updateActRoundDisplay();
  updateActDots();
  updateLivesDisplay();
  updateRogueProgress();
  updateScore();
  renderInventory();
  loadRogueFlag();
}

// ===== ACT TRANSITION =====

function showActScreen() {
  $('rogueGame').style.display = 'none';
  $('cardChoiceScreen').style.display = 'none';
  $('bossIntro').style.display = 'none';
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
  lives = STARTING_LIVES; score = 0;
  act = 1; round = 0;
  totalCorrect = 0; totalWrong = 0;
  usedCountries = new Set();
  permanents = {}; consumables = {};
  secondWindUsed = false;
  revealedLettersOnCurrent = [];
  inBoss = false; currentBossType = null;
  history = []; roundResults = [];

  $('rogueEnd').style.display = 'none';
  $('cardChoiceScreen').style.display = 'none';
  $('bossIntro').style.display = 'none';
  $('timeTravelScreen').style.display = 'none';
  updateScore();
  showActScreen();
}

function startNextRound() {
  if (inBoss) {
    // Boss just finished, move to next act
    inBoss = false;
    currentBossType = null;
    act++;
    round = 1;
    if (act > ACTS) { victory(); return; }
    showActScreen();
    return;
  }

  round++;

  if (round > ROUNDS_PER_ACT) {
    // Start boss
    startBoss();
    return;
  }

  roundFlags = generateFlags(FLAGS_PER_ROUND, act);
  flagIndex = 0;
  roundResults = [];
  answered = false;

  $('rogueGame').style.display = 'block';
  updateActRoundDisplay();
  updateActDots();
  updateLivesDisplay();
  updateRogueProgress();
  updateScore();
  renderInventory();
  loadRogueFlag();
}

function loadRogueFlag() {
  answered = false;
  revealedLettersOnCurrent = [];
  qcmActive = false;
  $('qcmOverlay').style.display = 'none';

  const q = roundFlags[flagIndex];
  const flagImg = $('rogueFlag');
  flagImg.src = flagUrl(q.code);

  // Boss CSS effect
  flagImg.className = '';
  if (inBoss && currentBossType) flagImg.classList.add(currentBossType.css);

  updateFlagDots();
  $('rogueInput').value = '';
  $('rogueInput').disabled = false;
  $('rogueSubmitBtn').disabled = false;
  $('rogueFeedback').classList.remove('visible');
  $('rogueNextBtn').style.display = 'none';
  $('rogueNextHint').style.display = 'none';
  $('rogueCard').classList.remove('success', 'fail');

  // Boss label
  if (inBoss && currentBossType) {
    $('bossLabel').textContent = currentBossType.icon + ' ' + currentBossType.name;
    $('bossLabel').style.display = 'block';
  } else {
    $('bossLabel').style.display = 'none';
  }

  // Permanent: continent
  if (hasPermanent("show_continent")) {
    $('rogueContinentHint').textContent = CONTINENT_NAMES[q.c] || '';
    $('rogueContinentHint').style.display = 'block';
  } else {
    $('rogueContinentHint').style.display = 'none';
  }

  $('rogueLetterHint').style.display = 'none';
  $('roguePassBtn').style.display = '';
  $('rogueActionRow').style.display = '';
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
    score += pointsPerFlag();
    roundResults.push('ok');

    $('rogueResultText').textContent = `Correct ! +${pointsPerFlag()} pt${pointsPerFlag() > 1 ? 's' : ''}`;
    $('rogueResultText').className = 'result-text correct';
    $('rogueAnswerReveal').textContent = cap(q.names[0]);
    $('rogueCard').classList.add('success', 'pop');
    history.push({ code: q.code, name: cap(q.names[0]), status: 'ok', userAnswer: input });
  } else {
    totalWrong++;
    lives--;
    roundResults.push('ko');

    if (lives <= 0 && hasPermanent("second_wind") && !secondWindUsed) {
      secondWindUsed = true;
      lives = 1;
      $('rogueResultText').textContent = '💨 Second souffle ! Revenez à 1 vie !';
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
  $('roguePassBtn').style.display = 'none';
  updateLivesDisplay();
  updateScore();
  updateFlagDots();
  renderInventory();
  setTimeout(() => $('rogueCard').classList.remove('shake', 'pop'), 500);

  if (lives <= 0) { setTimeout(() => gameOver(), 800); }
}

function nextRogueFlag() {
  if (lives <= 0) return;
  flagIndex++;
  if (flagIndex >= roundFlags.length) {
    // Round/boss complete
    if (inBoss) {
      startNextRound(); // will handle post-boss act transition
    } else if (round % 2 === 1) {
      showOddReward();
    } else {
      showEvenReward();
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
  $('rogueEndScore').textContent = `${score} points`;
  $('rogueEndDetail').textContent = `Acte ${act} — ${inBoss ? 'Boss' : 'Round ' + round}\n${totalCorrect} bonnes réponses`;
  buildRogueRecap();
}

function victory() {
  $('rogueGame').style.display = 'none';
  $('cardChoiceScreen').style.display = 'none';
  $('rogueEnd').style.display = 'block';
  $('rogueEndTitle').textContent = '🏆 Victoire !';
  $('rogueEndTitle').style.color = 'var(--accent)';
  $('rogueEndScore').textContent = `${score} points`;
  $('rogueEndDetail').textContent = `Run complétée ! ${totalCorrect} bonnes réponses\n${lives} vie${lives > 1 ? 's' : ''} restante${lives > 1 ? 's' : ''}`;
  buildRogueRecap();
}

function buildRogueRecap() {
  const grid = $('rogueRecapGrid');
  grid.innerHTML = '';
  history.forEach((h, i) => {
    const row = document.createElement('div');
    row.className = `recap-row ${h.status} fade-in`;
    row.style.animationDelay = (i * 0.03) + 's';
    row.innerHTML = `
      <img class="recap-flag" src="${flagUrl(h.code)}" alt="${h.name}">
      <div class="recap-info">
        <div class="recap-country">${h.name}</div>
        <div class="recap-detail">Votre réponse : ${h.userAnswer}</div>
      </div>
      <span class="recap-badge ${h.status}">${h.status === 'ok' ? '✓' : '✗'}</span>`;
    grid.appendChild(row);
  });
}

// ===== TIME TRAVEL =====

let ttFlags = [], ttIndex = 0, ttAnswered = false, ttCorrectCount = 0;

function startTimeTravel() {
  const ttTier = act > 1 ? act - 1 : 1;
  let pool = COUNTRIES.filter(c => c.tier === ttTier && !usedCountries.has(c.code));
  ttFlags = shuffle(pool).slice(0, 2);
  if (ttFlags.length < 2) {
    const extra = COUNTRIES.filter(c => c.tier <= 2 && !usedCountries.has(c.code) && !ttFlags.find(f => f.code === c.code));
    ttFlags = [...ttFlags, ...shuffle(extra).slice(0, 2 - ttFlags.length)];
  }
  ttIndex = 0; ttCorrectCount = 0; ttAnswered = false;
  $('rogueGame').style.display = 'none';
  $('timeTravelScreen').style.display = 'block';
  loadTimeTravelFlag();
}

function loadTimeTravelFlag() {
  ttAnswered = false;
  const q = ttFlags[ttIndex];
  $('ttFlag').src = flagUrl(q.code);
  $('ttCount').textContent = `${ttIndex + 1} / 2`;
  $('ttInput').value = ''; $('ttInput').disabled = false; $('ttSubmitBtn').disabled = false;
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
  ttAnswered = true; $('ttInput').disabled = true; $('ttSubmitBtn').disabled = true;
  if (correct) {
    ttCorrectCount++;
    $('ttResultText').textContent = 'Correct ! ✓'; $('ttResultText').className = 'result-text correct';
    $('ttCard').classList.add('success', 'pop');
  } else {
    $('ttResultText').textContent = 'Raté !'; $('ttResultText').className = 'result-text wrong';
    $('ttCard').classList.add('fail', 'shake');
  }
  $('ttAnswerReveal').textContent = cap(q.names[0]);
  $('ttFeedback').classList.add('visible'); $('ttNextBtn').style.display = 'block';
  setTimeout(() => $('ttCard').classList.remove('shake', 'pop'), 500);
}

function nextTimeTravelFlag() {
  ttIndex++;
  if (ttIndex >= 2) {
    $('timeTravelScreen').style.display = 'none';
    $('rogueGame').style.display = 'block';
    if (ttCorrectCount === 2) {
      const q = roundFlags[flagIndex];
      history.push({ code: q.code, name: cap(q.names[0]), status: 'ok', userAnswer: '⏳ Voyage temporel' });
      totalCorrect++; score += pointsPerFlag();
      roundResults.push('ok');
      answered = true;
      updateScore(); updateFlagDots();
      nextRogueFlag();
    } else {
      loadRogueFlag();
    }
  } else {
    loadTimeTravelFlag();
  }
}

// ===== PASS (lose a life) =====

function roguePass() {
  if (answered) return;
  const q = roundFlags[flagIndex];

  answered = true;
  lives--;
  totalWrong++;
  roundResults.push('ko');

  history.push({ code: q.code, name: cap(q.names[0]), status: 'ko', userAnswer: '⏭ Passé' });

  // Second wind check
  if (lives <= 0 && hasPermanent("second_wind") && !secondWindUsed) {
    secondWindUsed = true;
    lives = 1;
    $('rogueResultText').textContent = '💨 Second souffle ! Revenez à 1 vie !';
  } else {
    $('rogueResultText').textContent = 'Passé ! -1 ❤️';
  }
  $('rogueResultText').className = 'result-text wrong';
  $('rogueAnswerReveal').textContent = 'Réponse : ' + cap(q.names[0]);
  $('rogueCard').classList.add('fail', 'shake');
  $('rogueFeedback').classList.add('visible');
  $('rogueInput').disabled = true;
  $('rogueSubmitBtn').disabled = true;
  $('roguePassBtn').style.display = 'none';
  $('rogueNextBtn').style.display = 'block';
  $('rogueNextHint').style.display = 'block';
  updateLivesDisplay();
  updateFlagDots();
  renderInventory();
  setTimeout(() => $('rogueCard').classList.remove('shake'), 500);

  if (lives <= 0) { setTimeout(() => gameOver(), 800); }
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
      if ($('timeTravelScreen').style.display !== 'none' && ttAnswered) { e.preventDefault(); nextTimeTravelFlag(); return; }
      if (!answered) return;
      e.preventDefault(); nextRogueFlag();
    }
  });
  initMobileScrollFix();
  startRun();
});
