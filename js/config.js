// js/config.js — Paramètres de jeu centralisés

const CONFIG = {
  // Structure
  ACTS: 3,
  ROUNDS_PER_ACT: 4,
  FLAGS_PER_ROUND: 5,
  BOSS_FLAGS: 3,

  // Lives
  STARTING_LIVES: 3,

  // Points
  POINTS_PER_ACT: { 1: 1, 2: 2, 3: 3 },
  BONUS_POINTS_REWARD: 3,

  // Boss Mémoire
  MEMORY_DISPLAY_MS: 3000,

  // Boss Pixelisé
  PIXEL_START_BLUR: 20,     // px blur au début
  PIXEL_STEP_MS: 1500,      // intervalle entre chaque réduction
  PIXEL_STEP_REDUCE: 4,     // réduction du blur à chaque step

  // Boss Zoom
  ZOOM_START_SCALE: 4,      // zoom initial (ne voit qu'1/4 du drapeau)
  ZOOM_STEP_MS: 1500,       // intervalle entre chaque dézoom
  ZOOM_STEP_REDUCE: 0.6,    // réduction du scale à chaque step
  ZOOM_MIN_SCALE: 1,        // scale finale (drapeau entier)

  // Preload
  PRELOAD_ENABLED: true,

  // Time travel
  TIME_TRAVEL_FLAGS: 2,
  TIME_TRAVEL_REQUIRED_CORRECT: 2,
};
