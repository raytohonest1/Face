import { DEFAULT_MIN_TILT } from "./constants.js";

const noop = () => {};

const parseGyro = (raw) => {
  if (!raw || raw === false) return { enabled: false, minTilt: DEFAULT_MIN_TILT };
  if (raw === true) return { enabled: true, minTilt: DEFAULT_MIN_TILT };
  return { enabled: raw.enabled !== false, minTilt: raw.minTilt ?? DEFAULT_MIN_TILT };
};

const parseLiveness = (raw) => {
  if (raw === undefined || raw === "random") return { enabled: true, sequence: null };
  if (!raw || raw === false) return { enabled: false, sequence: [] };
  if (Array.isArray(raw.challenges)) return { enabled: true, sequence: raw.challenges };
  if (raw.challenges === "random") return { enabled: true, sequence: null };
  return { enabled: true, sequence: null };
};

export const parseOptions = (raw) => {
  if (!raw.video) throw new Error("options.video is required");

  return {
    video: raw.video,
    wasmPath: raw.wasmPath ?? null,
    modelUrl: raw.modelUrl ?? null,
    gyroscope: parseGyro(raw.gyroscope),
    liveness: parseLiveness(raw.liveness),
    onCapture: raw.onCapture ?? noop,
    onGyroChange: raw.onGyroChange ?? noop,
    onLivenessChange: raw.onLivenessChange ?? noop,
    onError: raw.onError ?? noop,
  };
};
