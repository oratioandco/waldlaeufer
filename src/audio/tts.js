/* ---------- TTS de-DE: koppelt Laut- und Schriftbild ---------- */
export let VOICE_ON = true;

export function setVoiceOn(on) {
  VOICE_ON = on;
  if (!on) try { speechSynthesis.cancel(); } catch (e) {}
}

export function say(text, rate = .95, pitch = .9) {
  if (!VOICE_ON) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'de-DE'; u.rate = rate; u.pitch = pitch;
    const v = speechSynthesis.getVoices().find(v => v.lang && v.lang.startsWith('de'));
    if (v) u.voice = v; speechSynthesis.speak(u);
  } catch (e) {}
}
if ('speechSynthesis' in window) speechSynthesis.getVoices();
