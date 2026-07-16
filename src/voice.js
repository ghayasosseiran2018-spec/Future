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

// Continuous, hands-free recognition: stays listening across multiple
// utterances (continuous + interimResults) instead of one push-to-talk
// capture at a time. onSpeechStart fires the moment the browser detects
// speech-like sound — call sites use it to cut JARVIS off mid-sentence
// (barge-in) the instant the user starts talking, before the utterance
// even finishes transcribing.
export function createRecognizer({ onResult, onInterim, onSpeechStart, onEnd, onError }) {
  if (!SpeechRecognitionImpl) return null;
  const rec = new SpeechRecognitionImpl();
  rec.lang = 'en-US';
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  rec.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const result = e.results[i];
      const transcript = result[0].transcript;
      if (result.isFinal) onResult?.(transcript.trim());
      else onInterim?.(transcript);
    }
  };
  rec.onspeechstart = () => onSpeechStart?.();
  rec.onend = () => onEnd?.();
  rec.onerror = (e) => onError?.(e);
  return {
    start: () => rec.start(),
    stop: () => rec.stop(),
    abort: () => rec.abort(),
  };
}

// JARVIS speaks with a British English voice — preferring a female-sounding
// one where the platform's voice list identifies it as such, since available
// names/genders vary by browser and OS with no reliable structured signal.
const FEMALE_NAME_HINTS = /female|kate|serena|hazel|libby|sonia|fiona|amy|emma|olivia/i;

let voicesCache = null;
function pickVoice() {
  if (!isSynthesisSupported()) return null;
  voicesCache = voicesCache || window.speechSynthesis.getVoices();
  if (!voicesCache.length) voicesCache = window.speechSynthesis.getVoices();

  const british = voicesCache.filter((v) => /^en-gb$/i.test(v.lang));
  const britishFemale = british.find((v) => FEMALE_NAME_HINTS.test(v.name));
  if (britishFemale) return britishFemale;
  if (british.length) return british[0];

  const anyEnglish = voicesCache.filter((v) => /^en[-_]/i.test(v.lang));
  return anyEnglish[0] || voicesCache[0] || null;
}

export function speak(text, handlers = {}) {
  if (!isSynthesisSupported() || !text) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  const voice = pickVoice();
  if (voice) utter.voice = voice;
  utter.lang = 'en-GB';
  utter.rate = 1.0;
  utter.pitch = 1.05;
  utter.onstart = () => handlers.onStart?.();
  utter.onend = () => handlers.onEnd?.();
  utter.onboundary = (e) => handlers.onBoundary?.(e);
  utter.onerror = () => handlers.onEnd?.();
  window.speechSynthesis.speak(utter);
}

export function stopSpeaking() {
  if (isSynthesisSupported()) window.speechSynthesis.cancel();
}
