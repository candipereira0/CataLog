/**
 * Voice Command Engine for CataLog.
 * Uses Web Speech API (SpeechRecognition) to listen for DJ commands
 * and dispatches them to the same actions as keyboard hotkeys.
 */

// ─── Types ───

export type VoiceStatus = "idle" | "listening" | "recognizing" | "error" | "denied" | "unsupported";

export type FlashState = "none" | "success" | "error";

export interface VoiceState {
  status: VoiceStatus;
  /** The most recently recognized transcript */
  transcript: string;
  /** Flash the mic indicator */
  flash: FlashState;
}

export type VoiceStateCallback = (state: VoiceState) => void;

// ─── Action mapping ───

export interface VoiceActionsConfig {
  togglePlay: () => void;
  playNext: () => void;
  playPrevious: () => void;
  setLoop: (bars: number) => void;
  toggleLoop: () => void;
  setCue: (slot: number) => void;
  jumpToCue: (slot: number) => void;
  volumeUp: () => void;
  volumeDown: () => void;
  toggleMute: () => void;
  toggleGigMode: () => void;
  focusSearch: (query?: string) => void;
  openShazam: () => void;
  showToast: (message: string) => void;
  onAISearch?: (query: string) => void;
}

// ─── Browser support detection ───

export function isVoiceSupported(): boolean {
  const w = window as any;
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
}

/** Get the SpeechRecognition constructor (browser-specific) */
function getSpeechRecognitionAPI(): any {
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition;
}

// ─── Toast helper ───

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export function showToast(message: string): void {
  const existing = document.getElementById("voice-toast");
  if (existing) existing.remove();
  if (toastTimer) clearTimeout(toastTimer);

  const toast = document.createElement("div");
  toast.id = "voice-toast";
  toast.className =
    "fixed bottom-24 left-1/2 z-[9999] -translate-x-1/2 rounded-lg bg-gray-900/95 px-4 py-2.5 text-sm font-medium text-white shadow-lg border border-gray-700 backdrop-blur animate-fade-in-up pointer-events-none";
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translate(-50%, 0)";
  });

  toastTimer = setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translate(-50%, 10px)";
    toast.style.transition = "opacity 0.3s ease, transform 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

// ─── Floating indicator ───

let indicatorEl: HTMLDivElement | null = null;
let indicatorTimer: ReturnType<typeof setTimeout> | null = null;

function ensureIndicator(): HTMLDivElement {
  if (indicatorEl && document.body.contains(indicatorEl)) return indicatorEl;

  const el = document.createElement("div");
  el.id = "voice-indicator";
  el.className =
    "fixed bottom-20 left-1/2 z-[9998] -translate-x-1/2 flex items-center gap-2 rounded-full bg-gray-950/90 px-4 py-2 shadow-lg border border-gray-700 backdrop-blur pointer-events-none transition-opacity duration-300";
  el.style.opacity = "0";
  el.innerHTML = `
    <div class="voice-mic-icon flex h-7 w-7 items-center justify-center rounded-full bg-violet-600/20">
      <svg class="h-3.5 w-3.5 text-violet-400" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
      </svg>
    </div>
    <span class="voice-text text-xs text-gray-300 max-w-64 truncate">Listening...</span>
  `;
  document.body.appendChild(el);
  indicatorEl = el;
  return el;
}

export function updateIndicator(transcript: string | null, flash: FlashState = "none"): void {
  const el = ensureIndicator();

  const textEl = el.querySelector(".voice-text");
  if (textEl) {
    if (transcript) {
      textEl.textContent = `Heard: "${transcript}"`;
    } else {
      textEl.textContent = "Listening...";
    }
  }

  const micEl = el.querySelector(".voice-mic-icon") as HTMLElement;
  if (micEl) {
    micEl.classList.remove("bg-green-600/20", "bg-red-600/20", "bg-violet-600/20");
    const svg = micEl.querySelector("svg");
    if (svg) {
      svg.classList.remove("text-green-400", "text-red-400", "text-violet-400");
    }

    if (flash === "success") {
      micEl.classList.add("bg-green-600/20");
      if (svg) svg.classList.add("text-green-400");
    } else if (flash === "error") {
      micEl.classList.add("bg-red-600/20");
      if (svg) svg.classList.add("text-red-400");
    } else {
      micEl.classList.add("bg-violet-600/20");
      if (svg) svg.classList.add("text-violet-400");
    }
  }

  el.style.opacity = transcript || flash !== "none" ? "1" : "0.85";

  if (indicatorTimer) clearTimeout(indicatorTimer);
  if (transcript) {
    indicatorTimer = setTimeout(() => {
      updateIndicator(null, "none");
    }, 2500);
  }
}

export function hideIndicator(): void {
  if (indicatorEl) {
    indicatorEl.style.opacity = "0";
  }
}

export function removeIndicator(): void {
  if (indicatorEl) {
    indicatorEl.remove();
    indicatorEl = null;
  }
  if (indicatorTimer) {
    clearTimeout(indicatorTimer);
    indicatorTimer = null;
  }
}

// ─── Voice Command Engine ───

export class VoiceCommandEngine {
  private recognition: any = null;
  private actions: VoiceActionsConfig;
  private onState: VoiceStateCallback;
  private _active = false;
  private restarting = false;
  private state: VoiceState = {
    status: "idle",
    transcript: "",
    flash: "none",
  };

  constructor(actions: VoiceActionsConfig, onState: VoiceStateCallback) {
    this.actions = actions;
    this.onState = onState;

    if (!isVoiceSupported()) {
      this.state = { ...this.state, status: "unsupported" };
      this.onState(this.state);
      return;
    }
  }

  get active(): boolean {
    return this._active;
  }

  private setState(partial: Partial<VoiceState>) {
    this.state = { ...this.state, ...partial };
    this.onState(this.state);
  }

  private setupRecognition(): any {
    const SpeechRecognitionAPI = getSpeechRecognitionAPI();
    if (!SpeechRecognitionAPI) {
      throw new Error("SpeechRecognition not supported");
    }

    const rec = new SpeechRecognitionAPI();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.maxAlternatives = 1;

    rec.onresult = (event: any) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      const transcript = (finalTranscript || interimTranscript).trim().toLowerCase();

      if (finalTranscript) {
        this.setState({ transcript: finalTranscript, flash: "none" });
        updateIndicator(finalTranscript, "none");
        this.handleCommand(finalTranscript);
      } else if (interimTranscript) {
        updateIndicator(interimTranscript, "none");
      }
    };

    rec.onerror = (event: any) => {
      console.warn("Voice recognition error:", event.error);

      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        this.setState({ status: "denied", flash: "error" });
        this._active = false;
        return;
      }

      if (event.error === "aborted") {
        return;
      }

      if (event.error === "no-speech") {
        this.restartRecognition();
        return;
      }

      this.setState({ flash: "error" });
      updateIndicator(null, "error");

      if (event.error === "network") {
        setTimeout(() => {
          if (this._active) this.restartRecognition();
        }, 1000);
        return;
      }

      this.restartRecognition();
    };

    rec.onend = () => {
      if (this._active && !this.restarting) {
        this.restartRecognition();
      } else if (!this._active) {
        this.setState({ status: "idle" });
        hideIndicator();
      }
    };

    return rec;
  }

  private restartRecognition(): void {
    if (this.restarting || !this._active) return;
    this.restarting = true;

    try {
      this.recognition?.abort();
    } catch {}

    setTimeout(() => {
      if (!this._active) {
        this.restarting = false;
        return;
      }
      try {
        const rec = this.setupRecognition();
        this.recognition = rec;
        rec.start();
        this.restarting = false;
      } catch (e) {
        console.warn("Failed to restart voice recognition:", e);
        this.restarting = false;
        if (this._active) {
          setTimeout(() => this.restartRecognition(), 2000);
        }
      }
    }, 100);
  }

  start(): void {
    if (!isVoiceSupported()) {
      this.setState({ status: "unsupported" });
      this.actions.showToast("Voice commands require Chrome or Edge");
      return;
    }

    if (this._active) return;
    this._active = true;

    this.setState({ status: "listening" });
    updateIndicator(null, "none");
    ensureIndicator();

    try {
      const rec = this.setupRecognition();
      this.recognition = rec;
      rec.start();
    } catch (e: any) {
      if (e?.name === "NotAllowedError" || e?.message?.includes("permission")) {
        this.setState({ status: "denied" });
        this.actions.showToast("Microphone access denied. Please allow mic in browser settings.");
        this._active = false;
      } else {
        this.setState({ status: "error" });
        this.actions.showToast("Could not start voice recognition");
        this._active = false;
        console.error("Voice recognition start error:", e);
      }
    }
  }

  stop(): void {
    this._active = false;
    try {
      this.recognition?.abort();
    } catch {}
    this.recognition = null;
    this.setState({ status: "idle", transcript: "", flash: "none" });
    hideIndicator();
  }

  private handleCommand(transcript: string): void {
    const t = transcript.trim().toLowerCase();
    let matched = false;

    // ─── Playback ───
    if (/^(play|resume)$/.test(t)) {
      this.actions.togglePlay();
      this.actions.showToast("▶ Playing");
      matched = true;
    } else if (/^(pause|stop)$/.test(t)) {
      this.actions.togglePlay();
      this.actions.showToast("⏸ Paused");
      matched = true;
    }
    // ─── Navigation ───
    else if (/^(next track|next song|skip)$/.test(t)) {
      this.actions.playNext();
      this.actions.showToast("⏭ Next track");
      matched = true;
    } else if (/^(previous|go back|prev)$/.test(t)) {
      this.actions.playPrevious();
      this.actions.showToast("⏮ Previous track");
      matched = true;
    }
    // ─── Loop ───
    else if (/^stop loop|disable loop$/.test(t)) {
      this.actions.toggleLoop();
      this.actions.showToast("🔁 Loop disabled");
      matched = true;
    } else if (/^loop (\d+) bars?$/.test(t)) {
      const match = t.match(/^loop (\d+) bars?$/);
      if (match) {
        const bars = parseInt(match[1], 10);
        this.actions.setLoop(bars);
        this.actions.showToast(`🔁 Loop: ${bars} bars`);
        matched = true;
      }
    }
    // ─── Cue ───
    else if (/^cue (one|two|three|four|five|six|seven|eight|nine|\d+)$/.test(t)) {
      const wordToNum: Record<string, number> = {
        one: 1, two: 2, three: 3, four: 4,
        five: 5, six: 6, seven: 7, eight: 8, nine: 9,
      };
      const match = t.match(/^cue (one|two|three|four|five|six|seven|eight|nine|\d+)$/);
      if (match) {
        const num = wordToNum[match[1]] ?? parseInt(match[1], 10);
        this.actions.setCue(num);
        this.actions.showToast(`📍 Cue ${num} set`);
        matched = true;
      }
    } else if (/^jump to cue (one|two|three|four|five|six|seven|eight|nine|\d+)$/.test(t)) {
      const wordToNum: Record<string, number> = {
        one: 1, two: 2, three: 3, four: 4,
        five: 5, six: 6, seven: 7, eight: 8, nine: 9,
      };
      const match = t.match(/^jump to cue (one|two|three|four|five|six|seven|eight|nine|\d+)$/);
      if (match) {
        const num = wordToNum[match[1]] ?? parseInt(match[1], 10);
        this.actions.jumpToCue(num);
        this.actions.showToast(`📍 Jumped to cue ${num}`);
        matched = true;
      }
    }
    // ─── Volume ───
    else if (/^volume up$/.test(t)) {
      this.actions.volumeUp();
      this.actions.showToast("🔊 Volume up");
      matched = true;
    } else if (/^volume down$/.test(t)) {
      this.actions.volumeDown();
      this.actions.showToast("🔉 Volume down");
      matched = true;
    } else if (/^mute$/.test(t)) {
      this.actions.toggleMute();
      this.actions.showToast("🔇 Muted");
      matched = true;
    } else if (/^unmute$/.test(t)) {
      this.actions.toggleMute();
      this.actions.showToast("🔊 Unmuted");
      matched = true;
    }
    // ─── System ───
    else if (/^gig mode$/.test(t)) {
      this.actions.toggleGigMode();
      this.actions.showToast("🎛 Gig Mode activated");
      matched = true;
    } else if (/^exit gig mode$/.test(t)) {
      this.actions.toggleGigMode();
      this.actions.showToast("🎛 Exiting Gig Mode");
      matched = true;
    } else if (/^(shazam|identify this track)$/.test(t)) {
      this.actions.openShazam();
      this.actions.showToast("🎵 Opening Shazam...");
      matched = true;
    }
    // ─── Search ───
    else if (/^search for (.+)$/.test(t)) {
      const match = t.match(/^search for (.+)$/);
      if (match) {
        const query = match[1].trim();
        this.actions.focusSearch(query);
        this.actions.showToast(`🔍 Searching: "${query}"`);
        matched = true;
      }
    }
    // ─── Free-form: "play something with/that/like" → AI search ───
    else if (/^(play something|find something|play tracks|find tracks|show me)/.test(t)) {
      if (this.actions.onAISearch) {
        this.actions.onAISearch(t);
        this.actions.showToast(`🤖 AI: "${t}"`);
        matched = true;
      }
    }

    if (matched) {
      this.setState({ flash: "success" });
      updateIndicator(transcript, "success");
    } else {
      this.setState({ flash: "error" });
      updateIndicator(transcript, "error");
      setTimeout(() => {
        this.actions.showToast(
          "Command not recognized. Try: 'next track', 'pause', 'loop 4 bars'"
        );
      }, 500);
    }

    setTimeout(() => {
      if (this.state.flash !== "none") {
        this.setState({ flash: "none" });
        updateIndicator(null, "none");
      }
    }, 1500);
  }

  destroy(): void {
    this.stop();
    removeIndicator();
  }
}
