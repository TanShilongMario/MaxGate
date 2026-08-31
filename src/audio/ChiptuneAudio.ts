import type { FrameSnapshot } from "../render/types";

const STEPS_PER_GATE = 8;
const MELODY = [0, 4, 7, 11, 7, 4, 9, 12] as const;

export function musicStepForApproach(approach: number): number {
  return Math.min(STEPS_PER_GATE - 1, Math.max(0, Math.floor(approach * STEPS_PER_GATE)));
}

export class ChiptuneAudio {
  private context: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private doorKey = "";
  private lastMusicStep = -1;
  private lastResolveGate = -1;
  private musicActive = false;

  activate(): void {
    try {
      if (!this.context) {
        this.context = new AudioContext({ latencyHint: "interactive" });
        this.musicGain = this.context.createGain();
        this.sfxGain = this.context.createGain();
        this.musicGain.gain.value = 0.0001;
        this.sfxGain.gain.value = 0.18;
        this.musicGain.connect(this.context.destination);
        this.sfxGain.connect(this.context.destination);
      }
      if (this.context.state === "suspended") void this.context.resume();
    } catch {
      // Audio is an enhancement; unsupported or blocked contexts must not stop play.
    }
  }

  beginRun(): void {
    this.activate();
    this.doorKey = "";
    this.lastMusicStep = -1;
    this.lastResolveGate = -1;
  }

  sync(snapshot: FrameSnapshot): void {
    const context = this.context;
    if (!context || !this.musicGain || !this.sfxGain) return;

    const playing = snapshot.phase === "playing" || snapshot.phase === "resolving";
    this.setMusicActive(playing);
    if (!playing || snapshot.phase === "paused" || !snapshot.door) return;

    const activeGateIndex = snapshot.hud.gateIndex - (snapshot.resolve ? 1 : 0);
    const key = `${activeGateIndex}|${snapshot.door.labels.join("|")}`;
    if (key !== this.doorKey) {
      this.doorKey = key;
      this.lastMusicStep = -1;
    }

    if (snapshot.phase === "playing" && snapshot.door.approach > 0) {
      const step = musicStepForApproach(snapshot.door.approach);
      if (step !== this.lastMusicStep) {
        this.lastMusicStep = step;
        this.playMusicStep(
          step,
          activeGateIndex,
          snapshot.hud.difficulty,
          snapshot.door.windowMs / 1000 / STEPS_PER_GATE,
        );
      }
    }

    if (snapshot.resolve && snapshot.hud.gateIndex !== this.lastResolveGate) {
      this.lastResolveGate = snapshot.hud.gateIndex;
      if (snapshot.resolve.lifeAwarded) this.playLifeAward();
      else if (snapshot.resolve.correct) this.playSuccess();
      else this.playFailure();
    }
  }

  private setMusicActive(active: boolean): void {
    if (!this.context || !this.musicGain || active === this.musicActive) return;
    this.musicActive = active;
    const now = this.context.currentTime;
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setTargetAtTime(active ? 0.14 : 0.0001, now, active ? 0.025 : 0.045);
  }

  private playMusicStep(
    step: number,
    gateIndex: number,
    difficulty: FrameSnapshot["hud"]["difficulty"],
    beatSeconds: number,
  ): void {
    if (!this.context || !this.musicGain) return;
    const root = difficulty === "cozy" ? 220 : difficulty === "rush" ? 261.63 : 233.08;
    const phraseOffset = (gateIndex % 4) * 2;
    const frequency = root * 2 ** ((MELODY[step]! + phraseOffset) / 12);
    const now = this.context.currentTime;
    const noteLength = Math.min(0.12, Math.max(0.055, beatSeconds * 0.28));
    this.tone(frequency, noteLength, "square", 0.42, now, this.musicGain);
    if (step % 2 === 0) {
      this.tone(root / 2, Math.min(0.16, beatSeconds * 0.4), "triangle", 0.34, now, this.musicGain);
    }
  }

  private playSuccess(): void {
    if (!this.context || !this.sfxGain) return;
    const now = this.context.currentTime;
    [659.25, 783.99, 987.77].forEach((frequency, index) => {
      this.tone(frequency, 0.105, "square", 0.5, now + index * 0.055, this.sfxGain!);
    });
  }

  private playFailure(): void {
    if (!this.context || !this.sfxGain) return;
    const now = this.context.currentTime;
    this.tone(220, 0.17, "sawtooth", 0.5, now, this.sfxGain);
    this.tone(146.83, 0.22, "square", 0.46, now + 0.08, this.sfxGain);
  }

  private playLifeAward(): void {
    if (!this.context || !this.sfxGain) return;
    const now = this.context.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
      this.tone(frequency, 0.13, "square", 0.48, now + index * 0.06, this.sfxGain!);
    });
  }

  private tone(
    frequency: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    when: number,
    output: AudioNode,
  ): void {
    if (!this.context) return;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, when);
    envelope.gain.setValueAtTime(0.0001, when);
    envelope.gain.exponentialRampToValueAtTime(volume, when + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    oscillator.connect(envelope);
    envelope.connect(output);
    oscillator.start(when);
    oscillator.stop(when + duration + 0.02);
  }
}
