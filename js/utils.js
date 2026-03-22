// js/utils.js
// Fonctions utilitaires partagées entre les modes

function $(id) { return document.getElementById(id); }

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
  if (!ni || ni.length < 3) return false;
  // Match exact
  if (ni === nt) return true;
  // Multi-word targets: accept if input matches the first word(s) closely
  // Split on spaces and hyphens (normalize already strips hyphens, but names[] may have spaces)
  const targetWords = nt.split(/[\s]+/);
  if (targetWords.length > 1) {
    for (let w = 1; w <= targetWords.length; w++) {
      const partial = targetWords.slice(0, w).join(' ');
      if (partial.length >= 4 && (ni === partial || levenshtein(ni, partial) <= Math.max(1, Math.floor(partial.length * 0.25)))) {
        return true;
      }
    }
  }
  // Substring match only if input is long enough (at least 65% of target, min 4 chars)
  if (ni.length >= Math.max(4, Math.ceil(nt.length * 0.65))) {
    if (nt.includes(ni) || ni.includes(nt)) return true;
  }
  // Levenshtein with 25% tolerance
  return levenshtein(ni, nt) <= Math.max(1, Math.floor(nt.length * 0.25));
}

function shuffle(a) {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function cap(s) {
  return s.split(/[\s-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(s.includes('-') ? '-' : ' ');
}

const FLAG_BASE_URL = "https://flagcdn.com/w320/";
function flagUrl(code) {
  return FLAG_BASE_URL + code + ".png";
}

// Mobile: keep flag visible when keyboard opens
// On iOS, the keyboard pushes the viewport up and auto-scrolls to the input.
// We override this to scroll to the top of the card instead.
function initMobileScrollFix() {
  document.querySelectorAll('input[type="text"]').forEach(input => {
    input.addEventListener('focus', () => {
      // Small delay to let the keyboard open first
      setTimeout(() => {
        const flag = document.querySelector('.flag-container') || document.querySelector('#rogueFlag');
        const card = input.closest('.card');
        const target = card || flag;
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 300);
    });
  });

  // Also handle the visualViewport resize event (more reliable on iOS)
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      const active = document.activeElement;
      if (active && active.tagName === 'INPUT') {
        const card = active.closest('.card');
        if (card) {
          setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
        }
      }
    });
  }
}
