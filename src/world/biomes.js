/* =====================================================================
   BIOME – sechs visuell eigenständige Gebiete (Sagen-Flavor)
   Gebiet 1-6, danach zyklisch. Jedes Biom steuert Vegetation, Boden,
   Gras-Farben, Pfad, Atmosphären-Tönung und Partikel-Stimmung.
   Namen sind bewusst schöne Komposita (Stufe-4-Lesewelt!).
   ===================================================================== */
export const BIOMES = [
  { /* 1 – Frühlingswald: der vertraute helle Start */
    name: 'WÄCHTERLICHTUNG',
    grassA: [.18, .40, .14], grassB: [.49, .76, .30],
    ground: ['#5c9c44', '#549441', '#6cae50', '#7fbe5d', '#8d9a4c'],
    path: 0xc9b481,
    leaf: { h: .30, hVar: .08, s: .55, l: .38 }, pine: .4, trunk: 0x6e4b2a,
    treeDensity: 1, bushDensity: 1,
    hue: 0, fogMul: 1,
    particle: { color: 0xfff8d0, size: .12 }
  },
  { /* 2 – Birkenhain: licht, luftig, weiße Stämme */
    name: 'BIRKENHAIN',
    grassA: [.25, .42, .12], grassB: [.62, .80, .28],
    ground: ['#6da84a', '#62a046', '#7cb656', '#90c468', '#a8b65a'],
    path: 0xd6c594,
    leaf: { h: .22, hVar: .06, s: .58, l: .46 }, pine: .05, trunk: 0xe8e4da, birch: true,
    treeDensity: 1.25, bushDensity: .7,
    hue: .03, fogMul: .85,
    particle: { color: 0xfffbe0, size: .14 }
  },
  { /* 3 – Goldener Herbstwald: orange, rot, warm */
    name: 'HERBSTWALD',
    grassA: [.34, .28, .08], grassB: [.72, .58, .20],
    ground: ['#9a7a3a', '#8d7034', '#ab8842', '#bd9a50', '#a06a38'],
    path: 0xb89a6e,
    leaf: { h: .06, hVar: .07, s: .72, l: .42 }, pine: .12, trunk: 0x5e4528,
    treeDensity: 1.15, bushDensity: .9,
    hue: -.04, fogMul: .95,
    mood: { fogTint: 0xe8c490, k: .25 },
    particle: { color: 0xffd9a0, size: .16 } /* fallende Blätter-Anmutung */
  },
  { /* 4 – Nebelmoor: sumpfig, dunstig, Irrlichter */
    name: 'NEBELMOOR',
    grassA: [.07, .18, .09], grassB: [.20, .36, .18],
    ground: ['#2e4a2c', '#2a452a', '#365434', '#3e6038', '#34502e'],
    path: 0x8a8268,
    leaf: { h: .35, hVar: .05, s: .35, l: .26 }, pine: .55, trunk: 0x4a4034,
    treeDensity: .7, bushDensity: 1.3,
    hue: .07, fogMul: 1.5,
    mood: { fogTint: 0x96a896, k: .45, sunMul: .85, hemiMul: .9 },
    particle: { color: 0xaaffcc, size: .28, irrlicht: true } /* Irrlichter! */
  },
  { /* 5 – Schratwald: tiefer Nadelwald, moosige Felsen */
    name: 'SCHRATWALD',
    grassA: [.05, .14, .07], grassB: [.15, .30, .14],
    ground: ['#2c4630', '#28402c', '#324e36', '#3a5a3e', '#2e482e'],
    path: 0x9a8a72,
    leaf: { h: .38, hVar: .04, s: .45, l: .22 }, pine: .85, trunk: 0x4f3a26,
    treeDensity: 1.45, bushDensity: .8,
    hue: .05, fogMul: 1.25,
    mood: { fogTint: 0xaabcb4, k: .3, sunMul: .8, hemiMul: .85 },
    particle: { color: 0xd0e8ff, size: .12 }
  },
  { /* 6 – Schattenreich: der verdorbene Hof des Königs */
    name: 'SCHATTENREICH',
    grassA: [.06, .04, .11], grassB: [.20, .13, .30],
    ground: ['#322844', '#2e2440', '#3a2e4e', '#443858', '#2a2238'],
    path: 0x6a5a7e,
    leaf: { h: .76, hVar: .05, s: .30, l: .22 }, pine: .6, trunk: 0x2e2438,
    treeDensity: .9, bushDensity: .5,
    hue: .0, fogMul: 1.35,
    /* minProgress 1: im Schattenreich ist IMMER Geisterstunde */
    mood: { fogTint: 0x3c2f52, k: .6, sunMul: .6, hemiMul: .7, minProgress: 1 },
    particle: { color: 0xc9a0ff, size: .2, irrlicht: true }
  }
];
export function biomeFor(floor) {
  return BIOMES[(floor - 1) % BIOMES.length];
}
