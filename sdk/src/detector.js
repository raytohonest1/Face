import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { WASM_ROOT, MODEL_URL, DETECTION_INTERVAL_MS, RAD_TO_DEG } from "./constants.js";
import { clamp } from "./utils.js";

const isValidPoint = (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y);

const getAvg = (landmarks, indexes) => {
  const pts = indexes.map((i) => landmarks[i]).filter(isValidPoint);
  if (!pts.length) return null;
  return {
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
  };
};

const yawFromMatrix = (matrix) => {
  const data = matrix?.data ?? matrix;
  if (!data || data.length < 16) return null;
  const yaw = Math.atan2(data[2], data[10]) * RAD_TO_DEG;
  return Number.isFinite(yaw) ? clamp(yaw, -75, 75) : null;
};

const yawSignFromLandmarks = (landmarks) => {
  const le = getAvg(landmarks, [33, 133]);
  const re = getAvg(landmarks, [362, 263]);
  const nose = landmarks[1];
  const mouth = getAvg(landmarks, [13, 14, 61, 291]);
  if (!le || !re || !isValidPoint(nose)) return 0;
  const offset = (le.x + re.x) / 2 - (mouth ? nose.x * 0.72 + mouth.x * 0.28 : nose.x);
  if (Math.abs(offset) < 0.006) return 0;
  return offset > 0 ? 1 : -1;
};

const yawFromLandmarks = (landmarks) => {
  const le = getAvg(landmarks, [33, 133]);
  const re = getAvg(landmarks, [362, 263]);
  const nose = landmarks[1];
  const mouth = getAvg(landmarks, [13, 14, 61, 291]);
  if (!le || !re || !isValidPoint(nose)) return null;
  const eyeDist = Math.abs(le.x - re.x);
  if (eyeDist < 0.02) return null;
  const center = mouth ? nose.x * 0.72 + mouth.x * 0.28 : nose.x;
  const norm = clamp(((le.x + re.x) / 2 - center) / (eyeDist * 0.62), -1, 1);
  return clamp(Math.asin(norm) * RAD_TO_DEG, -60, 60);
};

export class Detector {
  #wasmPath;
  #modelUrl;
  #landmarker = null;
  #lastLandmarks = null;
  #lastDetectedAt = 0;

  constructor({ wasmPath, modelUrl } = {}) {
    this.#wasmPath = wasmPath ?? WASM_ROOT;
    this.#modelUrl = modelUrl ?? MODEL_URL;
  }

  get lastLandmarks() { return this.#lastLandmarks; }

  async load() {
    const vision = await FilesetResolver.forVisionTasks(this.#wasmPath);
    const make = (delegate) =>
      FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: this.#modelUrl, delegate },
        runningMode: "VIDEO",
        numFaces: 2,
        minFaceDetectionConfidence: 0.55,
        minFacePresenceConfidence: 0.55,
        minTrackingConfidence: 0.55,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
      });

    try {
      this.#landmarker = await make("GPU");
    } catch {
      this.#landmarker = await make("CPU");
    }
  }

  detect(video, now) {
    if (
      !this.#landmarker ||
      video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
      now - this.#lastDetectedAt < DETECTION_INTERVAL_MS
    ) return null;

    const result = this.#landmarker.detectForVideo(video, now);
    this.#lastDetectedAt = now;

    const faces = result.faceLandmarks ?? [];
    const yawMeasurements = faces.map((lm, i) => {
      const matrixYaw = yawFromMatrix(result.facialTransformationMatrixes?.[i]);
      if (Number.isFinite(matrixYaw)) {
        const sign = yawSignFromLandmarks(lm) || (-Math.sign(matrixYaw) || 0);
        return clamp(Math.abs(matrixYaw) * sign, -75, 75);
      }
      return yawFromLandmarks(lm);
    });

    const primaryIndex = faces.reduce((best, lm, i) => {
      const xs = lm.filter(isValidPoint).map((p) => p.x);
      const ys = lm.filter(isValidPoint).map((p) => p.y);
      const area = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
      return area > (best.area ?? 0) ? { i, area } : best;
    }, {}).i ?? -1;

    this.#lastLandmarks = primaryIndex >= 0 ? faces[primaryIndex] : null;

    return { result, faces, yawMeasurements, primaryIndex };
  }

  dispose() {
    this.#landmarker?.close?.();
    this.#landmarker = null;
  }
}
