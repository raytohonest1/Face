import { parseOptions } from "./options.js";
import { Camera } from "./camera.js";
import { Detector } from "./detector.js";
import { LivenessChecker } from "./liveness.js";
import { Gyroscope } from "./gyroscope.js";
import { captureFrame } from "./capture.js";
import { clamp } from "./utils.js";

const isValidPoint = (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y);

const getNormalizedBounds = (landmarks) => {
  const pts = landmarks.filter(isValidPoint);
  if (!pts.length) return null;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return {
    centerX: (Math.min(...xs) + Math.max(...xs)) / 2,
    centerY: (Math.min(...ys) + Math.max(...ys)) / 2,
    area: (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)),
  };
};

const assessQuality = (faces, primaryIndex, landmarks, yaw) => {
  if (!faces.length) return false;
  if (faces.length > 1) return false;
  if (primaryIndex < 0 || !landmarks) return false;
  const b = getNormalizedBounds(landmarks);
  if (!b) return false;
  if (b.area < 0.045 || b.area > 0.48) return false;
  if (b.centerX < 0.3 || b.centerX > 0.7 || b.centerY < 0.25 || b.centerY > 0.78) return false;
  if (Number.isFinite(yaw) && Math.abs(yaw) > 15) return false;
  return true;
};

const getBlendshapeScore = (blendshape, names) => {
  const cats = blendshape?.categories ?? [];
  for (const name of names) {
    const m = cats.find((c) => c.categoryName === name || c.displayName === name);
    if (Number.isFinite(m?.score)) return m.score;
  }
  return null;
};

const getLivenessSignals = (landmarks, yaw, blendshape) => {
  const leftBlink = getBlendshapeScore(blendshape, ["eyeBlinkLeft"]) ?? 0;
  const rightBlink = getBlendshapeScore(blendshape, ["eyeBlinkRight"]) ?? 0;
  const mouthOpen = getBlendshapeScore(blendshape, ["jawOpen", "mouthOpen"]) ?? 0;
  return {
    yaw: Number.isFinite(yaw) ? yaw : 0,
    blink: clamp(Math.min(leftBlink, rightBlink), 0, 1),
    mouthOpen: clamp(mouthOpen, 0, 1),
  };
};

export class FaceLiveness {
  #opts;
  #camera;
  #detector;
  #liveness;
  #gyroscope;
  #running = false;
  #frameId = 0;
  #lastVideoTime = -1;

  constructor(rawOptions) {
    this.#opts = parseOptions(rawOptions);
    this.#camera = new Camera(this.#opts.video);
    this.#detector = new Detector({
      wasmPath: this.#opts.wasmPath,
      modelUrl: this.#opts.modelUrl,
    });
    this.#liveness = new LivenessChecker(
      this.#opts.liveness,
      this.#opts.onLivenessChange,
    );
    this.#gyroscope = new Gyroscope(this.#opts.gyroscope);
  }

  async start() {
    try {
      await this.#camera.start();
      await this.#detector.load();
      await this.#gyroscope.init(this.#opts.onGyroChange);
      this.#liveness.start();
      this.#running = true;
      this.#loop();
    } catch (error) {
      this.#opts.onError(error);
    }
  }

  stop() {
    this.#running = false;
    cancelAnimationFrame(this.#frameId);
    this.#camera.stop();
    this.#detector.dispose();
    this.#gyroscope.dispose();
  }

  capture() {
    const image = captureFrame(this.#opts.video, this.#detector.lastLandmarks);
    this.#opts.onCapture({
      image,
      liveness: this.#liveness.phase,
      tilt: this.#gyroscope.currentAngle,
    });
  }

  #loop() {
    if (!this.#running) return;
    const now = performance.now();
    const video = this.#camera.video;

    if (video.currentTime !== this.#lastVideoTime) {
      const detection = this.#detector.detect(video, now);
      if (detection) {
        this.#lastVideoTime = video.currentTime;
        const { result, faces, yawMeasurements, primaryIndex } = detection;
        const landmarks = primaryIndex >= 0 ? faces[primaryIndex] : null;
        const yaw = primaryIndex >= 0 ? yawMeasurements[primaryIndex] : null;
        const faceOk = assessQuality(faces, primaryIndex, landmarks, yaw);
        const blendshape = primaryIndex >= 0 ? result.faceBlendshapes?.[primaryIndex] : null;
        const signals = landmarks ? getLivenessSignals(landmarks, yaw, blendshape) : null;
        if (signals) this.#liveness.update(signals, faceOk, now);
      }
    }

    this.#frameId = requestAnimationFrame(() => this.#loop());
  }
}
