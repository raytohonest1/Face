import {
  TURN_YAW_DEGREES, NEUTRAL_YAW_DEGREES,
  BLINK_CLOSED_SCORE, BLINK_OPEN_SCORE,
  MOUTH_OPEN_SCORE, MOUTH_CLOSED_SCORE,
  QUALITY_HOLD_MS, LIVENESS_STEP_TIMEOUT_MS,
  LIVENESS_SESSION_TIMEOUT_MS, FACE_LOST_FAIL_MS,
} from "./constants.js";
import { clamp, shuffle } from "./utils.js";

export const generateSequence = (sequence) => {
  if (!sequence) {
    const turn = Math.random() > 0.5 ? "turnLeft" : "turnRight";
    return shuffle([turn, "blink", "mouthOpen"]);
  }
  return sequence;
};

export const getActionMatched = (step, signals) => {
  if (step === "turnLeft") return signals.yaw <= -TURN_YAW_DEGREES;
  if (step === "turnRight") return signals.yaw >= TURN_YAW_DEGREES;
  if (step === "blink") return signals.blink >= BLINK_CLOSED_SCORE;
  if (step === "mouthOpen") return signals.mouthOpen >= MOUTH_OPEN_SCORE;
  return false;
};

export const getNeutralMatched = (step, signals) => {
  if (step === "turnLeft" || step === "turnRight") return Math.abs(signals.yaw) <= NEUTRAL_YAW_DEGREES;
  if (step === "blink") return signals.blink <= BLINK_OPEN_SCORE;
  if (step === "mouthOpen") return signals.mouthOpen <= MOUTH_CLOSED_SCORE;
  return false;
};

const HOLD_MS = { blink: 80, mouthOpen: 180, default: 160 };
const getHoldMs = (step) => HOLD_MS[step] ?? HOLD_MS.default;

const createState = () => ({
  phase: "idle",
  sequence: [],
  stepIndex: 0,
  stepPhase: "action",
  startedAt: 0,
  stepStartedAt: 0,
  holdStartedAt: 0,
  qualityStartedAt: 0,
  progress: 0,
  faceLostSince: 0,
});

export class LivenessChecker {
  #opts;
  #state = createState();
  #onChange;

  constructor(opts, onChange = () => {}) {
    this.#opts = opts;
    this.#onChange = onChange;
  }

  get phase() { return this.#state.phase; }
  get progress() { return this.#state.progress; }

  start(now = performance.now()) {
    if (!this.#opts.enabled) {
      this.#state = { ...createState(), phase: "passed" };
      this.#emit();
      return;
    }
    this.#state = {
      ...createState(),
      phase: "quality",
      sequence: generateSequence(this.#opts.sequence),
      startedAt: now,
    };
    this.#emit();
  }

  update(signals, faceOk, now = performance.now()) {
    if (!["quality", "challenge"].includes(this.#state.phase)) return;

    if (!faceOk) {
      if (this.#state.phase === "challenge") {
        if (!this.#state.faceLostSince) this.#state.faceLostSince = now;
        if (now - this.#state.faceLostSince >= FACE_LOST_FAIL_MS) {
          this.#fail("얼굴을 카메라 안에 유지해주세요.", now);
          return;
        }
      } else {
        this.#state.qualityStartedAt = 0;
        this.#state.progress = 0;
      }
      this.#emit();
      return;
    }

    this.#state.faceLostSince = 0;

    if (this.#state.phase === "quality") {
      this.#updateQuality(now);
    } else {
      this.#updateChallenge(signals, now);
    }
  }

  #updateQuality(now) {
    if (!this.#state.qualityStartedAt) this.#state.qualityStartedAt = now;
    this.#state.progress = clamp((now - this.#state.qualityStartedAt) / QUALITY_HOLD_MS, 0, 1);
    if (this.#state.progress >= 1) {
      this.#beginChallenge(now);
      return;
    }
    this.#emit();
  }

  #beginChallenge(now) {
    this.#state.phase = "challenge";
    this.#state.stepIndex = 0;
    this.#state.stepPhase = "action";
    this.#state.startedAt = now;
    this.#state.stepStartedAt = now;
    this.#state.holdStartedAt = 0;
    this.#emit();
  }

  #updateChallenge(signals, now) {
    const step = this.#state.sequence[this.#state.stepIndex];
    if (!step) { this.#pass(); return; }

    if (now - this.#state.startedAt > LIVENESS_SESSION_TIMEOUT_MS) {
      this.#fail("제한 시간이 초과되었습니다.", now);
      return;
    }
    if (now - this.#state.stepStartedAt > LIVENESS_STEP_TIMEOUT_MS) {
      this.#fail("현재 동작 시간이 초과되었습니다.", now);
      return;
    }

    const matched = this.#state.stepPhase === "action"
      ? getActionMatched(step, signals)
      : getNeutralMatched(step, signals);

    if (!matched) {
      this.#state.holdStartedAt = 0;
    } else {
      if (!this.#state.holdStartedAt) this.#state.holdStartedAt = now;
      const holdMs = this.#state.stepPhase === "action" ? getHoldMs(step) : 160;
      if (now - this.#state.holdStartedAt >= holdMs) {
        if (this.#state.stepPhase === "action") {
          this.#state.stepPhase = "neutral";
          this.#state.holdStartedAt = 0;
        } else {
          this.#advanceStep(now);
          return;
        }
      }
    }
    this.#emit();
  }

  #advanceStep(now) {
    this.#state.stepIndex += 1;
    if (this.#state.stepIndex >= this.#state.sequence.length) {
      this.#pass();
      return;
    }
    this.#state.stepPhase = "action";
    this.#state.stepStartedAt = now;
    this.#state.holdStartedAt = 0;
    this.#emit();
  }

  #pass() {
    this.#state.phase = "passed";
    this.#state.progress = 1;
    this.#emit();
  }

  #fail(reason, _now) {
    this.#state.phase = "failed";
    this.#emit(reason);
  }

  #emit(reason) {
    this.#onChange({
      phase: this.#state.phase,
      step: this.#state.sequence[this.#state.stepIndex] ?? null,
      stepPhase: this.#state.stepPhase,
      stepIndex: this.#state.stepIndex,
      totalSteps: this.#state.sequence.length,
      progress: this.#state.progress,
      reason: reason ?? null,
    });
  }
}
