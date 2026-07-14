// Thin wrapper over the browser's built-in Web Speech API — no external
// service, no API key. Chrome/Edge support both recognition and synthesis
// natively; other browsers may support synthesis only (or neither), so every
// call site must treat this as optional and fall back to typed text.

const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;

export function isRecognitionSupported() {
  return !!SpeechRecognitionImpl;
}

export function isSynthesisSupported() {
  return 'speechSynthesis' in window;
}

export function createRecognizer({ onResult, onEnd, onError }) {
  if (!SpeechRecognitionImpl) return null;
  const rec = new SpeechRecognitionImpl();
  rec.lang = 'en-US';
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  rec.onresult = (e) => {
    const text = Array.from(e.results)
      .map((r) => r[0].transcript)
      .join(' ');
    onResult?.(text);
  };
  rec.onend = () => onEnd?.();
  rec.onerror = (e) => onError?.(e);
  return {
    start: () => rec.start(),
    stop: () => rec.stop(),
  };
}

let voicesCache = null;
function pickVoice() {
  if (!isSynthesisSupported()) return null;
  voicesCache = voicesCache || window.speechSynthesis.getVoices();
  if (!voicesCache.length) voicesCache = window.speechSynthesis.getVoices();
  return voicesCache.find((v) => /en[-_]/i.test(v.lang)) || voicesCache[0] || null;
}

export function speak(text) {
  if (!isSynthesisSupported() || !text) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  const voice = pickVoice();
  if (voice) utter.voice = voice;
  utter.rate = 1.02;
  utter.pitch = 0.95;
  window.speechSynthesis.speak(utter);
}

export function stopSpeaking() {
  if (isSynthesisSupported()) window.speechSynthesis.cancel();
}
