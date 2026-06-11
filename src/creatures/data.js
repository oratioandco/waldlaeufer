/* ---------- Verzauberte Tiere (GLTF lokal) + Blob-Fallback-Parameter ---------- */
export const ANIMALS = [
  { key: 'parrot',   url: '/assets/models/Parrot.glb',   scale: .05,  y: 2.6, name: 'STURM-PAPAGEI',  fb: { color: 0x4ecf6a, eye: 0x0a2812, amp: .5,  squash: .78 }, hp: 70 },
  { key: 'flamingo', url: '/assets/models/Flamingo.glb', scale: .045, y: 2.7, name: 'NEBEL-FLAMINGO', fb: { color: 0xe06a8a, eye: 0xfff3c0, amp: .45, squash: .9 },  hp: 80 },
  { key: 'stork',    url: '/assets/models/Stork.glb',    scale: .045, y: 2.9, name: 'SCHATTEN-STORCH', fb: { color: 0xb9c6dd, eye: 0x10141f, amp: .6,  squash: .85 }, hp: 80 },
  { key: 'horse',    url: '/assets/models/Horse.glb',    scale: .022, y: 0,   name: 'NACHT-MÄHRE', grounded: true, fb: { color: 0x5e7d4a, eye: 0xff8c42, amp: .3, squash: 1 }, hp: 90 }
];
export const BOSSES = [
  { name: 'SCHATTEN-BAUER',    sym: '♟', trophy: '♙', hp: 140 },
  { name: 'SCHATTEN-SPRINGER', sym: '♞', trophy: '♘', hp: 160 },
  { name: 'SCHATTEN-LÄUFER',   sym: '♝', trophy: '♗', hp: 180 },
  { name: 'SCHATTEN-TURM',     sym: '♜', trophy: '♖', hp: 200 },
  { name: 'SCHATTEN-DAME',     sym: '♛', trophy: '♕', hp: 230 },
  { name: 'SCHATTEN-KÖNIG',    sym: '♚', trophy: '♔', hp: 260 }
];
