import { FaceLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/vision_bundle.mjs";

const WASM_ROOT = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const DETECTION_INTERVAL_MS = 90;
const RAD_TO_DEG = 180 / Math.PI;

const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378,
  400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21,
  54, 103, 67, 109, 10,
];
const LEFT_EYE = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246, 33];
const RIGHT_EYE = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466, 263];
const LEFT_BROW = [70, 63, 105, 66, 107, 55, 65, 52, 53, 46];
const RIGHT_BROW = [336, 296, 334, 293, 300, 276, 283, 282, 295, 285];
const NOSE = [168, 6, 197, 195, 5, 4, 1, 19, 94, 2];
const MOUTH_OUTER = [
  61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84,
  181, 91, 146, 61,
];
const MOUTH_INNER = [
  78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14,
  87, 178, 88, 95, 78,
];
const MESH_LINES = [
  FACE_OVAL,
  LEFT_EYE,
  RIGHT_EYE,
  LEFT_BROW,
  RIGHT_BROW,
  NOSE,
  MOUTH_OUTER,
  MOUTH_INNER,
];
const STABLE_POINTS = [1, 4, 33, 133, 152, 263, 362];

const video = document.querySelector("#camera");
const canvas = document.querySelector("#overlay");
const ctx = canvas.getContext("2d");
const toggleButton = document.querySelector("#toggleButton");
const toggleLabel = document.querySelector("#toggleLabel");
const statusBadge = document.querySelector("#statusBadge");
const message = document.querySelector("#message");
const emptyState = document.querySelector("#emptyState");
const faceCount = document.querySelector("#faceCount");
const yawAngle = document.querySelector("#yawAngle");
const yawDirection = document.querySelector("#yawDirection");
const fps = document.querySelector("#fps");

let landmarker = null;
let stream = null;
let animationFrameId = 0;
let lastDetectionAt = 0;
let lastVideoTime = -1;
let frameCounter = 0;
let fpsStartedAt = performance.now();
let isRunning = false;
let smoothedYawDegrees = null;

const setStatus = (text, state = "idle") => {
  statusBadge.textContent = text;
  statusBadge.dataset.state = state;
};

const setBusy = (busy) => {
  toggleButton.disabled = busy;
};

const setMessage = (text, visible = true) => {
  message.textContent = text;
  emptyState.hidden = !visible;
};

const updateToggle = () => {
  toggleButton.dataset.mode = isRunning ? "stop" : "start";
  toggleLabel.textContent = isRunning ? "카메라 중지" : "카메라 시작";
};

const resetMetrics = () => {
  faceCount.textContent = "0";
  yawAngle.textContent = "--";
  yawDirection.textContent = "측정 대기";
  smoothedYawDegrees = null;
  fps.textContent = "0";
  frameCounter = 0;
  fpsStartedAt = performance.now();
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const ensureSecureContext = () => {
  if (!window.isSecureContext) {
    throw new Error("카메라는 HTTPS 또는 localhost에서만 사용할 수 있습니다.");
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("이 브라우저는 카메라 접근을 지원하지 않습니다.");
  }
};

const loadLandmarker = async () => {
  if (landmarker) {
    return landmarker;
  }

  setStatus("모델", "warn");
  setMessage("Face Landmarker 모델을 불러오는 중입니다.");

  const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);

  const createLandmarker = (delegate) =>
    FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate,
      },
      runningMode: "VIDEO",
      numFaces: 1,
      minFaceDetectionConfidence: 0.55,
      minFacePresenceConfidence: 0.55,
      minTrackingConfidence: 0.55,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: true,
    });

  try {
    landmarker = await createLandmarker("GPU");
  } catch (error) {
    console.warn("GPU delegate failed. Falling back to CPU.", error);
    landmarker = await createLandmarker("CPU");
  }

  return landmarker;
};

const requestFrontCamera = async () => {
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: { ideal: "user" },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  });
};

const waitForVideo = async () => {
  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
    return;
  }

  await new Promise((resolve) => {
    video.addEventListener("loadedmetadata", resolve, { once: true });
  });
};

const resizeCanvas = () => {
  const { width, height } = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const nextWidth = Math.max(1, Math.round(width * dpr));
  const nextHeight = Math.max(1, Math.round(height * dpr));

  if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
    canvas.width = nextWidth;
    canvas.height = nextHeight;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
};

const getCoverMapper = () => {
  const bounds = canvas.getBoundingClientRect();
  const videoWidth = video.videoWidth || 1;
  const videoHeight = video.videoHeight || 1;
  const scale = Math.max(bounds.width / videoWidth, bounds.height / videoHeight);
  const renderedWidth = videoWidth * scale;
  const renderedHeight = videoHeight * scale;
  const offsetX = (bounds.width - renderedWidth) / 2;
  const offsetY = (bounds.height - renderedHeight) / 2;

  return {
    bounds,
    point(point) {
      return {
        x: (1 - point.x) * videoWidth * scale + offsetX,
        y: point.y * videoHeight * scale + offsetY,
      };
    },
  };
};

const clearOverlay = () => {
  resizeCanvas();
  const { width, height } = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, width, height);
};

const isValidPoint = (point) => Number.isFinite(point?.x) && Number.isFinite(point?.y);

const getPointAverage = (landmarks, indexes) => {
  const points = indexes.map((index) => landmarks[index]).filter(isValidPoint);

  if (!points.length) {
    return null;
  }

  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
    z: points.reduce((sum, point) => sum + (point.z || 0), 0) / points.length,
  };
};

const getYawSignFromLandmarks = (landmarks) => {
  const leftEye = getPointAverage(landmarks, [33, 133]);
  const rightEye = getPointAverage(landmarks, [362, 263]);
  const nose = landmarks[1];
  const mouth = getPointAverage(landmarks, [13, 14, 61, 291]);

  if (!leftEye || !rightEye || !isValidPoint(nose)) {
    return 0;
  }

  const eyeCenterX = (leftEye.x + rightEye.x) / 2;
  const faceCenterX = mouth ? nose.x * 0.72 + mouth.x * 0.28 : nose.x;
  const displayOffset = eyeCenterX - faceCenterX;

  if (Math.abs(displayOffset) < 0.006) {
    return 0;
  }

  return displayOffset > 0 ? 1 : -1;
};

const estimateYawFromLandmarks = (landmarks) => {
  const leftEye = getPointAverage(landmarks, [33, 133]);
  const rightEye = getPointAverage(landmarks, [362, 263]);
  const nose = landmarks[1];
  const mouth = getPointAverage(landmarks, [13, 14, 61, 291]);

  if (!leftEye || !rightEye || !isValidPoint(nose)) {
    return null;
  }

  const eyeDistance = Math.abs(leftEye.x - rightEye.x);

  if (eyeDistance < 0.02) {
    return null;
  }

  const eyeCenterX = (leftEye.x + rightEye.x) / 2;
  const faceCenterX = mouth ? nose.x * 0.72 + mouth.x * 0.28 : nose.x;
  const normalizedOffset = clamp((eyeCenterX - faceCenterX) / (eyeDistance * 0.62), -1, 1);

  return clamp(Math.asin(normalizedOffset) * RAD_TO_DEG, -60, 60);
};

const getMatrixData = (matrix) => {
  const data = matrix?.data ?? matrix;

  if (!data || data.length < 16) {
    return null;
  }

  return data;
};

const getYawFromTransformMatrix = (matrix) => {
  const data = getMatrixData(matrix);

  if (!data) {
    return null;
  }

  const yaw = Math.atan2(data[2], data[10]) * RAD_TO_DEG;
  return Number.isFinite(yaw) ? clamp(yaw, -75, 75) : null;
};

const getYawDegrees = (result, faceIndex, landmarks) => {
  const matrixYaw = getYawFromTransformMatrix(result.facialTransformationMatrixes?.[faceIndex]);

  if (Number.isFinite(matrixYaw)) {
    const landmarkSign = getYawSignFromLandmarks(landmarks);
    const fallbackSign = -Math.sign(matrixYaw) || 0;
    const displaySign = landmarkSign || fallbackSign;

    return clamp(Math.abs(matrixYaw) * displaySign, -75, 75);
  }

  return estimateYawFromLandmarks(landmarks);
};

const getFaceBounds = (landmarks, mapper) => {
  const points = landmarks.filter(isValidPoint).map((point) => mapper.point(point));

  if (!points.length) {
    return null;
  }

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const padding = Math.max(10, Math.min(maxX - minX, maxY - minY) * 0.08);

  return {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  };
};

const getFaceArea = (landmarks) => {
  const validPoints = landmarks.filter(isValidPoint);

  if (!validPoints.length) {
    return 0;
  }

  const xs = validPoints.map((point) => point.x);
  const ys = validPoints.map((point) => point.y);
  return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
};

const getPrimaryFaceIndex = (faces) => {
  let primaryIndex = -1;
  let primaryArea = 0;

  faces.forEach((landmarks, index) => {
    const area = getFaceArea(landmarks);

    if (area > primaryArea) {
      primaryArea = area;
      primaryIndex = index;
    }
  });

  return primaryIndex;
};

const getYawDirection = (degrees) => {
  if (!Number.isFinite(degrees)) {
    return "측정 불가";
  }

  if (Math.abs(degrees) < 6) {
    return "정면";
  }

  return degrees > 0 ? "오른쪽" : "왼쪽";
};

const formatYawValue = (degrees) => `${Math.abs(Math.round(degrees))}°`;

const formatYawLabel = (degrees) => {
  if (!Number.isFinite(degrees)) {
    return null;
  }

  return `${getYawDirection(degrees)} ${formatYawValue(degrees)}`;
};

const updateYawDisplay = (faces, yawMeasurements) => {
  const primaryIndex = getPrimaryFaceIndex(faces);
  const nextYaw = primaryIndex >= 0 ? yawMeasurements[primaryIndex] : null;

  if (!Number.isFinite(nextYaw)) {
    yawAngle.textContent = "--";
    yawDirection.textContent = faces.length ? "측정 불가" : "얼굴 없음";
    smoothedYawDegrees = null;
    return;
  }

  smoothedYawDegrees =
    smoothedYawDegrees === null ? nextYaw : smoothedYawDegrees * 0.72 + nextYaw * 0.28;
  yawAngle.textContent = formatYawValue(smoothedYawDegrees);
  yawDirection.textContent = getYawDirection(smoothedYawDegrees);
};

const drawRoundedRect = (x, y, width, height, radius) => {
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    return;
  }

  const nextRadius = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + nextRadius, y);
  ctx.lineTo(x + width - nextRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + nextRadius);
  ctx.lineTo(x + width, y + height - nextRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - nextRadius, y + height);
  ctx.lineTo(x + nextRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - nextRadius);
  ctx.lineTo(x, y + nextRadius);
  ctx.quadraticCurveTo(x, y, x + nextRadius, y);
  ctx.closePath();
};

const drawCornerBox = ({ x, y, width, height }, yawDegrees) => {
  const corner = Math.max(18, Math.min(width, height) * 0.18);

  ctx.lineWidth = 3;
  ctx.strokeStyle = "#36d399";
  ctx.shadowColor = "rgba(54, 211, 153, 0.42)";
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(x, y + corner);
  ctx.lineTo(x, y);
  ctx.lineTo(x + corner, y);
  ctx.moveTo(x + width - corner, y);
  ctx.lineTo(x + width, y);
  ctx.lineTo(x + width, y + corner);
  ctx.moveTo(x + width, y + height - corner);
  ctx.lineTo(x + width, y + height);
  ctx.lineTo(x + width - corner, y + height);
  ctx.moveTo(x + corner, y + height);
  ctx.lineTo(x, y + height);
  ctx.lineTo(x, y + height - corner);
  ctx.stroke();
  ctx.shadowBlur = 0;

  const label = formatYawLabel(yawDegrees) ?? "Face";
  ctx.font = "800 13px Inter, system-ui, sans-serif";
  const labelWidth = ctx.measureText(label).width + 18;
  const labelHeight = 26;
  const { width: stageWidth } = canvas.getBoundingClientRect();
  const labelX = Math.max(8, Math.min(x, stageWidth - labelWidth - 8));
  const labelY = Math.max(8, y - labelHeight - 8);

  ctx.fillStyle = "rgba(5, 8, 13, 0.78)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
  ctx.lineWidth = 1;
  drawRoundedRect(labelX, labelY, labelWidth, labelHeight, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#f5f7fb";
  ctx.fillText(label, labelX + 9, labelY + 17);
};

const drawPolyline = (landmarks, indexes, mapper) => {
  let hasStarted = false;

  ctx.beginPath();

  for (const index of indexes) {
    const landmark = landmarks[index];

    if (!isValidPoint(landmark)) {
      continue;
    }

    const point = mapper.point(landmark);

    if (!hasStarted) {
      ctx.moveTo(point.x, point.y);
      hasStarted = true;
    } else {
      ctx.lineTo(point.x, point.y);
    }
  }

  if (hasStarted) {
    ctx.stroke();
  }
};

const drawFaceMesh = (landmarks, mapper) => {
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(54, 211, 153, 0.92)";
  ctx.shadowColor = "rgba(54, 211, 153, 0.24)";
  ctx.shadowBlur = 6;

  for (const line of MESH_LINES) {
    drawPolyline(landmarks, line, mapper);
  }

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#f5f7fb";
  ctx.strokeStyle = "rgba(5, 8, 13, 0.7)";
  ctx.lineWidth = 2;

  for (const index of STABLE_POINTS) {
    const landmark = landmarks[index];

    if (!isValidPoint(landmark)) {
      continue;
    }

    const point = mapper.point(landmark);
    ctx.beginPath();
    ctx.arc(point.x, point.y, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
};

const drawFaces = (faces = [], yawMeasurements = []) => {
  clearOverlay();
  const mapper = getCoverMapper();

  faces.forEach((landmarks, index) => {
    const bounds = getFaceBounds(landmarks, mapper);

    if (!bounds) {
      return;
    }

    drawCornerBox(bounds, yawMeasurements[index]);
    drawFaceMesh(landmarks, mapper);
  });
};

const updateFps = () => {
  frameCounter += 1;
  const now = performance.now();
  const elapsed = now - fpsStartedAt;

  if (elapsed >= 1000) {
    fps.textContent = String(Math.round((frameCounter * 1000) / elapsed));
    frameCounter = 0;
    fpsStartedAt = now;
  }
};

const detectLoop = () => {
  if (!isRunning || !landmarker || video.paused || video.ended) {
    return;
  }

  const now = performance.now();

  if (
    video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
    video.currentTime !== lastVideoTime &&
    now - lastDetectionAt >= DETECTION_INTERVAL_MS
  ) {
    try {
      const result = landmarker.detectForVideo(video, now);
      const faces = result.faceLandmarks ?? [];
      const yawMeasurements = faces.map((landmarks, index) => getYawDegrees(result, index, landmarks));
      lastVideoTime = video.currentTime;
      lastDetectionAt = now;

      faceCount.textContent = String(faces.length);
      updateYawDisplay(faces, yawMeasurements);
      drawFaces(faces, yawMeasurements);
      updateFps();
    } catch (error) {
      console.error("Face landmark detection failed.", error);
      stop();
      setStatus("오류", "error");
      setMessage(error.message || "얼굴 랜드마크 검출 중 오류가 발생했습니다.");
      return;
    }
  }

  animationFrameId = requestAnimationFrame(detectLoop);
};

const start = async () => {
  try {
    setBusy(true);
    ensureSecureContext();
    await loadLandmarker();

    setStatus("권한", "warn");
    setMessage("카메라 권한을 기다리는 중입니다.");

    stream = await requestFrontCamera();
    video.srcObject = stream;
    await waitForVideo();
    await video.play();

    isRunning = true;
    lastDetectionAt = 0;
    lastVideoTime = -1;
    resetMetrics();
    clearOverlay();
    video.dataset.ready = "true";
    setStatus("추적", "active");
    setMessage("", false);
    updateToggle();
    detectLoop();
  } catch (error) {
    stop();
    setStatus("오류", "error");
    setMessage(error.message || "카메라를 시작하지 못했습니다.");
  } finally {
    setBusy(false);
  }
};

const stop = () => {
  isRunning = false;
  cancelAnimationFrame(animationFrameId);
  animationFrameId = 0;

  if (stream) {
    for (const track of stream.getTracks()) {
      track.stop();
    }
  }

  stream = null;
  video.pause();
  video.removeAttribute("srcObject");
  video.srcObject = null;
  video.dataset.ready = "false";
  clearOverlay();
  resetMetrics();
  setStatus("대기", "idle");
  setMessage("전면 카메라를 준비합니다.");
  updateToggle();
};

toggleButton.addEventListener("click", () => {
  if (isRunning) {
    stop();
    return;
  }

  start();
});

window.addEventListener("resize", () => {
  if (!isRunning) {
    clearOverlay();
  }
});

window.addEventListener("pagehide", stop);

setStatus("대기", "idle");
updateToggle();
clearOverlay();
