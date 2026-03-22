// js/rogue.js
// Mode Rogue-like — 3 actes, 4 rounds, cartes bonus

// ===== CONFIG =====
const ACTS = 3;
const ROUNDS_PER_ACT = 4;
const STARTING_LIVES = 3;
const MIN_FLAGS = 5;
const MAX_FLAGS = 7;

// ===== CARDS =====
const ALL_CARDS = [
  {
    id: "extra_life",
    name: "Vie supplémentaire",
    icon: "❤️‍🔥",
    desc: "Toutes les 5 bonnes réponses, gagnez 1 vie.",
    stackable: false,
  },
  {
    id: "random_letter",
    name: "Lettre révélée",
    icon: "🔤",
    desc: "Une lettre au hasard du pays est affichée. Cumulable.",
    stackable: true,
  },
  {
    id: "show_continent",
    name: "Continent affiché",
    icon: "🗺️",
    desc: "Le continent du pays est toujours visible.",
    stackable: false,
  },
  {
    id: "second_wind",
    name: "Second souffle",
    icon: "💨",
    desc: "La première fois que vous tombez à 0 vie, revenez à 1.",
    stackable: false,
  },
  {
    id: "momentum",
    name: "Élan",
    icon: "⚡",
    desc: "Toutes les 3 bonnes réponses d'affilée, une lettre est révélée sur le suivant.",
    stackable: false,
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
let consecutiveCorrect = 0;
let runCorrectCount = 0; // for extra_life card
let usedCountries = new Set();
let activeCards = []; // card ids collected
let secondWindUsed = false;
let momentumLettersNext = 0; // extra letters from momentum for next flag
let history = []; // full run history

// ===== HELPERS =====

function getPool(tierNum) {
  return COUNTRIES.filter(c => c.tier === tierNum && !usedCountries.has(c.code));
}

function generateRoundFlags() {
  const count = MIN_FLAGS + Math.floor(Math.random() * (MAX_FLAGS - MIN_FLAGS + 1));
  let picked = [];

  // Priorité par acte : on pioche d'abord dans le tier principal,
  // puis on complète avec le tier adjacent si pas assez
  const tierOrder = act === 1 ? [1, 2, 3] : act === 2 ? [2, 1, 3] : [3, 2, 1];

  for (const tier of tierOrder) {
    if (picked.length >= count) break;
    const available = shuffle(getPool(tier)).filter(c => !picked.find(p => p.code === c.code));
    const need = count - picked.length;
    picked = [...picked, ...available.slice(0, need)];
  }

  // Dernier recours : n'importe quel pays pas encore utilisé
  if (picked.length < count) {
    const extra = shuffle(COUNTRIES.filter(c => !usedCountries.has(c.code) && !picked.find(p => p.code === c.code)));
    picked = [...picked, ...extra.slice(0, count - picked.length)];
  }

  // Mélanger l'ordre final et marquer comme utilisés
  picked = shuffle(picked);
  picked.forEach(c => usedCountries.add(c.code));
  return picked;
}

function hasCard(id) { return activeCards.includes(id); }
function cardCount(id) { return activeCards.filter(c => c === id).length; }

function getRevealedLetters(name) {
  const letters = [];
  const n = normalize(name);
  // Random letters from "random_letter" card (stacks)
  const rlCount = cardCount("random_letter");
  // Momentum bonus letters
  const total = rlCount + momentumLettersNext;
  if (total > 0) {
    const indices = [];
    for (let i = 0; i < n.length; i++) {
      if (n[i] !== ' ') indices.push(i);
    }
    const picked = shuffle(indices).slice(0, Math.min(total, indices.length));
    picked.forEach(idx => letters.push({ index: idx, char: n[idx] }));
  }
  return letters;
}

function buildHintDisplay(name, revealedLetters) {
  const n = name.toLowerCase();
  let display = '';
  for (let i = 0; i < n.length; i++) {
    const found = revealedLetters.find(l => l.index === i);
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

// ===== UI =====

function updateLivesDisplay() {
  const el = $('livesDisplay');
  let html = '';
  for (let i = 0; i < lives; i++) html += '❤️';
  if (hasCard("second_wind") && !secondWindUsed) html += ' 💨';
  el.innerHTML = html;
}

function updateActRoundDisplay() {
  $('actDisplay').textContent = `Acte ${act}`;
  $('roundDisplay').textContent = `Round ${round} / ${ROUNDS_PER_ACT}`;
}

function updateRogueProgress() {
  const totalRounds = ACTS * ROUNDS_PER_ACT;
  const done = (act - 1) * ROUNDS_PER_ACT + (round - 1);
  $('rogueProgress').style.width = (done / totalRounds * 100) + '%';
}

function showActiveCards() {
  const el = $('activeCardsDisplay');
  if (activeCards.length === 0) { el.innerHTML = ''; return; }
  const unique = [...new Set(activeCards)];
  el.innerHTML = unique.map(id => {
    const card = ALL_CARDS.find(c => c.id === id);
    const count = cardCount(id);
    return `<span class="active-card-badge" title="${card.desc}">${card.icon}${count > 1 ? ' ×' + count : ''}</span>`;
  }).join('');
}

// ===== CARD CHOICE SCREEN =====

function showCardChoice() {
  $('rogueGame').style.display = 'none';
  $('cardChoiceScreen').style.display = 'block';

  // Pick 2 random cards (avoid giving non-stackable cards already owned)
  let available = ALL_CARDS.filter(c => c.stackable || !hasCard(c.id));
  if (available.length < 2) available = [...ALL_CARDS]; // fallback
  const picks = shuffle(available).slice(0, 2);

  const container = $('cardChoices');
  container.innerHTML = '';
  picks.forEach(card => {
    const el = document.createElement('div');
    el.className = 'card-choice fade-in';
    el.innerHTML = `
      <div class="card-choice-icon">${card.icon}</div>
      <div class="card-choice-name">${card.name}</div>
      <div class="card-choice-desc">${card.desc}</div>
    `;
    el.onclick = () => pickCard(card.id);
    container.appendChild(el);
  });
}

function pickCard(cardId) {
  activeCards.push(cardId);
  // Animate pick
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
  consecutiveCorrect = 0; runCorrectCount = 0;
  usedCountries = new Set();
  activeCards = [];
  secondWindUsed = false;
  momentumLettersNext = 0;
  history = [];

  $('rogueEnd').style.display = 'none';
  $('cardChoiceScreen').style.display = 'none';
  showActScreen();
}

function startNextRound() {
  round++;

  // Check if we move to next act
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
  updateLivesDisplay();
  updateRogueProgress();
  showActiveCards();
  loadRogueFlag();
}

function loadRogueFlag() {
  answered = false;
  momentumLettersNext = (hasCard("momentum") && consecutiveCorrect > 0 && consecutiveCorrect % 3 === 0) ? Math.floor(consecutiveCorrect / 3) : 0;

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

  // Card effects: continent
  if (hasCard("show_continent")) {
    $('rogueContinentHint').textContent = CONTINENT_NAMES[q.c] || '';
    $('rogueContinentHint').style.display = 'block';
  } else {
    $('rogueContinentHint').style.display = 'none';
  }

  // Card effects: revealed letters
  const revealed = getRevealedLetters(q.names[0]);
  if (revealed.length > 0) {
    $('rogueLetterHint').textContent = buildHintDisplay(q.names[0], revealed);
    $('rogueLetterHint').style.display = 'block';
  } else {
    $('rogueLetterHint').style.display = 'none';
  }

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
    consecutiveCorrect++;
    runCorrectCount++;

    // Extra life card
    if (hasCard("extra_life") && runCorrectCount % 5 === 0) {
      lives++;
      $('rogueResultText').textContent = `Correct ! +1 ❤️ (${runCorrectCount} bonnes réponses)`;
    } else {
      $('rogueResultText').textContent = consecutiveCorrect >= 3 && consecutiveCorrect % 3 === 0 && hasCard("momentum") ? 'Correct ! ⚡ Élan activé !' : 'Correct ! ✓';
    }
    $('rogueResultText').className = 'result-text correct';
    $('rogueAnswerReveal').textContent = cap(q.names[0]);
    $('rogueCard').classList.add('success', 'pop');

    history.push({ code: q.code, name: cap(q.names[0]), status: 'ok', userAnswer: input });
  } else {
    totalWrong++;
    consecutiveCorrect = 0;
    lives--;

    // Second wind
    if (lives <= 0 && hasCard("second_wind") && !secondWindUsed) {
      secondWindUsed = true;
      lives = 1;
      $('rogueResultText').textContent = '💨 Second souffle ! Vous revenez à 1 vie !';
    } else {
      $('rogueResultText').textContent = `Raté ! -1 ❤️`;
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
  setTimeout(() => $('rogueCard').classList.remove('shake', 'pop'), 500);

  // Check game over
  if (lives <= 0) {
    setTimeout(() => gameOver(), 800);
    return;
  }
}

function nextRogueFlag() {
  if (lives <= 0) return;
  flagIndex++;
  if (flagIndex >= roundFlags.length) {
    // Round complete — card choice every 2 rounds
    if (round % 2 === 0 && !(act > ACTS)) {
      showCardChoice();
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
  $('rogueEndDetail').textContent = `Acte ${act} — Round ${round}\n${activeCards.length} carte${activeCards.length > 1 ? 's' : ''} collectée${activeCards.length > 1 ? 's' : ''}`;
  buildRogueRecap();
}

function victory() {
  $('rogueGame').style.display = 'none';
  $('cardChoiceScreen').style.display = 'none';
  $('rogueEnd').style.display = 'block';
  $('rogueEndTitle').textContent = '🏆 Victoire !';
  $('rogueEndTitle').style.color = 'var(--accent)';
  $('rogueEndScore').textContent = `${totalCorrect} bonnes réponses`;
  $('rogueEndDetail').textContent = `Run complétée avec ${lives} vie${lives > 1 ? 's' : ''} restante${lives > 1 ? 's' : ''}\n${activeCards.length} carte${activeCards.length > 1 ? 's' : ''} collectée${activeCards.length > 1 ? 's' : ''}`;
  buildRogueRecap();
}

function buildRogueRecap() {
  const grid = $('rogueRecapGrid');
  grid.innerHTML = '';
  history.forEach((h, i) => {
    const row = document.createElement('div');
    row.className = `recap-row ${h.status} fade-in`;
    row.style.animationDelay = (i * 0.03) + 's';
    const detail = h.status === 'ok' ? `Votre réponse : ${h.userAnswer}` : `Votre réponse : ${h.userAnswer}`;
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

// ===== KEYBOARD =====

document.addEventListener('DOMContentLoaded', () => {
  $('rogueInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') { answered ? nextRogueFlag() : checkRogueAnswer(); }
  });
  document.addEventListener('keydown', e => {
    if (!answered) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nextRogueFlag(); }
  });
  startRun();
});
