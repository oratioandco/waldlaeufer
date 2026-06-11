/* ---------- DOM-Feedback: Announce, Fly-Text, Rot-Blitz ---------- */
import { camera } from '../engine/renderer.js';

export function flashRed() {
  const f = document.getElementById('flash');
  f.style.opacity = .4; setTimeout(() => f.style.opacity = 0, 120);
}
function toScreen(v) {
  const p = v.clone().project(camera);
  return { x: (p.x * .5 + .5) * innerWidth, y: (-p.y * .5 + .5) * innerHeight };
}
export function flyText(worldPos, text, color, size = 30) {
  const s = toScreen(worldPos);
  const d = document.createElement('div');
  d.className = 'fly'; d.textContent = text;
  d.style.cssText += `left:${s.x}px;top:${s.y}px;color:${color};font-size:${size}px`;
  document.getElementById('hud').appendChild(d);
  setTimeout(() => d.remove(), 1050);
}
/* Reward-Collection: 💎 fliegt von der Weltposition zum HUD-Zähler und
   schrumpft dabei (typischer Collect-Flow). onArrive feuert bei Ankunft. */
export function gemFlightToHud(worldPos, onArrive) {
  const s = toScreen(worldPos);
  const d = document.createElement('div');
  d.className = 'gemFly'; d.textContent = '💎';
  d.style.left = s.x + 'px'; d.style.top = s.y + 'px';
  document.body.appendChild(d);
  const target = document.getElementById('gemRow').getBoundingClientRect();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    d.style.left = (target.left + target.width / 2) + 'px';
    d.style.top = (target.top + target.height / 2) + 'px';
    d.style.transform = 'translate(-50%,-50%) scale(.35)';
  }));
  setTimeout(() => {
    d.remove();
    const row = document.getElementById('gemRow');
    row.classList.remove('pop'); void row.offsetWidth; row.classList.add('pop');
    if (onArrive) onArrive();
  }, 700);
}

let announceTimer = null;
export function announce(msg, dur = 1000) {
  const a = document.getElementById('announce');
  if (!msg) { a.classList.remove('on'); return; }
  a.textContent = msg; a.classList.add('on');
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => a.classList.remove('on'), dur);
}
