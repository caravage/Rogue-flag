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
  if (!ni) return false;
  if (ni === nt) return true;
  if (nt.includes(ni) || ni.includes(nt)) return true;
  return levenshtein(ni, nt) <= Math.max(1, Math.floor(nt.length * 0.3));
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
