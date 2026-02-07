const SPEECH_RATE = 1.12;
const SPEECH_PITCH = 1;
const SPEECH_VOLUME = 1;

const normalizeSpeechLine = (line) => String(line || "").replace(/\s+/g, " ").trim();

export const createUiSpeechService = ({ maxQueue = 4, defaultTtlMs = 4200 } = {}) => {
  const speechSupported =
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof window.SpeechSynthesisUtterance !== "undefined";
  const synth = speechSupported ? window.speechSynthesis : null;

  let speechUnlocked = false;
  let speechVoice = null;
  let speechIsRunning = false;
  let currentSpeechLine = "";
  const speechQueue = [];

  const pickSpeechVoice = () => {
    if (!speechSupported || !synth) {
      return;
    }
    const voices = synth.getVoices();
    if (!voices.length) {
      return;
    }
    speechVoice =
      voices.find(
        (voice) =>
          /^en(-|_)?US/i.test(voice.lang) && /(aria|jenny|zira|samantha|google)/i.test(voice.name)
      ) ||
      voices.find((voice) => /^en/i.test(voice.lang)) ||
      voices[0];
  };

  const speakNextQueuedLine = () => {
    if (!speechSupported || !synth || !speechUnlocked || speechIsRunning) {
      return;
    }
    const now = Date.now();
    let nextEntry = null;
    while (speechQueue.length > 0 && !nextEntry) {
      const candidate = speechQueue.shift();
      if (!candidate?.line) {
        continue;
      }
      if (candidate.ttlMs > 0 && now - candidate.createdAt > candidate.ttlMs) {
        continue;
      }
      nextEntry = candidate;
    }
    if (!nextEntry) {
      return;
    }
    speechIsRunning = true;
    const nextLine = nextEntry.line;
    currentSpeechLine = nextLine;
    const utterance = new SpeechSynthesisUtterance(nextLine);
    if (speechVoice) {
      utterance.voice = speechVoice;
    }
    utterance.rate = SPEECH_RATE;
    utterance.pitch = SPEECH_PITCH;
    utterance.volume = SPEECH_VOLUME;
    utterance.onend = () => {
      speechIsRunning = false;
      currentSpeechLine = "";
      speakNextQueuedLine();
    };
    utterance.onerror = () => {
      speechIsRunning = false;
      currentSpeechLine = "";
      speakNextQueuedLine();
    };
    synth.speak(utterance);
  };

  const queueLine = (line, options = {}) => {
    const {
      priority = false,
      replaceQueue = false,
      interrupt = false,
      ttlMs = defaultTtlMs,
    } = options;
    const cleaned = normalizeSpeechLine(line);
    if (!speechSupported || !speechUnlocked || !cleaned) {
      return;
    }

    if (interrupt && synth) {
      synth.cancel();
      speechQueue.length = 0;
      speechIsRunning = false;
      currentSpeechLine = "";
    }

    if (replaceQueue) {
      speechQueue.length = 0;
    }

    if (cleaned === currentSpeechLine || speechQueue.some((entry) => entry.line === cleaned)) {
      speakNextQueuedLine();
      return;
    }

    const queueEntry = {
      line: cleaned,
      createdAt: Date.now(),
      ttlMs: Math.max(0, Number(ttlMs) || 0),
    };

    if (priority) {
      speechQueue.unshift(queueEntry);
      if (speechQueue.length > maxQueue) {
        speechQueue.length = maxQueue;
      }
    } else {
      speechQueue.push(queueEntry);
      if (speechQueue.length > maxQueue) {
        speechQueue.splice(0, speechQueue.length - maxQueue);
      }
    }
    speakNextQueuedLine();
  };

  const clearQueue = () => {
    speechQueue.length = 0;
    if (speechSupported && synth) {
      synth.cancel();
    }
    speechIsRunning = false;
    currentSpeechLine = "";
  };

  const unlockSpeech = () => {
    speechUnlocked = true;
    window.removeEventListener("pointerdown", unlockSpeech);
    window.removeEventListener("keydown", unlockSpeech);
    pickSpeechVoice();
    speakNextQueuedLine();
  };

  const initialize = () => {
    if (!speechSupported) {
      return;
    }
    pickSpeechVoice();
    synth.onvoiceschanged = () => {
      pickSpeechVoice();
    };
    window.addEventListener("pointerdown", unlockSpeech, { passive: true });
    window.addEventListener("keydown", unlockSpeech);
  };

  return {
    clearQueue,
    initialize,
    isSupported: speechSupported,
    queueLine,
  };
};
