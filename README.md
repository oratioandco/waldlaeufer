# WALDLÄUFER 🌲

Lernspiel für Kinder mit LRS — sieht aus wie ein Abenteuerspiel,
die Leseförderung (Silbensynthese, Blitzlesen, Sinnentnahme) ist
unsichtbar in die Spielmechanik eingebaut.

**Live:** https://waldlaeufer.oratio.co

## Entwicklung

```bash
npm install
npm run dev     # startet mit --host → Test auf dem iPad im selben WLAN
npm run build   # Produktions-Build nach dist/
```

Deployment: automatisch bei Push auf `main` (Coolify, statischer
Nixpacks-Build aus `dist/`).

Konzept, Therapie-Invarianten und Roadmap: siehe [CLAUDE.md](CLAUDE.md).
Wortlisten der Lern-Engine: `src/learning/words.json` (austauschbar).
