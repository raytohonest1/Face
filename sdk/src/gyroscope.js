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
        if (result === "granted") {
          attach();
        } else {
          onChange({ angle: null, isReady: false, status: "denied" });
        }
      } catch {
        onChange({ angle: null, isReady: false, status: "denied" });
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
