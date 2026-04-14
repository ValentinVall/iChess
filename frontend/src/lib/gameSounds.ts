import { Chess } from "chess.js";

import type { ActiveGameState } from "./api";

type MoveSoundKind = "move" | "capture";
type SoundCueKind = MoveSoundKind | "check" | "checkmate";

const SOUND_PATHS: Record<MoveSoundKind, string> = {
  move: "/sounds/Move.mp3",
  capture: "/sounds/Capture.mp3",
};

let sharedAudioContext: AudioContext | null = null;

function isSoundEnabled() {
  const rawValue = localStorage.getItem("soundEnabled");
  return rawValue === null ? true : rawValue === "true";
}

function getAudioContext() {
  if (typeof window === "undefined") {
    return null;
  }

  const AudioContextConstructor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) {
    return null;
  }

  if (!sharedAudioContext) {
    sharedAudioContext = new AudioContextConstructor();
  }

  if (sharedAudioContext.state === "suspended") {
    void sharedAudioContext.resume().catch(() => {
      // Ignore resume failures caused by browser autoplay policy.
    });
  }

  return sharedAudioContext;
}

function scheduleTone(
  audioContext: AudioContext,
  frequency: number,
  startAt: number,
  duration: number,
  volume: number,
  type: OscillatorType,
) {
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startAt);

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.02);
}

function playSynthCue(kind: Extract<SoundCueKind, "check" | "checkmate">) {
  const audioContext = getAudioContext();
  if (!audioContext) {
    return;
  }

  const now = audioContext.currentTime + 0.01;

  if (kind === "check") {
    scheduleTone(audioContext, 880, now, 0.09, 0.05, "triangle");
    scheduleTone(audioContext, 1174.66, now + 0.08, 0.12, 0.04, "sine");
    return;
  }

  scheduleTone(audioContext, 784, now, 0.08, 0.05, "triangle");
  scheduleTone(audioContext, 1046.5, now + 0.07, 0.08, 0.05, "triangle");
  scheduleTone(audioContext, 1318.5, now + 0.14, 0.12, 0.055, "sawtooth");
  scheduleTone(audioContext, 1567.98, now + 0.25, 0.24, 0.06, "sawtooth");
}

export function getMoveSoundKindFromPgn(pgn: string): MoveSoundKind | null {
  if (!pgn.trim()) {
    return null;
  }

  try {
    const replayGame = new Chess();
    replayGame.loadPgn(pgn);
    const history = replayGame.history({ verbose: true });
    const latestMove = history[history.length - 1];

    if (!latestMove) {
      return null;
    }

    return latestMove.captured ? "capture" : "move";
  } catch {
    return null;
  }
}

export function getSoundCueFromState(state: ActiveGameState): SoundCueKind | null {
  if (state.isCheckmate) {
    return "checkmate";
  }

  if (state.isCheck) {
    return "check";
  }

  return getMoveSoundKindFromPgn(state.pgn);
}

export function playSoundCue(kind: SoundCueKind) {
  if (!isSoundEnabled()) {
    return;
  }

  if (kind === "check" || kind === "checkmate") {
    playSynthCue(kind);
    return;
  }

  const audio = new Audio(SOUND_PATHS[kind]);
  audio.preload = "auto";
  void audio.play().catch(() => {
    // Ignore autoplay and transient playback failures.
  });
}