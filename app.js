import { FaceLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/vision_bundle.mjs";

const WASM_ROOT = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const DETECTION_INTERVAL_MS = 90;
const RAD_TO_DEG = 180 / Math.PI;
const QUALITY_HOLD_MS = 900;
const LIVENESS_STEP_TIMEOUT_MS = 5500;
const LIVENESS_SESSION_TIMEOUT_MS = 18000;
const FACE_LOST_FAIL_MS = 800;
const TURN_YAW_DEGREES = 18;
const NEUTRAL_YAW_DEGREES = 8;
const BLINK_CLOSED_SCORE = 0.48;
const BLINK_OPEN_SCORE = 0.26;
const MOUTH_OPEN_SCORE = 0.45;
const MOUTH_CLOSED_SCORE = 0.24;

const CHALLENGE_LIBRARY = {
  turnLeft: {
    shortLabel: "왼쪽",
    title: "고개 왼쪽",
    actionText: "고개를 왼쪽으로 돌리세요.",
    neutralText: "정면으로 돌아오세요.",
  },
  turnRight: {
    shortLabel: "오른쪽",
    title: "고개 오른쪽",
    actionText: "고개를 오른쪽으로 돌리세요.",
    neutralText: "정면으로 돌아오세요.",
  },
  blink: {
    shortLabel: "깜빡임",
    title: "눈 깜빡임",
    actionText: "양쪽 눈을 한 번 깜빡이세요.",
    neutralText: "눈을 다시 떠주세요.",
  },
  mouthOpen: {
    shortLabel: "입벌림",
    title: "입 벌림",
    actionText: "입을 크게 벌리세요.",
    neutralText: "입을 다시 닫아주세요.",
  },
};

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
const livenessPanel = document.querySelector("#livenessPanel");
const livenessLabel = document.querySelector("#livenessLabel");
const livenessTimer = document.querySelector("#livenessTimer");
const livenessTitle = document.querySelector("#livenessTitle");
const livenessInstruction = document.querySelector("#livenessInstruction");
const livenessProgress = document.querySelector("#livenessProgress");
const livenessSteps = document.querySelector("#livenessSteps");
const retryLivenessButton = document.querySelector("#retryLivenessButton");
const gyroTilt = document.querySelector("#gyroTilt");
const gyroStatus = document.querySelector("#gyroStatus");

const createLivenessState = () => ({
  state: "idle",
  sequence: [],
  stepIndex: 0,
  stepPhase: "action",
  startedAt: 0,
  stepStartedAt: 0,
  holdStartedAt: 0,
  qualityStartedAt: 0,
  faceLostSince: 0,
  progress: 0,
  message: "카메라를 시작하세요.",
  lastSignals: null,
});

let gyroListenerAttached = false;

let landmarker = null;
let stream = null;
let animationFrameId = 0;
let lastDetectionAt = 0;
let lastVideoTime = -1;
let frameCounter = 0;
let fpsStartedAt = performance.now();
let isRunning = false;
let smoothedYawDegrees = null;
let livenessState = createLivenessState();

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

const setLivenessMessage = (text) => {
  livenessState.message = text;
};

const shuffle = (items) => {
  const nextItems = [...items];

  for (let index = nextItems.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [nextItems[index], nextItems[swapIndex]] = [nextItems[swapIndex], nextItems[index]];
  }

  return nextItems;
};

const createChallengeSequence = () => {
  const turn = Math.random() > 0.5 ? "turnLeft" : "turnRight";
  return shuffle([turn, "blink", "mouthOpen"]);
};

const getCurrentChallenge = () => livenessState.sequence[livenessState.stepIndex] ?? null;

const getLivenessProgress = () => {
  if (livenessState.state === "quality") {
    return livenessState.progress;
  }

  if (livenessState.state === "passed") {
    return 1;
  }

  if (livenessState.state === "failed") {
    return livenessState.progress;
  }

  if (livenessState.state !== "challenge" || !livenessState.sequence.length) {
    return 0;
  }

  const phaseOffset = livenessState.stepPhase === "neutral" ? 0.65 : 0.25;
  return clamp((livenessState.stepIndex + phaseOffset) / livenessState.sequence.length, 0, 1);
};

const renderLiveness = () => {
  if (!livenessPanel) {
    return;
  }

  const currentChallenge = getCurrentChallenge();
  livenessPanel.hidden = livenessState.state === "idle";
  livenessPanel.dataset.state = livenessState.state;
  livenessProgress.style.width = `${Math.round(getLivenessProgress() * 100)}%`;
  retryLivenessButton.hidden = !["failed", "passed"].includes(livenessState.state);

  if (livenessState.state === "quality") {
    livenessLabel.textContent = "Ready";
    livenessTimer.textContent = "준비";
    livenessTitle.textContent = "얼굴 확인 중";
  } else if (livenessState.state === "challenge") {
    const elapsed = performance.now() - livenessState.stepStartedAt;
    const remainingSeconds = Math.max(0, Math.ceil((LIVENESS_STEP_TIMEOUT_MS - elapsed) / 1000));
    livenessLabel.textContent = `Step ${livenessState.stepIndex + 1}/${livenessState.sequence.length}`;
    livenessTimer.textContent = `${remainingSeconds}s`;
    livenessTitle.textContent = currentChallenge ? CHALLENGE_LIBRARY[currentChallenge].title : "동작 확인";
  } else if (livenessState.state === "passed") {
    livenessLabel.textContent = "Passed";
    livenessTimer.textContent = "완료";
    livenessTitle.textContent = "라이브니스 통과";
  } else if (livenessState.state === "failed") {
    livenessLabel.textContent = "Failed";
    livenessTimer.textContent = "실패";
    livenessTitle.textContent = "라이브니스 실패";
  } else {
    livenessLabel.textContent = "Live Check";
    livenessTimer.textContent = "--";
    livenessTitle.textContent = "라이브니스 체크";
  }

  livenessInstruction.textContent = livenessState.message;
  livenessSteps.innerHTML = livenessState.sequence
    .map((step, index) => {
      const state =
        index < livenessState.stepIndex
          ? "done"
          : index === livenessState.stepIndex && livenessState.state === "challenge"
            ? "active"
            : "pending";

      return `<span class="liveness-step" data-state="${state}">${CHALLENGE_LIBRARY[step].shortLabel}</span>`;
    })
    .join("");
};

const resetLiveness = () => {
  livenessState = createLivenessState();
  renderLiveness();
};

const startLivenessCheck = () => {
  livenessState = {
    ...createLivenessState(),
    state: "quality",
    sequence: createChallengeSequence(),
    startedAt: performance.now(),
    message: "얼굴을 중앙에 맞추고 정면을 봐주세요.",
  };
  setStatus("체크", "warn");
  renderLiveness();
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

const updateGyroDisplay = (beta) => {
  if (!Number.isFinite(beta)) {
    gyroTilt.textContent = "--";
    gyroStatus.textContent = "미지원";
    return;
  }

  // beta: 0° = 평평(눕혀짐), 90° = 세워짐
  const tilt = Math.round(Math.abs(beta));
  gyroTilt.textContent = `${tilt}°`;
  gyroStatus.textContent = tilt >= 45 ? "세워짐" : "눕혀짐";
};

const attachGyroListener = () => {
  if (gyroListenerAttached) {
    return;
  }

  window.addEventListener("deviceorientation", (event) => {
    updateGyroDisplay(event.beta);
  });

  gyroListenerAttached = true;
};

const initGyroscope = async () => {
  if (!window.DeviceOrientationEvent) {
    return;
  }

  // iOS 13+: 권한 요청 필요
  if (typeof DeviceOrientationEvent.requestPermission === "function") {
    try {
      const result = await DeviceOrientationEvent.requestPermission();

      if (result === "granted") {
        attachGyroListener();
      } else {
        gyroTilt.textContent = "--";
        gyroStatus.textContent = "권한거부";
      }
    } catch {
      // 사용자 제스처 없이 호출된 경우 무시
    }

    return;
  }

  attachGyroListener();
};

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
      numFaces: 2,
      minFaceDetectionConfidence: 0.55,
      minFacePresenceConfidence: 0.55,
      minTrackingConfidence: 0.55,
      outputFaceBlendshapes: true,
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

const getNormalizedBounds = (landmarks) => {
  const validPoints = landmarks.filter(isValidPoint);

  if (!validPoints.length) {
    return null;
  }

  const xs = validPoints.map((point) => point.x);
  const ys = validPoints.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    area: (maxX - minX) * (maxY - minY),
  };
};

const getDistance = (pointA, pointB) => {
  if (!isValidPoint(pointA) || !isValidPoint(pointB)) {
    return 0;
  }

  return Math.hypot(pointA.x - pointB.x, pointA.y - pointB.y);
};

const getEyeAspectRatio = (landmarks, side) => {
  const indexes =
    side === "left"
      ? { outer: 33, inner: 133, upperA: 159, upperB: 158, lowerA: 145, lowerB: 153 }
      : { outer: 263, inner: 362, upperA: 386, upperB: 385, lowerA: 374, lowerB: 380 };

  const width = getDistance(landmarks[indexes.outer], landmarks[indexes.inner]);

  if (!width) {
    return null;
  }

  const openA = getDistance(landmarks[indexes.upperA], landmarks[indexes.lowerA]);
  const openB = getDistance(landmarks[indexes.upperB], landmarks[indexes.lowerB]);
  return ((openA + openB) / 2) / width;
};

const getFallbackBlinkScore = (landmarks, side) => {
  const ratio = getEyeAspectRatio(landmarks, side);

  if (!Number.isFinite(ratio)) {
    return null;
  }

  return clamp(1 - (ratio - 0.12) / 0.11, 0, 1);
};

const getFallbackMouthOpenScore = (landmarks) => {
  const mouthWidth = getDistance(landmarks[61], landmarks[291]);
  const mouthOpen = getDistance(landmarks[13], landmarks[14]);

  if (!mouthWidth) {
    return null;
  }

  return clamp((mouthOpen / mouthWidth - 0.06) / 0.34, 0, 1);
};

const getBlendshapeScore = (blendshape, names) => {
  const categories = blendshape?.categories ?? [];

  for (const name of names) {
    const match = categories.find(
      (category) => category.categoryName === name || category.displayName === name,
    );

    if (Number.isFinite(match?.score)) {
      return match.score;
    }
  }

  return null;
};

const getLivenessSignals = (landmarks, yawDegrees, blendshape) => {
  const leftBlink =
    getBlendshapeScore(blendshape, ["eyeBlinkLeft"]) ?? getFallbackBlinkScore(landmarks, "left") ?? 0;
  const rightBlink =
    getBlendshapeScore(blendshape, ["eyeBlinkRight"]) ?? getFallbackBlinkScore(landmarks, "right") ?? 0;
  const blinkScore = Math.min(leftBlink, rightBlink);
  const mouthOpen =
    getBlendshapeScore(blendshape, ["jawOpen", "mouthOpen"]) ?? getFallbackMouthOpenScore(landmarks) ?? 0;

  return {
    yaw: Number.isFinite(yawDegrees) ? yawDegrees : 0,
    blink: clamp(blinkScore, 0, 1),
    mouthOpen: clamp(mouthOpen, 0, 1),
  };
};

const assessFrameQuality = (faces, primaryIndex, landmarks, yawDegrees, requireNeutralPose = true) => {
  if (!faces.length) {
    return { ok: false, reason: "얼굴을 카메라 안에 맞춰주세요." };
  }

  if (faces.length > 1) {
    return { ok: false, reason: "한 명만 화면에 들어오게 해주세요." };
  }

  if (primaryIndex < 0 || !landmarks) {
    return { ok: false, reason: "얼굴 랜드마크를 안정적으로 찾고 있습니다." };
  }

  const bounds = getNormalizedBounds(landmarks);

  if (!bounds) {
    return { ok: false, reason: "얼굴 위치를 다시 확인하고 있습니다." };
  }

  if (bounds.area < 0.045) {
    return { ok: false, reason: "카메라에 조금 더 가까이 와주세요." };
  }

  if (bounds.area > 0.48) {
    return { ok: false, reason: "카메라에서 조금 떨어져 주세요." };
  }

  if (bounds.centerX < 0.3 || bounds.centerX > 0.7 || bounds.centerY < 0.25 || bounds.centerY > 0.78) {
    return { ok: false, reason: "얼굴을 화면 중앙에 맞춰주세요." };
  }

  if (requireNeutralPose && Number.isFinite(yawDegrees) && Math.abs(yawDegrees) > 15) {
    return { ok: false, reason: "정면을 보고 시작해주세요." };
  }

  return { ok: true, reason: "준비되었습니다." };
};

const getLivenessSample = (result, faces, yawMeasurements, requireNeutralPose = true) => {
  const primaryIndex = getPrimaryFaceIndex(faces);
  const landmarks = primaryIndex >= 0 ? faces[primaryIndex] : null;
  const yaw = primaryIndex >= 0 ? yawMeasurements[primaryIndex] : null;
  const quality = assessFrameQuality(faces, primaryIndex, landmarks, yaw, requireNeutralPose);
  const blendshape = primaryIndex >= 0 ? result.faceBlendshapes?.[primaryIndex] : null;

  return {
    quality,
    signals: landmarks ? getLivenessSignals(landmarks, yaw, blendshape) : null,
  };
};

const getActionMatched = (step, signals) => {
  if (!signals) {
    return false;
  }

  if (step === "turnLeft") {
    return signals.yaw <= -TURN_YAW_DEGREES;
  }

  if (step === "turnRight") {
    return signals.yaw >= TURN_YAW_DEGREES;
  }

  if (step === "blink") {
    return signals.blink >= BLINK_CLOSED_SCORE;
  }

  if (step === "mouthOpen") {
    return signals.mouthOpen >= MOUTH_OPEN_SCORE;
  }

  return false;
};

const getNeutralMatched = (step, signals) => {
  if (!signals) {
    return false;
  }

  if (step === "turnLeft" || step === "turnRight") {
    return Math.abs(signals.yaw) <= NEUTRAL_YAW_DEGREES;
  }

  if (step === "blink") {
    return signals.blink <= BLINK_OPEN_SCORE;
  }

  if (step === "mouthOpen") {
    return signals.mouthOpen <= MOUTH_CLOSED_SCORE;
  }

  return false;
};

const getHoldMs = (step) => {
  if (step === "blink") {
    return 80;
  }

  if (step === "mouthOpen") {
    return 180;
  }

  return 160;
};

const failLiveness = (reason) => {
  const progress = getLivenessProgress();
  livenessState.state = "failed";
  livenessState.message = reason;
  livenessState.progress = progress;
  setStatus("실패", "error");
  renderLiveness();
};

const passLiveness = () => {
  livenessState.state = "passed";
  livenessState.stepIndex = livenessState.sequence.length;
  livenessState.progress = 1;
  livenessState.message = "랜덤 동작을 모두 확인했습니다.";
  setStatus("통과", "success");
  renderLiveness();
};

const advanceLivenessStep = (now) => {
  livenessState.stepIndex += 1;
  livenessState.stepPhase = "action";
  livenessState.stepStartedAt = now;
  livenessState.holdStartedAt = 0;

  if (livenessState.stepIndex >= livenessState.sequence.length) {
    passLiveness();
    return;
  }

  const nextStep = getCurrentChallenge();
  setLivenessMessage(CHALLENGE_LIBRARY[nextStep].actionText);
  renderLiveness();
};

const beginChallenge = (now) => {
  livenessState.state = "challenge";
  livenessState.stepIndex = 0;
  livenessState.stepPhase = "action";
  livenessState.startedAt = now;
  livenessState.stepStartedAt = now;
  livenessState.holdStartedAt = 0;
  livenessState.faceLostSince = 0;

  const firstStep = getCurrentChallenge();
  setStatus("동작", "active");
  setLivenessMessage(CHALLENGE_LIBRARY[firstStep].actionText);
  renderLiveness();
};

const updateStepHold = (matched, now, holdMs) => {
  if (!matched) {
    livenessState.holdStartedAt = 0;
    return false;
  }

  if (!livenessState.holdStartedAt) {
    livenessState.holdStartedAt = now;
  }

  return now - livenessState.holdStartedAt >= holdMs;
};

const updateChallengeStep = (sample, now) => {
  const step = getCurrentChallenge();

  if (!step) {
    passLiveness();
    return;
  }

  if (now - livenessState.startedAt > LIVENESS_SESSION_TIMEOUT_MS) {
    failLiveness("제한 시간 안에 동작을 완료하지 못했습니다.");
    return;
  }

  if (now - livenessState.stepStartedAt > LIVENESS_STEP_TIMEOUT_MS) {
    failLiveness("현재 동작 시간이 초과되었습니다. 다시 시도해주세요.");
    return;
  }

  if (livenessState.stepPhase === "action") {
    setLivenessMessage(CHALLENGE_LIBRARY[step].actionText);

    if (updateStepHold(getActionMatched(step, sample.signals), now, getHoldMs(step))) {
      livenessState.stepPhase = "neutral";
      livenessState.holdStartedAt = 0;
      setLivenessMessage(CHALLENGE_LIBRARY[step].neutralText);
    }
  } else if (updateStepHold(getNeutralMatched(step, sample.signals), now, 160)) {
    advanceLivenessStep(now);
    return;
  } else {
    setLivenessMessage(CHALLENGE_LIBRARY[step].neutralText);
  }

  renderLiveness();
};

const updateLiveness = (result, faces, yawMeasurements, now) => {
  if (!["quality", "challenge"].includes(livenessState.state)) {
    return;
  }

  const sample = getLivenessSample(result, faces, yawMeasurements, livenessState.state === "quality");
  livenessState.lastSignals = sample.signals;

  if (!sample.quality.ok) {
    if (livenessState.state === "challenge") {
      if (!livenessState.faceLostSince) {
        livenessState.faceLostSince = now;
      }

      if (now - livenessState.faceLostSince >= FACE_LOST_FAIL_MS) {
        failLiveness(sample.quality.reason);
        return;
      }
    } else {
      livenessState.qualityStartedAt = 0;
      livenessState.progress = 0;
    }

    setLivenessMessage(sample.quality.reason);
    renderLiveness();
    return;
  }

  livenessState.faceLostSince = 0;

  if (livenessState.state === "quality") {
    if (!livenessState.qualityStartedAt) {
      livenessState.qualityStartedAt = now;
    }

    livenessState.progress = clamp((now - livenessState.qualityStartedAt) / QUALITY_HOLD_MS, 0, 1);
    setLivenessMessage("정면 상태를 잠시 유지해주세요.");

    if (livenessState.progress >= 1) {
      beginChallenge(now);
      return;
    }

    renderLiveness();
    return;
  }

  updateChallengeStep(sample, now);
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
      updateLiveness(result, faces, yawMeasurements, now);
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
    setMessage("", false);
    await initGyroscope();
    startLivenessCheck();
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
  resetLiveness();
  updateToggle();
};

retryLivenessButton.addEventListener("click", () => {
  if (!isRunning) {
    start();
    return;
  }

  startLivenessCheck();
});

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
resetLiveness();
