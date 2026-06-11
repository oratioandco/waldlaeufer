/* ---------- Animations-System ----------
   WICHTIG: Snapshot-Iteration! Animationen, die innerhalb eines update()
   gestartet werden, gehen bei anims.filter() verloren. Deshalb: Array
   austauschen, Snapshot durchlaufen, Überlebende zurückschieben. */
let anims = [];

export function addAnim(a) { anims.push(a); }

export function updateAnims(dt) {
  const cur = anims; anims = [];
  for (let i = 0; i < cur.length; i++) {
    if (!cur[i].update(dt)) anims.push(cur[i]);
  }
}

export function easeInOut(k) { return k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; }
export function easeOut(k) { return 1 - Math.pow(1 - k, 3); }
