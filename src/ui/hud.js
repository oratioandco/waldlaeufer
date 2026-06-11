/* ---------- HUD: Herzen, Kristalle ---------- */
import { G } from '../state.js';

export function renderHearts() {
  const h = document.getElementById('hearts');
  h.innerHTML = '';
  for (let i = 0; i < 5; i++) h.innerHTML += i < G.hearts ? '❤️' : '🖤';
}
export function renderHUD() {
  document.getElementById('gems').textContent = G.gems;
}
