// js/rogue.js — Mode Rogue-like

// ===== REWARDS =====
const CARD_REWARDS = [
  { id: "second_wind", name: "Second souffle", icon: "💨", desc: "Permanent — Première mort annulée, revenez à 1 vie.", type: "permanent" },
  { id: "show_continent", name: "Continent affiché", icon: "🗺️", desc: "Permanent — Le continent est toujours visible.", type: "permanent" },
  { id: "reveal_letter", name: "Lettre révélée", icon: "🔤", desc: "Consommable — Révèle une lettre au hasard.", type: "consumable" },
  { id: "swap_flag", name: "Changement de drapeau", icon: "🔄", desc: "Consommable — Remplace le drapeau par un autre du même niveau.", type: "consumable" },
  { id: "time_travel", name: "Voyage temporel", icon: "⏳", desc: "Consommable — 2 drapeaux faciles pour passer le drapeau actuel.", type: "consumable" },
  { id: "qcm", name: "QCM", icon: "🎯", desc: "Consommable — Affiche 6 choix possibles dont la bonne réponse.", type: "consumable" },
];

const ODD_REWARDS = [
  { id: "extra_life", name: "+1 Vie", icon: "❤️", desc: "Récupérez une vie immédiatement.", type: "instant" },
  { id: "bonus_points", name: "+3 Points", icon: "⭐", desc: "Ajoutez 3 points à votre score.", type: "instant" },
];

const BOSS_TYPES = [
  { id: "mirror",   name: "Boss Miroir",    icon: "🪞", desc: "Drapeaux inversés horizontalement", css: "boss-mirror" },
  { id: "flip",     name: "Boss Renversé",  icon: "🙃", desc: "Drapeaux inversés verticalement", css: "boss-flip" },
  { id: "negative", name: "Boss Négatif",   icon: "🌑", desc: "Drapeaux en couleurs négatives", css: "boss-negative" },
  { id: "zoom",     name: "Boss Zoom",      icon: "🔍", desc: "Vue rapprochée qui s'élargit progressivement", css: "boss-zoom" },
  { id: "pixel",    name: "Boss Pixelisé",  icon: "📦", desc: "Drapeau flouté qui se précise peu à peu", css: "boss-pixel" },
  { id: "memory",   name: "Boss Mémoire",   icon: "🧠", desc: "Le drapeau disparaît après 3 secondes", css: "boss-memory" },
  { id: "historical", name: "Boss Historique", icon: "📜", desc: "Drapeaux de pays qui n'existent plus", css: "boss-historical" },
];

// Historical flags — not from flagcdn, custom URLs
const HISTORICAL_FLAGS = [
  {
    url: "https://upload.wikimedia.org/wikipedia/commons/a/a9/Flag_of_the_Soviet_Union.svg",
    names: ["urss", "union sovietique", "union des republiques socialistes sovietiques", "soviet"],
    displayName: "URSS",
  },
  {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Flag_of_East_Germany.svg/1280px-Flag_of_East_Germany.svg.png",
    names: ["allemagne de l'est", "allemagne de lest", "rda", "republique democratique allemande"],
    displayName: "Allemagne de l'Est (RDA)",
  },
  {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Flag_of_South_Vietnam.svg/1280px-Flag_of_South_Vietnam.svg.png",
    names: ["vietnam du sud", "sud vietnam", "republique du vietnam"],
    displayName: "Vietnam du Sud",
  },
  {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Flag_of_China_%281889%E2%80%931912%29.svg/1280px-Flag_of_China_%281889%E2%80%931912%29.svg.png",
    names: ["qing", "dynastie qing", "empire qing", "chine qing"],
    displayName: "Dynastie Qing",
  },
  {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/Byzantine_imperial_flag%2C_14th_century%2C_square.svg/1280px-Byzantine_imperial_flag%2C_14th_century%2C_square.svg.png",
    names: ["empire byzantin", "byzantin", "byzance"],
    displayName: "Empire Byzantin",
  },
];

const CONTINENT_NAMES = {
  europe: "Europe", asie: "Asie", afrique: "Afrique",
  amerique_nord: "Amérique du Nord", amerique_sud: "Amérique du Sud", oceanie: "Océanie",
};

// ===== STATE =====
let lives, score, act, round;
let roundFlags = [], flagIndex = 0, answered = false;
let totalCorrect = 0, totalWrong = 0;
let usedCountries = new Set();
let history = [], roundResults = [];
let permanents = {}, consumables = {};
let secondWindUsed = false;
let revealedLettersOnCurrent = [];
let qcmActive = false;
let inBoss = false, currentBossType = null;
let bossEffectInterval = null; // for zoom/pixel timers
let memoryTimeout = null;
let flagTimer = null;       // countdown interval
let flagTimerStart = null;  // timestamp when flag was loaded
let historicalBossFlags = []; // shuffled picks for historical boss

// ===== HELPERS =====

function getPool(t) { return COUNTRIES.filter(c => c.tier === t && !usedCountries.has(c.code)); }

function generateFlags(count, forAct) {
  let picked = [];
  const order = forAct === 1 ? [1,2,3] : forAct === 2 ? [2,1,3] : [3,2,1];
  for (const t of order) {
    if (picked.length >= count) break;
    const a = shuffle(getPool(t)).filter(c => !picked.find(p => p.code === c.code));
    picked = [...picked, ...a.slice(0, count - picked.length)];
  }
  if (picked.length < count) {
    const extra = shuffle(COUNTRIES.filter(c => !usedCountries.has(c.code) && !picked.find(p => p.code === c.code)));
    picked = [...picked, ...extra.slice(0, count - picked.length)];
  }
  picked = shuffle(picked);
  picked.forEach(c => usedCountries.add(c.code));
  return picked;
}

function pointsPerFlag() { return CONFIG.POINTS_PER_ACT[act] || act; }
function hasPermanent(id) { return !!permanents[id]; }
function consumableCount(id) { return consumables[id] || 0; }

function buildHintDisplay(name, revealed) {
  const n = normalize(name);
  let d = '';
  for (let i = 0; i < n.length; i++) {
    const f = revealed.find(l => l.index === i);
    if (f) d += f.char.toUpperCase();
    else if (n[i] === ' ' || n[i] === '-') d += n[i];
    else d += '_ ';
  }
  return d.trim();
}

// ===== PRELOADING =====

function preloadImages(flags) {
  if (!CONFIG.PRELOAD_ENABLED) return;
  flags.forEach(f => { const img = new Image(); img.src = flagUrl(f.code); });
}

// ===== UI =====

function updateScore() { $('rogueScore').textContent = score; }

function updateLivesDisplay() {
  let h = '';
  for (let i = 0; i < lives; i++) h += '❤️';
  if (hasPermanent("second_wind") && !secondWindUsed) h += ' 💨';
  $('livesDisplay').innerHTML = h;
}

function updateActRoundDisplay() {
  $('actDisplay').textContent = `Acte ${act}`;
  $('roundDisplay').textContent = inBoss ? 'BOSS' : `Round ${round} / ${CONFIG.ROUNDS_PER_ACT}`;
}

function updateActDots() {
  const el = $('actTracker');
  let html = '';
  // Boss at top
  let bc = 'tracker-node tracker-boss';
  if (inBoss) bc += ' tracker-current';
  else if (round > CONFIG.ROUNDS_PER_ACT && !inBoss) bc += ' tracker-done';
  html += `<div class="${bc}"><span class="tracker-icon">💀</span><span class="tracker-label">Boss</span></div>`;
  html += '<div class="tracker-line"></div>';
  // Rounds top to bottom
  for (let r = CONFIG.ROUNDS_PER_ACT; r >= 1; r--) {
    let cls = 'tracker-node';
    if (r < round || (r === round && inBoss)) cls += ' tracker-done';
    else if (r === round && !inBoss) cls += ' tracker-current';
    html += `<div class="${cls}"><span class="tracker-dot"></span><span class="tracker-label">R${r}</span></div>`;
    if (r > 1) html += '<div class="tracker-line"></div>';
  }
  el.innerHTML = html;
}

function updateRogueProgress() {
  const total = CONFIG.ACTS * (CONFIG.ROUNDS_PER_ACT + 1);
  const done = (act - 1) * (CONFIG.ROUNDS_PER_ACT + 1) + (round - 1) + (inBoss ? CONFIG.ROUNDS_PER_ACT : 0);
  $('rogueProgress').style.width = (done / total * 100) + '%';
}

function updateFlagDots() {
  let h = '';
  for (let i = 0; i < roundFlags.length; i++) {
    if (i < roundResults.length) h += roundResults[i] === 'ok' ? '<span class="flag-dot flag-dot-ok"></span>' : '<span class="flag-dot flag-dot-ko"></span>';
    else if (i === flagIndex) h += '<span class="flag-dot flag-dot-current"></span>';
    else h += '<span class="flag-dot flag-dot-pending"></span>';
  }
  $('rogueFlagDots').innerHTML = h;
}

function renderInventory() {
  let h = '';
  for (const id of Object.keys(permanents)) {
    const r = CARD_REWARDS.find(r => r.id === id);
    if (r) h += `<span class="inv-badge inv-permanent" title="${r.desc}">${r.icon}</span>`;
  }
  for (const id of Object.keys(consumables)) {
    if (consumables[id] <= 0) continue;
    const r = CARD_REWARDS.find(r => r.id === id);
    if (!r) continue;
    const dis = answered ? ' inv-disabled' : '';
    h += `<span class="inv-badge inv-consumable${dis}" title="${r.desc}" onclick="useConsumable('${id}')">${r.icon}${consumables[id] > 1 ? ' ×' + consumables[id] : ''}</span>`;
  }
  $('activeCardsDisplay').innerHTML = h;
}

// ===== CONFIRM MODAL =====
function showConfirm(msg, cb) { $('confirmMessage').textContent = msg; $('confirmOverlay').style.display = 'flex'; $('confirmOverlay')._cb = cb; }
function confirmYes() { $('confirmOverlay').style.display = 'none'; if ($('confirmOverlay')._cb) $('confirmOverlay')._cb(); }
function confirmNo() { $('confirmOverlay').style.display = 'none'; }

// ===== CONSUMABLES =====

function useConsumable(id) {
  if (answered) return;
  if (consumableCount(id) <= 0) return;
  const r = CARD_REWARDS.find(r => r.id === id);
  showConfirm(`Utiliser ${r.icon} ${r.name} ?`, () => { consumables[id]--; applyConsumable(id); renderInventory(); });
}

function applyConsumable(id) {
  const q = roundFlags[flagIndex];
  if (id === "reveal_letter") {
    const n = normalize(q.names[0]);
    const av = [];
    for (let i = 0; i < n.length; i++) if (n[i] !== ' ' && !revealedLettersOnCurrent.find(l => l.index === i)) av.push(i);
    if (av.length) { const idx = av[Math.floor(Math.random() * av.length)]; revealedLettersOnCurrent.push({ index: idx, char: n[idx] }); updateLetterHint(); }
  }
  if (id === "swap_flag") {
    const cands = COUNTRIES.filter(c => c.tier === q.tier && !usedCountries.has(c.code) && c.code !== q.code);
    if (cands.length) { const nf = cands[Math.floor(Math.random() * cands.length)]; usedCountries.delete(q.code); usedCountries.add(nf.code); roundFlags[flagIndex] = nf; revealedLettersOnCurrent = []; loadRogueFlag(); }
  }
  if (id === "time_travel") startTimeTravel();
  if (id === "qcm") showQCM();
}

function updateLetterHint() {
  const q = roundFlags[flagIndex];
  if (revealedLettersOnCurrent.length > 0) { $('rogueLetterHint').textContent = buildHintDisplay(q.names[0], revealedLettersOnCurrent); $('rogueLetterHint').style.display = 'block'; }
  else $('rogueLetterHint').style.display = 'none';
}

// ===== QCM =====
function showQCM() {
  const q = roundFlags[flagIndex];
  const wrong = shuffle(COUNTRIES.filter(c => c.code !== q.code)).slice(0, 5);
  const choices = shuffle([q, ...wrong]);
  qcmActive = true;
  let h = '<div class="qcm-grid">';
  choices.forEach(c => { h += `<button class="qcm-btn" onclick="pickQCM('${c.code}')">${cap(c.names[0])}</button>`; });
  h += '</div>';
  $('qcmOverlay').innerHTML = h; $('qcmOverlay').style.display = 'block';
}
function pickQCM(code) {
  if (!qcmActive) return; qcmActive = false; $('qcmOverlay').style.display = 'none';
  $('rogueInput').value = COUNTRIES.find(c => c.code === code).names[0]; checkRogueAnswer();
}

// ===== REWARD SCREENS =====

function showOddReward() {
  $('rogueGame').style.display = 'none'; $('cardChoiceScreen').style.display = 'block';
  const c = $('cardChoices'); c.innerHTML = '';
  ODD_REWARDS.forEach(rw => {
    const el = document.createElement('div'); el.className = 'card-choice fade-in';
    el.innerHTML = `<div class="card-choice-icon">${rw.icon}</div><div class="card-choice-name">${rw.name}</div><span class="card-type-tag instant">Immédiat</span><div class="card-choice-desc">${rw.desc}</div>`;
    el.onclick = () => pickReward(rw.id); c.appendChild(el);
  });
}

function showEvenReward() {
  $('rogueGame').style.display = 'none'; $('cardChoiceScreen').style.display = 'block';
  let avail = CARD_REWARDS.filter(r => !(r.type === 'permanent' && hasPermanent(r.id)));
  if (avail.length < 2) avail = CARD_REWARDS.filter(r => r.type !== 'permanent');
  const picks = shuffle(avail).slice(0, 2);
  const c = $('cardChoices'); c.innerHTML = '';
  picks.forEach(rw => {
    const el = document.createElement('div'); el.className = 'card-choice fade-in';
    const tag = rw.type === 'permanent' ? '<span class="card-type-tag permanent">Permanent</span>' : '<span class="card-type-tag consumable">Consommable</span>';
    el.innerHTML = `<div class="card-choice-icon">${rw.icon}</div><div class="card-choice-name">${rw.name}</div>${tag}<div class="card-choice-desc">${rw.desc}</div>`;
    el.onclick = () => pickReward(rw.id); c.appendChild(el);
  });
}

function pickReward(id) {
  if (id === 'extra_life') lives++;
  else if (id === 'bonus_points') score += CONFIG.BONUS_POINTS_REWARD;
  else { const r = CARD_REWARDS.find(r => r.id === id); if (r && r.type === 'permanent') permanents[id] = true; else if (r) consumables[id] = (consumables[id] || 0) + 1; }
  $('cardChoiceScreen').style.display = 'none';
  updateScore(); updateLivesDisplay(); startNextRound();
}

// ===== BOSS =====

function clearBossEffects() {
  if (bossEffectInterval) { clearInterval(bossEffectInterval); bossEffectInterval = null; }
  if (memoryTimeout) { clearTimeout(memoryTimeout); memoryTimeout = null; }
  const img = $('rogueFlag');
  img.className = ''; img.style.filter = ''; img.style.transform = '';
  img.style.visibility = 'visible';
  const cont = document.querySelector('#rogueCard .flag-container');
  if (cont) { cont.style.overflow = ''; }
}

function applyBossEffect() {
  const img = $('rogueFlag');
  const cont = document.querySelector('#rogueCard .flag-container');
  const bt = currentBossType;
  if (!bt) return;

  if (bt.id === 'mirror') { img.classList.add('boss-mirror'); }
  else if (bt.id === 'flip') { img.classList.add('boss-flip'); }
  else if (bt.id === 'negative') { img.classList.add('boss-negative'); }
  else if (bt.id === 'zoom') {
    cont.style.overflow = 'hidden';
    let scale = CONFIG.ZOOM_START_SCALE;
    img.style.transform = `scale(${scale})`;
    bossEffectInterval = setInterval(() => {
      if (answered) return;
      scale = Math.max(CONFIG.ZOOM_MIN_SCALE, scale - CONFIG.ZOOM_STEP_REDUCE);
      img.style.transform = `scale(${scale})`;
      if (scale <= CONFIG.ZOOM_MIN_SCALE) clearInterval(bossEffectInterval);
    }, CONFIG.ZOOM_STEP_MS);
  }
  else if (bt.id === 'pixel') {
    let blur = CONFIG.PIXEL_START_BLUR;
    img.style.filter = `blur(${blur}px)`;
    bossEffectInterval = setInterval(() => {
      if (answered) return;
      blur = Math.max(0, blur - CONFIG.PIXEL_STEP_REDUCE);
      img.style.filter = blur > 0 ? `blur(${blur}px)` : '';
      if (blur <= 0) clearInterval(bossEffectInterval);
    }, CONFIG.PIXEL_STEP_MS);
  }
  else if (bt.id === 'memory') {
    img.style.visibility = 'visible';
    memoryTimeout = setTimeout(() => {
      if (!answered) img.style.visibility = 'hidden';
    }, CONFIG.MEMORY_DISPLAY_MS);
  }
}

function prepareBossFlags(bossType) {
  if (bossType.id === 'historical') {
    // Use historical flags instead of regular countries
    return shuffle([...HISTORICAL_FLAGS]).slice(0, CONFIG.BOSS_FLAGS);
  }
  return generateFlags(CONFIG.BOSS_FLAGS, act);
}

function startBoss() {
  inBoss = true;
  currentBossType = BOSS_TYPES[Math.floor(Math.random() * BOSS_TYPES.length)];
  roundFlags = prepareBossFlags(currentBossType);
  flagIndex = 0; roundResults = []; answered = false;
  preloadImages(roundFlags.filter(f => f.code)); // only preload flagcdn ones
  $('rogueGame').style.display = 'none'; $('cardChoiceScreen').style.display = 'none';
  $('bossIntro').style.display = 'block';
  $('bossIntroIcon').textContent = currentBossType.icon;
  $('bossIntroName').textContent = currentBossType.name;
  $('bossIntroDesc').textContent = currentBossType.desc;
}

function startBossById(bossId) {
  inBoss = true;
  currentBossType = BOSS_TYPES.find(b => b.id === bossId) || BOSS_TYPES[0];
  roundFlags = prepareBossFlags(currentBossType);
  flagIndex = 0; roundResults = []; answered = false;
  preloadImages(roundFlags.filter(f => f.code));
  $('godPanel').style.display = 'none';
  $('rogueGame').style.display = 'none'; $('cardChoiceScreen').style.display = 'none';
  $('bossIntro').style.display = 'block';
  $('bossIntroIcon').textContent = currentBossType.icon;
  $('bossIntroName').textContent = currentBossType.name;
  $('bossIntroDesc').textContent = currentBossType.desc;
}

function dismissBossIntro() {
  $('bossIntro').style.display = 'none'; $('rogueGame').style.display = 'block';
  updateActRoundDisplay(); updateActDots(); updateLivesDisplay(); updateRogueProgress(); updateScore(); renderInventory();
  loadRogueFlag();
}

// ===== ACT TRANSITION =====
function showActScreen() {
  $('rogueGame').style.display = 'none'; $('cardChoiceScreen').style.display = 'none';
  $('bossIntro').style.display = 'none'; $('actScreen').style.display = 'block';
  const titles = { 1: "Acte I — Terres connues", 2: "Acte II — Horizons lointains", 3: "Acte III — Terra incognita" };
  $('actTitle').textContent = titles[act] || `Acte ${act}`;
  $('actSubtitle').textContent = act === 1 ? "Les drapeaux les plus célèbres" : act === 2 ? "La difficulté augmente..." : "Seuls les experts survivent";
}
function dismissActScreen() { $('actScreen').style.display = 'none'; $('rogueGame').style.display = 'block'; startNextRound(); }

// ===== GAME FLOW =====

function startRun() {
  lives = CONFIG.STARTING_LIVES; score = 0; act = 1; round = 0;
  totalCorrect = 0; totalWrong = 0;
  usedCountries = new Set(); permanents = {}; consumables = {};
  secondWindUsed = false; revealedLettersOnCurrent = [];
  inBoss = false; currentBossType = null; history = []; roundResults = [];
  clearBossEffects(); stopTimer();
  $('rogueEnd').style.display = 'none'; $('cardChoiceScreen').style.display = 'none';
  $('bossIntro').style.display = 'none'; $('timeTravelScreen').style.display = 'none';
  updateScore(); showActScreen();
}

function startNextRound() {
  clearBossEffects();
  if (inBoss) {
    inBoss = false; currentBossType = null; act++; round = 1;
    if (act > CONFIG.ACTS) { victory(); return; }
    showActScreen(); return;
  }
  round++;
  if (round > CONFIG.ROUNDS_PER_ACT) { startBoss(); return; }

  roundFlags = generateFlags(CONFIG.FLAGS_PER_ROUND, act);
  flagIndex = 0; roundResults = []; answered = false;

  // Preload next round's potential flags
  const nextTier = act === 1 ? [1,2] : act === 2 ? [2,3] : [3,2];
  const preloadPool = COUNTRIES.filter(c => nextTier.includes(c.tier) && !usedCountries.has(c.code));
  preloadImages(shuffle(preloadPool).slice(0, 7));

  $('rogueGame').style.display = 'block';
  updateActRoundDisplay(); updateActDots(); updateLivesDisplay(); updateRogueProgress(); updateScore(); renderInventory();
  loadRogueFlag();
}

function loadRogueFlag() {
  answered = false; revealedLettersOnCurrent = []; qcmActive = false;
  $('qcmOverlay').style.display = 'none';
  clearBossEffects();
  stopTimer();

  const q = roundFlags[flagIndex];
  const img = $('rogueFlag');

  // Historical boss uses custom URLs
  if (inBoss && currentBossType && currentBossType.id === 'historical') {
    img.src = q.url || flagUrl(q.code);
  } else {
    img.src = flagUrl(q.code);
  }

  // Apply boss effect
  if (inBoss && currentBossType && currentBossType.id !== 'historical') applyBossEffect();

  updateFlagDots();
  $('rogueInput').value = ''; $('rogueInput').disabled = false; $('rogueSubmitBtn').disabled = false;
  $('rogueFeedback').classList.remove('visible');
  $('rogueNextBtn').style.display = 'none'; $('rogueNextHint').style.display = 'none';
  $('roguePassBtn').style.display = ''; $('rogueActionRow').style.display = '';
  $('rogueCard').classList.remove('success', 'fail');

  if (inBoss && currentBossType) { $('bossLabel').textContent = currentBossType.icon + ' ' + currentBossType.name; $('bossLabel').style.display = 'block'; }
  else $('bossLabel').style.display = 'none';

  if (hasPermanent("show_continent") && q.c) { $('rogueContinentHint').textContent = CONTINENT_NAMES[q.c] || ''; $('rogueContinentHint').style.display = 'block'; }
  else $('rogueContinentHint').style.display = 'none';

  $('rogueLetterHint').style.display = 'none';
  renderInventory();
  startTimer();
  $('rogueInput').focus();
}

// ===== TIMER =====

function startTimer() {
  stopTimer();
  flagTimerStart = Date.now();
  updateTimerDisplay();
  flagTimer = setInterval(() => {
    if (answered) { stopTimer(); return; }
    const elapsed = Date.now() - flagTimerStart;
    const remaining = CONFIG.FLAG_TIMER_MS - elapsed;
    updateTimerDisplay();
    if (remaining <= 0) {
      stopTimer();
      timerExpired();
    }
  }, 100);
}

function stopTimer() {
  if (flagTimer) { clearInterval(flagTimer); flagTimer = null; }
  $('timerBar').style.width = '100%';
  $('timerBar').classList.remove('timer-danger');
}

function updateTimerDisplay() {
  const elapsed = Date.now() - flagTimerStart;
  const pct = Math.max(0, 1 - elapsed / CONFIG.FLAG_TIMER_MS) * 100;
  $('timerBar').style.width = pct + '%';
  if (pct < 30) $('timerBar').classList.add('timer-danger');
  else $('timerBar').classList.remove('timer-danger');
}

function timerExpired() {
  if (answered) return;
  const q = roundFlags[flagIndex];
  answered = true; lives--; totalWrong++; roundResults.push('ko');
  const name = q.displayName || cap(q.names[0]);
  history.push({ code: q.code || 'hist', name: name, status: 'ko', userAnswer: '⏱️ Temps écoulé', url: q.url });
  if (lives <= 0 && hasPermanent("second_wind") && !secondWindUsed) { secondWindUsed = true; lives = 1; $('rogueResultText').textContent = '💨 Second souffle !'; }
  else $('rogueResultText').textContent = '⏱️ Temps écoulé ! -1 ❤️';
  $('rogueResultText').className = 'result-text wrong';
  $('rogueAnswerReveal').textContent = 'Réponse : ' + name;
  $('rogueCard').classList.add('fail', 'shake');
  $('rogueFeedback').classList.add('visible');
  lockAfterAnswer();
  updateLivesDisplay(); updateFlagDots(); renderInventory();
  setTimeout(() => $('rogueCard').classList.remove('shake'), 500);
  if (lives <= 0) { /* wait for user to press next */ }
}

function lockAfterAnswer() {
  stopTimer();
  $('rogueInput').disabled = true; $('rogueSubmitBtn').disabled = true;
  $('roguePassBtn').style.display = 'none';
  $('rogueNextBtn').style.display = 'block'; $('rogueNextHint').style.display = 'block';
  // Reveal flag if memory boss
  if (inBoss && currentBossType && currentBossType.id === 'memory') {
    $('rogueFlag').style.visibility = 'visible';
    if (memoryTimeout) { clearTimeout(memoryTimeout); memoryTimeout = null; }
  }
  if (bossEffectInterval) { clearInterval(bossEffectInterval); bossEffectInterval = null; }
}

function checkRogueAnswer() {
  if (answered) return;
  const input = $('rogueInput').value;
  if (!input.trim()) return;
  const q = roundFlags[flagIndex];
  const correct = q.names.some(n => isCloseEnough(input, n));
  const name = q.displayName || cap(q.names[0]);
  answered = true;

  if (correct) {
    totalCorrect++; score += pointsPerFlag(); roundResults.push('ok');
    $('rogueResultText').textContent = `Correct ! +${pointsPerFlag()} pt${pointsPerFlag() > 1 ? 's' : ''}`;
    $('rogueResultText').className = 'result-text correct';
    $('rogueAnswerReveal').textContent = name;
    $('rogueCard').classList.add('success', 'pop');
    history.push({ code: q.code || 'hist', name: name, status: 'ok', userAnswer: input, url: q.url });
  } else {
    totalWrong++; lives--; roundResults.push('ko');
    if (lives <= 0 && hasPermanent("second_wind") && !secondWindUsed) { secondWindUsed = true; lives = 1; $('rogueResultText').textContent = '💨 Second souffle !'; }
    else $('rogueResultText').textContent = 'Raté ! -1 ❤️';
    $('rogueResultText').className = 'result-text wrong';
    $('rogueAnswerReveal').textContent = 'Réponse : ' + name;
    $('rogueCard').classList.add('fail', 'shake');
    history.push({ code: q.code || 'hist', name: name, status: 'ko', userAnswer: input, url: q.url });
  }

  $('rogueFeedback').classList.add('visible');
  lockAfterAnswer();
  updateLivesDisplay(); updateScore(); updateFlagDots(); renderInventory();
  setTimeout(() => $('rogueCard').classList.remove('shake', 'pop'), 500);
  // No auto-gameOver: user must click "Suivant" which will trigger gameOver if lives <= 0
}

function nextRogueFlag() {
  // Check game over when user clicks next
  if (lives <= 0) { gameOver(); return; }
  flagIndex++;
  if (flagIndex >= roundFlags.length) {
    if (inBoss) startNextRound();
    else if (round % 2 === 1) showOddReward();
    else showEvenReward();
  } else loadRogueFlag();
}

// ===== PASS =====

function roguePass() {
  if (answered) return;
  const q = roundFlags[flagIndex];
  const name = q.displayName || cap(q.names[0]);
  answered = true; lives--; totalWrong++; roundResults.push('ko');
  history.push({ code: q.code || 'hist', name: name, status: 'ko', userAnswer: '⏭ Passé', url: q.url });
  if (lives <= 0 && hasPermanent("second_wind") && !secondWindUsed) { secondWindUsed = true; lives = 1; $('rogueResultText').textContent = '💨 Second souffle !'; }
  else $('rogueResultText').textContent = 'Passé ! -1 ❤️';
  $('rogueResultText').className = 'result-text wrong';
  $('rogueAnswerReveal').textContent = 'Réponse : ' + name;
  $('rogueCard').classList.add('fail', 'shake');
  $('rogueFeedback').classList.add('visible');
  lockAfterAnswer();
  updateLivesDisplay(); updateFlagDots(); renderInventory();
  setTimeout(() => $('rogueCard').classList.remove('shake'), 500);
}

// ===== END SCREENS =====

function gameOver() {
  $('rogueGame').style.display = 'none'; $('rogueEnd').style.display = 'block';
  $('rogueEndTitle').textContent = '💀 Game Over'; $('rogueEndTitle').style.color = 'var(--red)';
  $('rogueEndScore').textContent = `${score} points`;
  $('rogueEndDetail').textContent = `Acte ${act} — ${inBoss ? 'Boss' : 'Round ' + round}\n${totalCorrect} bonnes réponses`;
  buildRogueRecap();
}

function victory() {
  $('rogueGame').style.display = 'none'; $('cardChoiceScreen').style.display = 'none';
  $('rogueEnd').style.display = 'block';
  $('rogueEndTitle').textContent = '🏆 Victoire !'; $('rogueEndTitle').style.color = 'var(--accent)';
  $('rogueEndScore').textContent = `${score} points`;
  $('rogueEndDetail').textContent = `Run complétée ! ${totalCorrect} bonnes réponses\n${lives} vie${lives > 1 ? 's' : ''} restante${lives > 1 ? 's' : ''}`;
  buildRogueRecap();
}

function buildRogueRecap() {
  const g = $('rogueRecapGrid'); g.innerHTML = '';
  history.forEach((h, i) => {
    const row = document.createElement('div');
    row.className = `recap-row ${h.status} fade-in`; row.style.animationDelay = (i * 0.03) + 's';
    const imgSrc = h.url || flagUrl(h.code);
    row.innerHTML = `<img class="recap-flag" src="${imgSrc}" alt="${h.name}"><div class="recap-info"><div class="recap-country">${h.name}</div><div class="recap-detail">Votre réponse : ${h.userAnswer}</div></div><span class="recap-badge ${h.status}">${h.status === 'ok' ? '✓' : '✗'}</span>`;
    g.appendChild(row);
  });
}

// ===== TIME TRAVEL =====

let ttFlags = [], ttIndex = 0, ttAnswered = false, ttCorrectCount = 0;

function startTimeTravel() {
  const ttTier = act > 1 ? act - 1 : 1;
  let pool = COUNTRIES.filter(c => c.tier === ttTier && !usedCountries.has(c.code));
  ttFlags = shuffle(pool).slice(0, CONFIG.TIME_TRAVEL_FLAGS);
  if (ttFlags.length < CONFIG.TIME_TRAVEL_FLAGS) {
    const extra = COUNTRIES.filter(c => c.tier <= 2 && !usedCountries.has(c.code) && !ttFlags.find(f => f.code === c.code));
    ttFlags = [...ttFlags, ...shuffle(extra).slice(0, CONFIG.TIME_TRAVEL_FLAGS - ttFlags.length)];
  }
  ttIndex = 0; ttCorrectCount = 0; ttAnswered = false;
  $('rogueGame').style.display = 'none'; $('timeTravelScreen').style.display = 'block';
  loadTimeTravelFlag();
}
function loadTimeTravelFlag() {
  ttAnswered = false; const q = ttFlags[ttIndex];
  $('ttFlag').src = flagUrl(q.code); $('ttCount').textContent = `${ttIndex + 1} / ${CONFIG.TIME_TRAVEL_FLAGS}`;
  $('ttInput').value = ''; $('ttInput').disabled = false; $('ttSubmitBtn').disabled = false;
  $('ttFeedback').classList.remove('visible'); $('ttNextBtn').style.display = 'none';
  $('ttCard').classList.remove('success', 'fail'); $('ttInput').focus();
}
function checkTimeTravelAnswer() {
  if (ttAnswered) return; const input = $('ttInput').value; if (!input.trim()) return;
  const q = ttFlags[ttIndex]; const correct = q.names.some(n => isCloseEnough(input, n));
  ttAnswered = true; $('ttInput').disabled = true; $('ttSubmitBtn').disabled = true;
  if (correct) { ttCorrectCount++; $('ttResultText').textContent = 'Correct ! ✓'; $('ttResultText').className = 'result-text correct'; $('ttCard').classList.add('success', 'pop'); }
  else { $('ttResultText').textContent = 'Raté !'; $('ttResultText').className = 'result-text wrong'; $('ttCard').classList.add('fail', 'shake'); }
  $('ttAnswerReveal').textContent = cap(q.names[0]); $('ttFeedback').classList.add('visible'); $('ttNextBtn').style.display = 'block';
  setTimeout(() => $('ttCard').classList.remove('shake', 'pop'), 500);
}
function nextTimeTravelFlag() {
  ttIndex++;
  if (ttIndex >= CONFIG.TIME_TRAVEL_FLAGS) {
    $('timeTravelScreen').style.display = 'none'; $('rogueGame').style.display = 'block';
    if (ttCorrectCount === CONFIG.TIME_TRAVEL_REQUIRED_CORRECT) {
      const q = roundFlags[flagIndex];
      history.push({ code: q.code, name: cap(q.names[0]), status: 'ok', userAnswer: '⏳ Voyage temporel' });
      totalCorrect++; score += pointsPerFlag(); roundResults.push('ok');
      answered = true; updateScore(); updateFlagDots(); nextRogueFlag();
    } else loadRogueFlag();
  } else loadTimeTravelFlag();
}

// ===== GOD MODE =====

function toggleGodPanel() {
  const p = $('godPanel');
  p.style.display = p.style.display === 'block' ? 'none' : 'block';
}
function godModeAddLife() { lives++; updateLivesDisplay(); }
function godModeBoss(bossId) { startBossById(bossId); }

// ===== KEYBOARD =====

document.addEventListener('DOMContentLoaded', () => {
  $('rogueInput').addEventListener('keydown', e => { if (e.key === 'Enter') { answered ? nextRogueFlag() : checkRogueAnswer(); } });
  $('ttInput').addEventListener('keydown', e => { if (e.key === 'Enter') { ttAnswered ? nextTimeTravelFlag() : checkTimeTravelAnswer(); } });
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      if ($('timeTravelScreen').style.display !== 'none' && ttAnswered) { e.preventDefault(); nextTimeTravelFlag(); return; }
      if (!answered) return; e.preventDefault(); nextRogueFlag();
    }
  });
  initMobileScrollFix();
  startRun();
});
