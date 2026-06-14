/* ---------- Verzauberte Tiere (GLTF lokal) + Blob-Fallback-Parameter ----------
   animals/ = Quaternius-Modelle (rund, animiert, benannte Clips) –
   toon:true zieht sie auf den Welt-Toon-Look um. */
export const ANIMALS = [
  { key: 'parrot',   url: '/assets/models/Parrot.glb',   scale: .05,  y: 2.6, name: 'STURM-PAPAGEI', icon: '🦜',  fb: { color: 0x4ecf6a, eye: 0x0a2812, amp: .5,  squash: .78 }, hp: 70 },
  { key: 'flamingo', url: '/assets/models/Flamingo.glb', scale: .045, y: 2.7, name: 'NEBEL-FLAMINGO', icon: '🦩', fb: { color: 0xe06a8a, eye: 0xfff3c0, amp: .45, squash: .9 },  hp: 80 },
  { key: 'stork',    url: '/assets/models/Stork.glb',    scale: .045, y: 2.9, name: 'SCHATTEN-STORCH', icon: '🦢', fb: { color: 0xb9c6dd, eye: 0x10141f, amp: .6,  squash: .85 }, hp: 80 },
  { key: 'horse',    url: '/assets/models/animals/Horse.glb', scale: .5, y: 0, name: 'NACHT-MÄHRE', icon: '🐴', grounded: true, toon: true, fb: { color: 0x5e7d4a, eye: 0xff8c42, amp: .3, squash: 1 }, hp: 90 }
];
/* Die sechs Wächter des Waldes – vom Schatten des Schwarzen Königs
   verdorben. Bosse werden ERLÖST, nicht besiegt: trophy = der
   befreite Wächter, freed = sein wahrer Name.
   model = echtes 3D-Modell für Befreiungs-Moment + Lager (wo vorhanden). */
export const BOSSES = [
  { name: 'SCHATTEN-WOLF',   freed: 'Der Graue Wolf',     sym: '🐺', trophy: '🐺', hp: 140,
    form: 'wolf',   dark: 0x3a3550, aura: 0x6a78c9,
    model: { key: 'g_wolf', url: '/assets/models/animals/Wolf.glb', scale: .55 } },
  { name: 'SCHATTEN-BÄRIN',  freed: 'Die Alte Bärin',     sym: '🐻', trophy: '🐻', hp: 160,
    form: 'baerin', dark: 0x4a3340, aura: 0xc9836a },
  { name: 'SCHATTEN-FUCHS',  freed: 'Der Rote Fuchs',     sym: '🦊', trophy: '🦊', hp: 180,
    form: 'fuchs',  dark: 0x4e2d3a, aura: 0xd9683c,
    model: { key: 'g_fox', url: '/assets/models/animals/Fox.glb', scale: .5 } },
  { name: 'SCHATTEN-ADLER',  freed: 'Der Steinadler',     sym: '🦅', trophy: '🦅', hp: 200,
    form: 'adler',  dark: 0x2e3c52, aura: 0x6ab0d9 },
  { name: 'SCHATTEN-HIRSCH', freed: 'Der Silberhirsch',   sym: '🦌', trophy: '🦌', hp: 230,
    form: 'hirsch', dark: 0x3e3a2c, aura: 0x9ad06a,
    model: { key: 'g_stag', url: '/assets/models/animals/Stag.glb', scale: .52 } },
  { name: 'DER SCHWARZE KÖNIG', freed: 'Der Gute König',  sym: '👑', trophy: '👑', hp: 260,
    form: 'koenig', dark: 0x241838, aura: 0x9b59c9 }
];
