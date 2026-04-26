import { FaceLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/vision_bundle.mjs";

const WASM_ROOT = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

const DETECTION_INTERVAL_MS = 90;
const RAD_TO_DEG = 180 / Math.PI;
const TURN_TARGET_DEGREES = 26;
const NEUTRAL_MATCH_DEGREES = 8;
const STEP_HOLD_MS = 420;
const VIDEO_SIZE = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
};

const FACE_STEPS = [
  {
    id: "ready",
    type: "neutral",
    lines: ["얼굴을 원 안에 맞추고,", "정면을 바라봐 주세요"],
    status: "정면 상태를 확인하고 있습니다.",
  },
  {
    id: "right",
    type: "right",
    lines: ["오른쪽 방향으로", "얼굴을 돌려주세요"],
    status: "고개 각도에 맞춰 원형 게이지가 채워집니다.",
  },
  {
    id: "return-right",
    type: "neutral",
    lines: ["정면으로", "얼굴을 돌려주세요"],
    status: "채워진 게이지가 줄어들 때까지 정면으로 돌아와 주세요.",
  },
  {
    id: "left",
    type: "left",
    lines: ["왼쪽 방향으로", "얼굴을 돌려주세요"],
    status: "반대 방향도 같은 방식으로 확인합니다.",
  },
  {
    id: "return-left",
    type: "neutral",
    lines: ["정면으로", "얼굴을 돌려주세요"],
    status: "마지막 정면 상태를 확인하고 있습니다.",
  },
];

const app = document.querySelector("#app");

let landmarker = null;
let stream = null;
let video = null;
let animationFrameId = 0;
let lastDetectionAt = 0;
let lastVideoTime = -1;

const state = {
  view: "start",
  loadingText: "",
  idImage: "",
  idFacePresent: false,
  faceStepIndex: 0,
  faceHoldStartedAt: 0,
  faceBusyCompleting: false,
};

const isCameraView = (view) => view === "idScan" || view === "faceScan";
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const renderStatusBar = (dark = false) => `
  <div class="status-bar${dark ? " dark" : ""}" aria-hidden="true">
    <span class="status-time">9:41</span>
    <span class="status-icons">
      <span class="signal-icon"></span>
      <span class="wifi-icon"></span>
      <span class="battery-icon"></span>
    </span>
  </div>
`;

const renderHomeIndicator = (dark = false) =>
  `<div class="home-indicator${dark ? " dark" : ""}" aria-hidden="true"></div>`;

const renderHeader = ({ title = "", backAction = "", camera = false } = {}) => `
  <header class="app-header${camera ? " camera-header" : ""}">
    ${
      backAction
        ? `<button class="icon-button" type="button" data-action="${backAction}" aria-label="이전 화면으로 이동">
            <span class="arrow-left" aria-hidden="true"></span>
          </button>`
        : "<span></span>"
    }
    ${title ? `<h1 class="header-title">${title}</h1>` : "<span></span>"}
    <span></span>
  </header>
`;

const renderLoading = () => `
  <div id="loadingView" class="loading-view${state.loadingText ? " active" : ""}">
    <div>
      <div class="spinner" aria-hidden="true"></div>
      <p id="loadingText">${state.loadingText}</p>
    </div>
  </div>
`;

const renderStart = () => `
  <section class="phone dark">
    <div class="screen dark">
      ${renderStatusBar(false)}
      <div class="start-body">
        <div class="brand-lockup">
          <div class="kiwoom-logo" aria-label="KIWOOM">KIWOOM</div>
          <p class="start-copy">간편하게 시작하는<br /><strong>비대면 본인인증</strong></p>
        </div>
        <div class="uface-logo" aria-label="UFACE">UFACE</div>
      </div>
      <div class="bottom-action">
        <button class="primary-button" type="button" data-action="start">시작하기</button>
      </div>
      ${renderHomeIndicator(false)}
    </div>
  </section>
`;

const renderIdGuide = () => `
  <section class="phone">
    <div class="screen">
      ${renderStatusBar(false)}
      ${renderHeader({ title: "신분증 본인인증", backAction: "home" })}
      <div class="body guide-layout face-guide-body">
        <div class="title-block">
          <h2 class="page-title">주민등록증 또는 운전면허증을<br />촬영해 주세요.</h2>
        </div>
        <div>
          <div class="guide-visual">
            <div class="id-illustration" aria-hidden="true">
              <div class="id-card"><span class="id-photo"></span></div>
            </div>
          </div>
          <div class="guide-list">
            <div class="guide-item">
              <span class="guide-icon light" aria-hidden="true"></span>
              <span>신분증 앞면이 잘 보이도록<br />약간 어두운 조명과 배경에 놓아주세요.</span>
            </div>
            <div class="guide-item">
              <span class="guide-icon frame" aria-hidden="true"></span>
              <span>가이드 영역에 맞추어 신분증을 촬영해 주세요.</span>
            </div>
          </div>
        </div>
      </div>
      <div class="bottom-action">
        <button class="primary-button" type="button" data-action="id-scan">신분증 촬영</button>
      </div>
      ${renderHomeIndicator(false)}
      ${renderLoading()}
    </div>
  </section>
`;

const renderIdScan = () => `
  <section class="phone">
    <div class="screen camera-screen">
      <video id="camera" class="live-video" autoplay muted playsinline></video>
      ${renderStatusBar(true)}
      ${renderHeader({ backAction: "id-guide", camera: true })}
      <div class="id-window" aria-hidden="true"><span class="corner-pair"></span></div>
      <p id="cameraInstruction" class="camera-instruction">신분증을 가이드 안에 맞춰 촬영해 주세요.</p>
      <div class="camera-toolbar">
        <button class="shutter-button" type="button" data-action="id-capture" aria-label="신분증 촬영">
          <span class="camera-icon" aria-hidden="true"></span>
        </button>
      </div>
      ${renderHomeIndicator(true)}
      ${renderLoading()}
    </div>
  </section>
`;

const renderIdConfirm = () => `
  <section class="phone">
    <div class="screen">
      ${renderStatusBar(false)}
      ${renderHeader({ title: "신분증 본인인증", backAction: "id-scan" })}
      <div class="body guide-layout">
        <div class="title-block">
          <h2 class="page-title">촬영한 신분증을<br />확인해 주세요.</h2>
          <p class="page-subtitle">얼굴 사진이 감지되면 다음 단계로 진행할 수 있어요.</p>
        </div>
        <div class="capture-preview">
          ${
            state.idImage
              ? `<img src="${state.idImage}" alt="촬영된 신분증 이미지" />`
              : `<div class="empty-preview">촬영된 이미지가 없습니다.</div>`
          }
        </div>
      </div>
      <div class="bottom-stack">
        <button class="secondary-button" type="button" data-action="id-scan">다시 촬영</button>
        <button class="primary-button" type="button" data-action="face-guide">다음으로</button>
      </div>
      ${renderHomeIndicator(false)}
    </div>
  </section>
`;

const renderFaceGuide = () => `
  <section class="phone">
    <div class="screen">
      ${renderStatusBar(false)}
      ${renderHeader({ title: "얼굴 본인인증", backAction: "id-confirm" })}
      <div class="body guide-layout">
        <div class="title-block">
          <h2 class="page-title">얼굴을 촬영해<br />본인 인증을 진행해 주세요.</h2>
        </div>
        <div>
          <div class="guide-visual">
            <div class="face-illustration" aria-hidden="true"></div>
          </div>
          <div class="guide-list">
            <div class="guide-item">
              <span class="guide-icon face" aria-hidden="true"></span>
              <span>얼굴은 정면을 향해주세요.</span>
            </div>
            <div class="guide-item">
              <span class="guide-icon light" aria-hidden="true"></span>
              <span>역광·어두운 환경은 피해서 촬영해 주세요.</span>
            </div>
            <div class="guide-item">
              <span class="guide-icon mask" aria-hidden="true"></span>
              <span>모자, 마스크, 머리카락 등으로 얼굴을 가리지 말아 주세요.</span>
            </div>
          </div>
        </div>
      </div>
      <div class="bottom-action">
        <button class="primary-button" type="button" data-action="face-scan">얼굴 촬영</button>
      </div>
      ${renderHomeIndicator(false)}
      ${renderLoading()}
    </div>
  </section>
`;

const renderFaceScan = () => {
  const step = FACE_STEPS[state.faceStepIndex];

  return `
    <section class="phone">
      <div class="screen camera-screen">
        <video id="camera" class="live-video mirror" autoplay muted playsinline></video>
        ${renderStatusBar(true)}
        ${renderHeader({ backAction: "face-guide", camera: true })}
        <div class="face-camera-body">
          <div class="face-gauge-wrap">
            <div id="faceGauge" class="face-gauge" style="--left-progress: 0; --right-progress: 0">
              <svg class="gauge-svg" viewBox="0 0 322 322" aria-hidden="true">
                <path class="gauge-track" d="M 161 15 A 146 146 0 0 0 161 307" pathLength="100" />
                <path class="gauge-track" d="M 161 15 A 146 146 0 0 1 161 307" pathLength="100" />
                <path class="gauge-fill gauge-fill-left" d="M 161 15 A 146 146 0 0 0 161 307" pathLength="100" />
                <path class="gauge-fill gauge-fill-right" d="M 161 15 A 146 146 0 0 1 161 307" pathLength="100" />
              </svg>
              <div class="face-viewfinder" aria-hidden="true"></div>
            </div>
            <span id="leftArrow" class="turn-arrow left" aria-hidden="true"></span>
            <span id="rightArrow" class="turn-arrow right" aria-hidden="true"></span>
          </div>
          <p id="facePrompt" class="face-prompt">${step.lines.join("<br />")}</p>
        </div>
        <p id="faceStatus" class="face-status">${step.status}</p>
        ${renderHomeIndicator(true)}
        ${renderLoading()}
      </div>
    </section>
  `;
};

const renderSuccess = () => `
  <section class="phone">
    <div class="screen">
      ${renderStatusBar(false)}
      ${renderHeader({ title: "본인인증 완료" })}
      <div class="success-layout">
        <div>
          <div class="success-mark" aria-hidden="true"></div>
          <h2 class="success-title">인증에 성공했습니다.</h2>
          <p class="success-copy">얼굴 비교는 아직 적용하지 않은 더미 성공 화면입니다.</p>
        </div>
      </div>
      <div class="bottom-action">
        <button class="primary-button" type="button" data-action="restart">처음으로</button>
      </div>
      ${renderHomeIndicator(false)}
    </div>
  </section>
`;

const render = () => {
  const views = {
    start: renderStart,
    idGuide: renderIdGuide,
    idScan: renderIdScan,
    idConfirm: renderIdConfirm,
    faceGuide: renderFaceGuide,
    faceScan: renderFaceScan,
    success: renderSuccess,
  };

  app.innerHTML = views[state.view]();
};

const setLoading = (text = "") => {
  state.loadingText = text;
  const loadingView = document.querySelector("#loadingView");
  const loadingText = document.querySelector("#loadingText");

  if (loadingView) {
    loadingView.classList.toggle("active", Boolean(text));
  }

  if (loadingText) {
    loadingText.textContent = text;
  }
};

const setCameraInstruction = (text, warning = false) => {
  const instruction = document.querySelector("#cameraInstruction");

  if (!instruction) {
    return;
  }

  instruction.textContent = text;
  instruction.classList.toggle("warning", warning);
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

const getIsLikelyMobile = () =>
  /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
  (navigator.maxTouchPoints > 1 && /Macintosh/i.test(navigator.userAgent));

const getFirstVideoDeviceId = async () => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const firstCamera = devices.find((device) => device.kind === "videoinput");
    return firstCamera?.deviceId || "";
  } catch (error) {
    console.warn("Unable to enumerate video devices.", error);
    return "";
  }
};

const getVideoConstraints = async (intent) => {
  if (intent === "face") {
    return {
      ...VIDEO_SIZE,
      facingMode: { ideal: "user" },
    };
  }

  if (getIsLikelyMobile()) {
    return {
      ...VIDEO_SIZE,
      facingMode: { ideal: "environment" },
    };
  }

  const firstDeviceId = await getFirstVideoDeviceId();

  if (firstDeviceId) {
    return {
      ...VIDEO_SIZE,
      deviceId: { exact: firstDeviceId },
    };
  }

  return VIDEO_SIZE;
};

const requestCamera = async (intent) => {
  const videoConstraints = await getVideoConstraints(intent);

  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: videoConstraints,
    });
  } catch (error) {
    if (intent === "id") {
      return navigator.mediaDevices.getUserMedia({
        audio: false,
        video: VIDEO_SIZE,
      });
    }

    throw error;
  }
};

const waitForVideo = async () => {
  if (!video) {
    return;
  }

  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
    return;
  }

  await new Promise((resolve) => {
    video.addEventListener("loadedmetadata", resolve, { once: true });
  });
};

const stopCamera = () => {
  cancelAnimationFrame(animationFrameId);
  animationFrameId = 0;

  if (stream) {
    for (const track of stream.getTracks()) {
      track.stop();
    }
  }

  stream = null;
  video = null;
  lastDetectionAt = 0;
  lastVideoTime = -1;
};

const startCamera = async (mode) => {
  try {
    video = document.querySelector("#camera");

    if (!video) {
      return;
    }

    setLoading("카메라와 얼굴 검출 모델을 준비하고 있습니다.");
    ensureSecureContext();
    await loadLandmarker();

    stream = await requestCamera(mode);
    video.srcObject = stream;
    await waitForVideo();
    await video.play();
    video.classList.add("ready");

    lastDetectionAt = 0;
    lastVideoTime = -1;
    animationFrameId = requestAnimationFrame(detectLoop);
  } catch (error) {
    console.error(error);
    if (state.view === "idScan") {
      setCameraInstruction(error.message || "카메라를 시작하지 못했습니다.", true);
    } else {
      updateFaceUi(0, error.message || "카메라를 시작하지 못했습니다.", "neutral");
    }
  } finally {
    setLoading("");
  }
};

const setView = async (view) => {
  if (isCameraView(state.view)) {
    stopCamera();
  }

  state.view = view;

  if (view === "faceScan") {
    state.faceStepIndex = 0;
    state.faceHoldStartedAt = 0;
    state.faceBusyCompleting = false;
  }

  render();

  if (view === "idScan") {
    state.idFacePresent = false;
    await startCamera("id");
  } else if (view === "faceScan") {
    await startCamera("face");
  }
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
  return data?.length >= 16 ? data : null;
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
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    area: (maxX - minX) * (maxY - minY),
  };
};

const getFaceQuality = (faces, primaryIndex) => {
  if (!faces.length) {
    return { ok: false, reason: "얼굴을 원 안에 맞춰주세요." };
  }

  if (faces.length > 1) {
    return { ok: false, reason: "한 명만 화면에 들어오게 해주세요." };
  }

  const landmarks = primaryIndex >= 0 ? faces[primaryIndex] : null;

  if (!landmarks) {
    return { ok: false, reason: "얼굴을 안정적으로 찾고 있습니다." };
  }

  const bounds = getNormalizedBounds(landmarks);

  if (!bounds) {
    return { ok: false, reason: "얼굴 위치를 다시 확인하고 있습니다." };
  }

  if (bounds.area < 0.04) {
    return { ok: false, reason: "카메라에 조금 더 가까이 와주세요." };
  }

  if (bounds.area > 0.55) {
    return { ok: false, reason: "카메라에서 조금 떨어져 주세요." };
  }

  if (bounds.centerX < 0.24 || bounds.centerX > 0.76 || bounds.centerY < 0.22 || bounds.centerY > 0.8) {
    return { ok: false, reason: "얼굴을 원 중앙에 맞춰주세요." };
  }

  return { ok: true, reason: "" };
};

const getFaceStepProgress = (step, yawDegrees) => {
  const yaw = Number.isFinite(yawDegrees) ? yawDegrees : 0;

  if (step.type === "right") {
    return clamp(yaw / TURN_TARGET_DEGREES, 0, 1);
  }

  if (step.type === "left") {
    return clamp(-yaw / TURN_TARGET_DEGREES, 0, 1);
  }

  return clamp(1 - Math.abs(yaw) / 14, 0, 1);
};

const getGaugeProgress = (step, yawDegrees, stepProgress) => {
  const yaw = Number.isFinite(yawDegrees) ? yawDegrees : 0;

  if (step.type === "right") {
    return { left: 0, right: stepProgress };
  }

  if (step.type === "left") {
    return { left: stepProgress, right: 0 };
  }

  const neutralProgress = clamp(Math.abs(yaw) / TURN_TARGET_DEGREES, 0, 1);

  if (yaw > NEUTRAL_MATCH_DEGREES) {
    return { left: 0, right: neutralProgress };
  }

  if (yaw < -NEUTRAL_MATCH_DEGREES) {
    return { left: neutralProgress, right: 0 };
  }

  return { left: 0, right: 0 };
};

const updateFaceUi = (progress, statusText, direction, step = FACE_STEPS[state.faceStepIndex]) => {
  const gauge = document.querySelector("#faceGauge");
  const prompt = document.querySelector("#facePrompt");
  const status = document.querySelector("#faceStatus");
  const leftArrow = document.querySelector("#leftArrow");
  const rightArrow = document.querySelector("#rightArrow");
  const gaugeProgress =
    typeof progress === "number" ? { left: progress, right: progress } : { left: 0, right: 0, ...progress };

  if (gauge) {
    gauge.style.setProperty("--left-progress", String(Math.round(clamp(gaugeProgress.left, 0, 1) * 100)));
    gauge.style.setProperty("--right-progress", String(Math.round(clamp(gaugeProgress.right, 0, 1) * 100)));
  }

  if (prompt) {
    prompt.innerHTML = step.lines.join("<br />");
  }

  if (status) {
    status.textContent = statusText || step.status;
  }

  leftArrow?.classList.toggle("active", direction === "left");
  rightArrow?.classList.toggle("active", direction === "right");
};

const advanceFaceStep = () => {
  state.faceHoldStartedAt = 0;

  if (state.faceStepIndex >= FACE_STEPS.length - 1) {
    state.faceBusyCompleting = true;
    void setView("success");
    return;
  }

  state.faceStepIndex += 1;
  const nextStep = FACE_STEPS[state.faceStepIndex];
  updateFaceUi(0, nextStep.status, nextStep.type, nextStep);
};

const updateFaceScan = (faces, yawMeasurements, now) => {
  if (state.faceBusyCompleting) {
    return;
  }

  const step = FACE_STEPS[state.faceStepIndex];
  const primaryIndex = getPrimaryFaceIndex(faces);
  const yaw = primaryIndex >= 0 ? yawMeasurements[primaryIndex] : null;
  const quality = getFaceQuality(faces, primaryIndex);

  if (!quality.ok) {
    state.faceHoldStartedAt = 0;
    updateFaceUi({ left: 0, right: 0 }, quality.reason, "neutral", step);
    return;
  }

  const stepProgress = getFaceStepProgress(step, yaw);
  const gaugeProgress = getGaugeProgress(step, yaw, stepProgress);
  const isMatched =
    step.type === "neutral" ? Math.abs(yaw ?? 0) <= NEUTRAL_MATCH_DEGREES : stepProgress >= 1;

  if (isMatched) {
    if (!state.faceHoldStartedAt) {
      state.faceHoldStartedAt = now;
    }

    if (now - state.faceHoldStartedAt >= STEP_HOLD_MS) {
      advanceFaceStep();
      return;
    }
  } else {
    state.faceHoldStartedAt = 0;
  }

  updateFaceUi(gaugeProgress, step.status, step.type, step);
};

const updateIdScan = (faces) => {
  state.idFacePresent = faces.length > 0;

  if (state.idFacePresent) {
    setCameraInstruction("얼굴 사진을 감지했습니다. 촬영 버튼을 눌러 주세요.");
  } else {
    setCameraInstruction("신분증을 가이드 안에 맞춰 촬영해 주세요.");
  }
};

const detectLoop = () => {
  if (!isCameraView(state.view) || !landmarker || !video || !stream || video.paused || video.ended) {
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

      if (state.view === "idScan") {
        updateIdScan(faces);
      } else if (state.view === "faceScan") {
        updateFaceScan(faces, yawMeasurements, now);
      }
    } catch (error) {
      console.error("Face detection failed.", error);
      if (state.view === "idScan") {
        setCameraInstruction("얼굴 검출 중 오류가 발생했습니다.", true);
      } else {
        updateFaceUi(0, "얼굴 검출 중 오류가 발생했습니다.", "neutral");
      }
    }
  }

  if (isCameraView(state.view) && stream) {
    animationFrameId = requestAnimationFrame(detectLoop);
  }
};

const captureFrame = () => {
  if (!video || !video.videoWidth || !video.videoHeight) {
    return "";
  }

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.88);
};

const handleIdCapture = async () => {
  if (!state.idFacePresent) {
    setCameraInstruction("얼굴 사진이 보이도록 신분증을 다시 맞춰주세요.", true);
    return;
  }

  state.idImage = captureFrame();
  await setView("idConfirm");
};

app.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");

  if (!button) {
    return;
  }

  const { action } = button.dataset;

  const actions = {
    start: () => setView("idGuide"),
    home: () => setView("start"),
    "id-guide": () => setView("idGuide"),
    "id-scan": () => setView("idScan"),
    "id-capture": handleIdCapture,
    "id-confirm": () => setView("idConfirm"),
    "face-guide": () => setView("faceGuide"),
    "face-scan": () => setView("faceScan"),
    restart: () => {
      state.idImage = "";
      return setView("start");
    },
  };

  void actions[action]?.();
});

window.addEventListener("pagehide", stopCamera);

render();
