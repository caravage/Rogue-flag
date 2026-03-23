// js/leaderboard.js — Supabase leaderboard

const SUPABASE_URL = "https://gmdducvdwwltaspsuier.supabase.co";
const SUPABASE_KEY = "sb_publishable_GwLUx3BX-QFyY9Sb6t4Ryw_ypL_qQJ2";
const SUPABASE_TABLE = "leaderboard";

function supabaseHeaders() {
  return {
    "Content-Type": "application/json",
    "apikey": SUPABASE_KEY,
    "Authorization": "Bearer " + SUPABASE_KEY,
  };
}

// Submit a score
async function submitScore(pseudo, score, actReached, roundReached, totalCorrect) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}`, {
      method: "POST",
      headers: supabaseHeaders(),
      body: JSON.stringify({
        pseudo: pseudo.trim(),
        score: score,
        act_reached: actReached,
        round_reached: roundReached,
        total_correct: totalCorrect,
      }),
    });
    return res.ok;
  } catch (e) {
    console.error("Leaderboard submit error:", e);
    return false;
  }
}

// Fetch top scores
async function fetchLeaderboard(limit = 10) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?select=pseudo,score,act_reached,round_reached,total_correct,created_at&order=score.desc&limit=${limit}`,
      { headers: supabaseHeaders() }
    );
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    console.error("Leaderboard fetch error:", e);
    return [];
  }
}

// Render leaderboard into a container element
function renderLeaderboard(entries, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;

  if (entries.length === 0) {
    el.innerHTML = '<div class="lb-empty">Aucun score enregistré</div>';
    return;
  }

  let html = '<table class="lb-table">';
  html += '<thead><tr><th>#</th><th>Pseudo</th><th>Score</th><th>Progression</th><th>Date</th></tr></thead>';
  html += '<tbody>';
  entries.forEach((e, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
    const date = new Date(e.created_at).toLocaleDateString('fr-FR');
    const prog = e.act_reached >= 4 ? 'Victoire !' : `Acte ${e.act_reached} — ${e.round_reached}`;
    html += `<tr class="${i < 3 ? 'lb-top' : ''}">
      <td>${medal}</td>
      <td class="lb-pseudo">${escapeHtml(e.pseudo)}</td>
      <td class="lb-score">${e.score}</td>
      <td class="lb-prog">${prog}</td>
      <td class="lb-date">${date}</td>
    </tr>`;
  });
  html += '</tbody></table>';
  el.innerHTML = html;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
