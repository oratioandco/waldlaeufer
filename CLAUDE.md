# WALDLÄUFER – Projektübergabe (CLAUDE.md)

Lernspiel für ein Kind (10, LRS / Lese-Rechtschreib-Störung). Sieht aus wie ein
Abenteuerspiel (Zelda-/Fortnite-Gefühl), die Leseförderung ist unsichtbar in
die Spielmechanik eingebaut. Zielgerät: iPad (auch ältere), Safari, touch-first.
Referenz-Implementierung: `waldlaeufer-final.html` (funktionierender
Single-File-Prototyp, ~1700 Zeilen, Three.js r128).

## Nicht verhandelbar: Lerntherapie-Invarianten

Diese Prinzipien sind das Fundament. Kein Feature darf sie verwässern.

1. **Silbensynthese (Reuter-Liehr):** Wörter werden aus Silbenkarten in
   Reihenfolge zusammengesetzt. Zweifarbige Silbengliederung (alternierend),
   erhöhter Buchstabenabstand (Crowding-Reduktion, Zorzi et al. PNAS 2012),
   Verdana o.ä. serifenlos.
2. **Leitner-Lern-Engine (in Referenzdatei implementiert & getestet):**
   - Jedes Wort hat Box 0–4. Fehlerfrei → Box+1, Fehler → Box−1.
   - Fehlerwörter werden nach 2–3 anderen Wörtern wiedervorgelegt
     (verteiltes Wiederholen), nie sofort.
   - Keine Direkt-Wiederholung desselben Wortes.
   - **Mastery-Gating:** neue Stufe erst bei ≥70 % der aktuellen Stufe Box≥2.
   - 20 % Festigungs-Wiederholungen gemeisterter Wörter niedrigerer Stufen.
   - 4 Stufen lautgetreuer Progression: offene 2-Silber → mehrsilbig →
     Konsonantenhäufungen → Klasse 4/5 (Morpheme, Komposita).
3. **Drei Leseebenen als drei Mechaniken:** Zaubern/Brücken = Dekodieren;
   Schildwort-Blitzlesen (häufige Funktionswörter + visuell ähnliche
   Distraktoren) = Automatisierung; Flüsterblumen (Satz lesen, in Handlung
   übersetzen, KEIN Vorsprechen vor dem ersten Fehler) = Sinnentnahme.
   Begriffs-Stil: deutsches Kinderfantasy-Vokabular (Flüsterblumen,
   Schlüsselwort, Volltreffer) – keine technisch-militärischen oder
   Gamer-Anglizismen in kindgerichteten Texten.
4. **Fehler kosten nie Punkte oder Fortschritt.** Gestuftes Scaffolding:
   1. Fehler → Wort wird vorgesprochen; 2. Fehler → richtige Karte pulsiert +
   Silbe wird gesprochen. Fehlerfreies Lesen → KRITISCH + Combo (Belohnung
   statt Bestrafung).
5. **Feedback eindeutig:** Erfolg heißt „RICHTIG!", niemals mehrdeutige
   Begriffe (Lektion gelernt: „GEBLOCKT!" als Erfolgsmeldung wurde als
   Fehler verstanden).
6. **TTS de-DE** koppelt Laut- und Schriftbild; 📯-Button wiederholt jederzeit.
7. **~10 Wörter pro Gebiet**, Checkpoint = natürliche Pausenstelle.
8. **Eltern-/Therapeuten-Panel** mit Live-Report (Wörter geübt,
   Fehlerfrei-Quote, Mastery-Balken je Stufe), Session-Historie und
   Spielstand-Export/-Import als Datei (Gerätewechsel, kein Account).
   **Wortschatz-Pakete** (umgesetzt: `words.json` → `packs`, GWS
   Klasse 1/2 + 3/4; Lesestufe ≠ Jahrgangsstufe bei LRS!) – jedes
   Paket intern in der 4-Stufen-Progression, Auswahl ersetzt alle
   vier Stufen per `setCustomWords`. Mastery-Gating regelt das Tempo.
   Eigene Förderwörter pro Profil direkt im Panel eintragbar
   (Format: „Ba-na-ne", Bindestrich = Silbengrenze); neue Wörter
   sprechen sofort per Web-Speech-Fallback, Studio-Stimme beim
   nächsten `npm run voices` (Generator liest auch `packs`).
   WICHTIG: Wortlisten gelten PRO PROFIL → Bearbeitung nur im Spiel,
   auf dem Startbildschirm gesperrt (sonst ginge die Wahl verloren).
9. **Audio-First (LRS!):** Kein kindgerichteter Text darf Lese-
   Voraussetzung sein, um im Spiel weiterzukommen. Jedes Overlay/
   Banner für das Kind wird vertont oder hat eine Sound-Signatur.
   Gelesen wird NUR der Therapie-Inhalt (Silben, Wörter, Befehlssätze).
10. Narrativ gewaltarm: verzauberte Tiere werden **befreit**, nicht
   getötet; auch die Wächter-Bosse werden erlöst.

## Bekannte technische Fallstricke (bereits gelöst – nicht erneut einbauen)

- **Anim-System:** Animationen, die innerhalb eines `update()` gestartet
  werden, gehen bei `anims.filter()` verloren (Gegner blieb unsichtbar auf
  scale 0.001). Lösung: Snapshot-Iteration (`const cur=anims; anims=[];
  for(...) if(!a.update(dt)) anims.push(a)`).
- **Sichtkorridor:** Dekor braucht Mindestabstand zu Pfad & Stationen
  (Baum ≥9 m, Busch ≥5,5 m, Stein ≥4,5 m), sonst verdecken Kronen die Kamera.
  Beim Gebietswechsel altes Dekor nahe der neuen Route entfernen.
- **Silbenkarten:** `depthTest:false, renderOrder:10` → nie verdeckt.
  Layout adaptiv aus FOV/Aspect berechnen (Portrait mehrzeilig, dist 6,4;
  Landscape einzeilig, dist 4,4).
- **GLTF:** r128 braucht GLTFLoader separat; Modelle lokal ins Repo legen
  (bisher threejs.org-CDN mit Blob-Fallback). Nur 1 Gegner gleichzeitig →
  Modell-Instanzen wiederverwenden statt SkeletonUtils-Clone.
- **Qualitätsstufen + AUTO-FPS-Governor** (runter <40 fps, hoch >56 fps)
  beibehalten: Pixel-Ratio, Schatten-Map, Bloom an/aus, Grasdichte,
  Dekordichte. Ältere iPads sind Zielgeräte.

## Architektur-Vorschlag

Vite + vanilla JS (oder TS), Three.js aktuell (Migration von r128 ok):

```
src/
  main.js            // Bootstrap, Loop
  engine/            // Renderer, Post (Bloom/ACES), Quality, Anims (Snapshot!)
  world/             // Terrain, Pfad/Stationen, Sichtkorridor, Vegetation, Sky
  creatures/         // GLTF-Lader, Spawning, Boss-Phasen
  learning/          // Leitner-Engine + Wortlisten (JSON, austauschbar!)
  challenges/        // Zaubern, Blitzlesen, Befehle, Minigames
  story/             // Dialog-/Szenen-System
  audio/             // Musik-Layer, SFX, TTS-Wrapper
  ui/                // HUD, Overlays, Eltern-Panel
  meta/              // Tokens, Outfits, Speicherstand (localStorage)
public/assets/       // GLB-Modelle, Musik, Texturen (lokal!)
```

Dev-Server mit `--host` starten → Live-Test auf dem iPad im selben WLAN.

**Gameplay-Konventionen:**
- Alle 💎-Belohnungen laufen über `spawnGemReward()` aus
  `src/challenges/reward.js` (Juwel steigt auf → Strahlen + Klang →
  Flug zum HUD-Zähler → Zähler tickt hörbar hoch). Kein direktes
  `G.gems += n` an Spielstellen.
- Gegner sind immer Schattengeister (Shader-Blobs) – auf Tiere wird
  nie geschossen. Das GLTF-Tier erscheint erst bei der Befreiung
  (dem Spieler zugewandt, dann Abflug; Modell-Front ist +z).
- Speicherstand: lokale Spieler-Profile über `src/meta/save.js`
  (localStorage, KEIN Account/Backend – Lerndaten eines Kindes bleiben
  auf dem Gerät). Gespeichert wird nach jedem Wort, jeder Station und
  beim Gebietswechsel; Wiedereinstieg am Anfang des aktuellen Gebiets.
  Neue Spielzustände (z.B. Kosmetik) gehören in collectAll/restoreAll.

## Self-Test (Dev-Server, Chrome)

Der laufende Gebiets-Run (Reise → Encounter) überschreibt sonst Kamera,
`G.mode` und blendet den Gegner wieder ein – das macht isolierte Tests von
Lager & Minispielen unmöglich. Dafür gibt es eine **Sandbox**:

- `G.sandbox` (state.js) legt die Encounter-Statemaschine still. Guards in
  `advance` / `startWordChallenge` / `mobTurn` / `startChest` / `startBefehl`
  prüfen das Flag (in Produktion nie gesetzt → kein Effekt).
- Dev-Hooks (nur DEV) auf `window.__dbg`:
  - `__dbg._sandbox(pos?, focus?)` – ruhige, gegnerfreie Lichtung + stabile Kamera.
  - `__dbg.fish()` / `__dbg.arch()` / `__dbg.fireflies()` / `__dbg.camp()` –
    Sandbox + Minispiel/Lager starten; das Modul liegt danach unter `__dbg.mod`.
  - `__dbg.unsandbox()` – Normalbetrieb zurück.
- Test-Hooks der Minispiele: `fishing.tapFish` / `fireflies.tapFirefly` direkt
  aufrufbar; `archery._dbg.shoot(sx,sy,power)` löst den vollen Schuss-Flow ohne
  synthetische Pointer-Events aus und gibt `{hits,uv}` zurück (Bullseye = uv 0.5,0.5).
- Falle im Headless-Browser: synthetische `PointerEvent`s in einer Microtask-Kette
  werden unzuverlässig zugestellt → die direkten Hooks nutzen. Belohnungs-Ketten
  (Pfeilflug + Juwel-Tick) laufen bei gedrosseltem rAF langsamer als real → zwischen
  zwei Schüssen lange warten (sonst blockt `busyShot`).

## Deployment

- **Live:** https://waldlaeufer.oratio.co (HTTPS via Traefik/Let's Encrypt)
- **Auto-Deploy:** Push auf `main` → GitHub-App-Webhook → Coolify baut
  (statischer Nixpacks-Build, `publish_directory: dist`).
- Repo: `oratioandco/waldlaeufer` (privat) · Coolify-App-UUID:
  `aifvy3jyq90bky60fwjv2fuu` · manuell: `coolify deploy aifvy3jyq90bky60fwjv2fuu`
- Webhook-Route: nur `coolify.oratio.co/webhooks` ist öffentlich
  (`/data/coolify/proxy/dynamic/coolify-webhooks.yaml` auf dem Coolify-Host);
  Dashboard/API bleiben Tailscale-only.

## Roadmap (gewünschte Features, priorisiert)

**1. Atmosphäre** – dynamisches Licht (Tageszeit-Verlauf pro Gebiet:
Morgen → Abend → Dämmerung beim Boss), bessere Skybox (Gradienten +
Sonnen-/Wolkenshader oder HDRI), Gottesstrahlen, Nebelschichten,
Farbstimmung je Gebiet.

**2. Storytelling** – Rahmenhandlung in kurzen, VORGELESENEN Szenen
(Text optional einblendbar = freiwilliges Zusatzlesen, nie Pflicht-Lesehürde):
Der Schwarze König hat die Tiere des Waldes verzaubert; ein Erzähler/Begleiter
(z.B. ein befreites erstes Tier) kommentiert Fortschritt, Bosse bekommen
Persönlichkeit und 1–2 Dialogzeilen. Befreite Tiere tauchen im „Lager" wieder
auf (sichtbarer Fortschritt).

**3. Boss-Fights aufwerten** – mehr HP allein reicht nicht: Phasen
(z.B. Phase 2 ab 50 %: Wort + Schildwort im Wechsel, Arena verdunkelt sich),
eigene Angriffsmuster pro Schachfigur (Springer springt, Turm rammt),
Beschwören kleiner Helfer, finale „Befreiungs-Sequenz" mit Kamera-Fahrt.
Schwierigkeit über Mechanik-Tempo, NIE über schwerere Wörter als die
Lern-Engine vorgibt.

**4. Sound & Musik** – Layer-basierte Musik (Erkundung ruhig, Kampf
intensiver, Boss eigenes Thema; Crossfade), Ambience (Vögel, Wind, Bach),
SFX-Set. Quellen: Kenney.nl / OpenGameArt (CC0) lokal ins Repo, oder
weiter WebAudio-Synth für SFX. Lautstärkeregler getrennt für
Musik/SFX/Stimme (Stimme muss immer verständlich bleiben!).

**5. Minigames (nach Gebieten, als Belohnung)** – ZWEI Kategorien:

  **5a. Lese-Minispiele** (Lese-Kern, aber neues Gefühl) – andere
  Gameplay-Mechaniken fürs gleiche Lerntherapie-Ziel:
  - Silben-Angeln (umgesetzt: `src/challenges/fishing.js`, 🎣 im Lager):
    Zielwort-Silben treiben über einen Teich, in Lesereihenfolge antippen.
  - Wort-Bogenschießen (in Arbeit: `src/challenges/archery.js`, 🏹 im
    Lager): Zielscheiben mit Wörtern, Erzähler nennt das Ziel. WICHTIG –
    echte Bogen-Mechanik: Nutzer SPANNT den Bogen (halten = Kraft lädt),
    ZIELT (Finger bewegt das Fadenkreuz), löst aus; **Extra-Kristalle je
    nach Treffer-Nähe zum Bullseye** (Ring-Wertung). Fehlschuss/falsches
    Wort kostet nichts (Therapie-Invariante 4).
  - Schatzkarte (geplant): Anweisungssätze lesen → Weg abgehen.

  **5b. REINE Belohnungs-Minispiele OHNE Wortbezug** (Wunsch 2026-06):
  echte Spiel-Pausen als Belohnung, die NICHTS mit Lesen/Wörtern zu tun
  haben – reiner Spaß/Geschicklichkeit (z.B. Geschicklichkeit, Sammeln,
  Timing). Bewusst getrennt von 5a, damit das Kind auch mal „nur spielen"
  darf. Kurz (60–90 s), optional, nach Gebiets-Sieg im Lager.

  Alle Minispiele: kurz (60–90 s), optional, Audio-First, kein
  Pflicht-Lesen zum Weiterkommen.

**6. Meta-Progression** – Tokens (💎 bereits da) ausgeben können:
Outfits/Skins für den Zauberstab/Umhang/Begleiter-Tier, kosmetisch,
nie Pay-to-Win-Logik gegen die Lern-Engine. Wächter-Sammlung als
Langzeitziel (die Schach-Metapher wurde 2026-06 bewusst ersetzt:
Bosse sind die sechs vom Schatten verdorbenen WÄCHTER DES WALDES –
Wolf, Bärin, Fuchs, Adler, Hirsch, zuletzt der Schwarze König selbst.
Sie werden ERLÖST, nicht besiegt; die befreiten Wächter sind die
Sammlung). Speicherstand in localStorage (Lernstand UND Kosmetik),
Export/Import als Datei für Gerätewechsel.

## Definition of Done je Feature
Läuft auf älterem iPad mit ≥40 fps (AUTO-Stufe darf greifen) · verletzt keine
Therapie-Invariante · Feedback-Texte kindgerecht und eindeutig ·
Eltern-Report weiterhin korrekt.
