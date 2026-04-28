export const computeGyroState = (beta, minTilt) => {
  if (!Number.isFinite(beta)) {
    return { angle: null, isReady: false, status: "unavailable" };
  }
  const angle = Math.round(Math.abs(beta));
  const isReady = angle >= minTilt;
  return { angle, isReady, status: isReady ? "upright" : "flat" };
};

export class Gyroscope {
  #opts;
  #angle = null;
  #isReady = false;
  #handler = null;

  constructor(opts) {
    this.#opts = opts;
  }

  get currentAngle() { return this.#angle; }
  get isReady() { return !this.#opts.enabled || this.#isReady; }

  async init(onChange) {
    if (!this.#opts.enabled || !window.DeviceOrientationEvent) return;

    const attach = () => {
      this.#handler = (event) => {
        const state = computeGyroState(event.beta, this.#opts.minTilt);
        this.#angle = state.angle;
        this.#isReady = state.isReady;
        onChange(state);
      };
      window.addEventListener("deviceorientation", this.#handler);
    };

    if (typeof DeviceOrientationEvent.requestPermission === "function") {
      try {
        const result = await DeviceOrientationEvent.requestPermission();
        if (result === "granted") attach();
      } catch {
        // 사용자 제스처 없이 호출된 경우 무시
      }
      return;
    }

    attach();
  }

  dispose() {
    if (this.#handler) {
      window.removeEventListener("deviceorientation", this.#handler);
      this.#handler = null;
    }
  }
}
