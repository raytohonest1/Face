# Face Liveness SDK 개발 가이드

얼굴 검출, 라이브니스 체크, 자이로스코프 기능을 제공하는 SDK입니다.  
SDK는 UI를 포함하지 않으며, 콜백을 통해 상태를 전달합니다. 고객사 개발자가 자체 디자인으로 화면을 구성합니다.

---

## 목차

1. [설치](#1-설치)
2. [빠른 시작](#2-빠른-시작)
3. [초기화 옵션](#3-초기화-옵션)
4. [콜백 페이로드](#4-콜백-페이로드)
5. [메서드](#5-메서드)
6. [사용 시나리오](#6-사용-시나리오)
7. [환경별 주의사항](#7-환경별-주의사항)

---

## 1. 설치

### npm

```bash
npm install @your-company/face-liveness
```

```js
import { FaceLiveness } from "@your-company/face-liveness";
```

### CDN (스크립트 태그)

```html
<script src="https://cdn.your-company.com/face-liveness.umd.js"></script>
<script>
  const { FaceLiveness } = window.FaceLiveness;
</script>
```

### 망분리 환경 (자체 서버 호스팅)

SDK는 내부적으로 [MediaPipe](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker) WASM 파일을 사용합니다.  
외부 CDN 접근이 불가한 환경에서는 WASM 파일을 자체 서버에 올리고 `wasmPath`를 지정하세요.

```
[자체 서버]
  /assets/mediapipe-wasm/
    vision_wasm_internal.js
    vision_wasm_internal.wasm
```

```js
const sdk = new FaceLiveness({
  video: document.querySelector("#video"),
  wasmPath: "/assets/mediapipe-wasm/",
  // ...
});
```

> WASM 파일은 MediaPipe npm 패키지의 `node_modules/@mediapipe/tasks-vision/wasm/` 경로에 있습니다.

---

## 2. 빠른 시작

```html
<!-- 고객사가 직접 만든 UI -->
<video id="video" autoplay muted playsinline></video>
<p id="instruction"></p>
<p id="tilt"></p>
<button id="startBtn">시작</button>
```

```js
import { FaceLiveness } from "@your-company/face-liveness";

const sdk = new FaceLiveness({
  video: document.querySelector("#video"),

  gyroscope: { minTilt: 45 },

  liveness: "random",

  onCapture: ({ image, liveness, tilt }) => {
    // 촬영 완료 — image를 안면인식 API로 전송
    console.log("캡처 완료", { liveness, tilt });
    fetch("/api/face-verify", {
      method: "POST",
      body: JSON.stringify({ image }),
    });
  },

  onGyroChange: ({ angle, isReady, status }) => {
    const el = document.querySelector("#tilt");
    if (status === "unavailable") {
      el.textContent = "자이로스코프 미지원";
    } else if (status === "denied") {
      el.textContent = "센서 권한이 거부되었습니다";
    } else {
      el.textContent = `기울기: ${angle}° — ${isReady ? "준비됨" : "화면을 세워주세요"}`;
    }
  },

  onLivenessChange: ({ phase, step, stepPhase, stepIndex, totalSteps, progress, reason }) => {
    const el = document.querySelector("#instruction");

    if (phase === "quality") {
      el.textContent = "얼굴을 정면 중앙에 맞춰주세요";
    } else if (phase === "challenge") {
      const actions = {
        turnLeft:  { action: "고개를 왼쪽으로 돌리세요",  neutral: "정면으로 돌아오세요" },
        turnRight: { action: "고개를 오른쪽으로 돌리세요", neutral: "정면으로 돌아오세요" },
        blink:     { action: "눈을 한 번 깜빡이세요",      neutral: "눈을 다시 떠주세요" },
        mouthOpen: { action: "입을 크게 벌리세요",         neutral: "입을 다시 닫아주세요" },
      };
      el.textContent = stepPhase === "action"
        ? actions[step].action
        : actions[step].neutral;
    } else if (phase === "passed") {
      el.textContent = "인증 완료 — 촬영 중...";
    } else if (phase === "failed") {
      el.textContent = `실패: ${reason}`;
    }
  },

  onError: (error) => {
    alert(error.message);
  },
});

document.querySelector("#startBtn").addEventListener("click", () => sdk.start());
```

---

## 3. 초기화 옵션

```js
new FaceLiveness({
  video,        // (필수) HTMLVideoElement
  gyroscope,    // 자이로스코프 설정
  liveness,     // 라이브니스 설정
  wasmPath,     // WASM 경로 (기본값: jsdelivr CDN)
  modelUrl,     // 모델 파일 URL (기본값: Google Storage)
  onCapture,    // 캡처 완료 콜백
  onGyroChange, // 자이로스코프 변경 콜백
  onLivenessChange, // 라이브니스 상태 변경 콜백
  onError,      // 오류 콜백
})
```

### `video` (필수)

카메라 스트림을 표시할 `<video>` 요소입니다.

```js
video: document.querySelector("#my-video")
```

---

### `gyroscope`

| 값 | 동작 |
|---|---|
| `false` (기본값) | 자이로스코프 비활성화 |
| `true` | 활성화, 기울기 기준 45° |
| `{ minTilt: 60 }` | 활성화, 기울기 기준 60° |

- `minTilt`: 라이브니스를 진행하기 위해 필요한 최소 기울기 각도 (0 ~ 90°)
- 자이로스코프 활성화 시, 기기가 `minTilt` 미만으로 눕혀져 있으면 라이브니스가 진행되지 않습니다

```js
// 자이로 비활성화 (기본)
gyroscope: false

// 기본 기준(45°)으로 활성화
gyroscope: true

// 기준 각도 직접 지정
gyroscope: { minTilt: 60 }
```

---

### `liveness`

| 값 | 동작 |
|---|---|
| `"random"` (기본값) | 고개 돌림·눈 깜빡임·입 벌림 중 랜덤 3가지 |
| `false` | 라이브니스 체크 비활성화 |
| `{ challenges: ["blink", "mouthOpen"] }` | 지정된 동작만, 순서대로 |
| `{ challenges: "random" }` | 랜덤 순서 |

사용 가능한 챌린지 키:

| 키 | 동작 |
|---|---|
| `"turnLeft"` | 고개를 왼쪽으로 돌리기 |
| `"turnRight"` | 고개를 오른쪽으로 돌리기 |
| `"blink"` | 눈 깜빡이기 |
| `"mouthOpen"` | 입 벌리기 |

```js
// 기본: 랜덤 3가지
liveness: "random"

// 비활성화
liveness: false

// 눈 깜빡임 + 입 벌림, 이 순서로 고정
liveness: { challenges: ["blink", "mouthOpen"] }

// 고개 돌림만
liveness: { challenges: ["turnLeft"] }
```

> **주의:** `turnLeft`와 `turnRight`를 동시에 지정하면 둘 다 순서대로 수행합니다.

---

## 4. 콜백 페이로드

### `onCapture({ image, liveness, tilt })`

라이브니스 통과 시 자동으로 호출됩니다. `liveness: false`인 경우에는 `sdk.capture()`를 직접 호출하세요.

| 필드 | 타입 | 설명 |
|---|---|---|
| `image` | `string` | `data:image/jpeg;base64,...` 형식의 얼굴 이미지 |
| `liveness` | `"passed"` \| `"skipped"` | 라이브니스 결과 |
| `tilt` | `number` \| `null` | 촬영 시점의 기울기 각도 (자이로 비활성화 시 null) |

```js
onCapture: ({ image, liveness, tilt }) => {
  // image를 안면인식 API로 전송
  fetch("/api/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image, liveness, tilt }),
  });
}
```

---

### `onGyroChange({ angle, isReady, status })`

기기 기울기가 변할 때마다 호출됩니다.

| 필드 | 타입 | 설명 |
|---|---|---|
| `angle` | `number` \| `null` | 현재 기울기 각도 (0° = 눕혀짐, 90° = 세워짐) |
| `isReady` | `boolean` | `minTilt` 이상인지 여부 |
| `status` | `"upright"` \| `"flat"` \| `"unavailable"` \| `"denied"` | 상태 |

| status | 의미 |
|---|---|
| `"upright"` | 기기가 충분히 세워진 상태 |
| `"flat"` | 기기가 눕혀진 상태 |
| `"unavailable"` | 자이로스코프 하드웨어 없음 |
| `"denied"` | iOS에서 센서 권한 거부 |

```js
onGyroChange: ({ angle, isReady, status }) => {
  if (status === "denied") {
    // iOS: 설정 > Safari > 모션 및 방향 접근 허용 안내
    showPermissionGuide();
    return;
  }
  updateTiltUI(angle, isReady);
}
```

---

### `onLivenessChange({ phase, step, stepPhase, stepIndex, totalSteps, progress, reason })`

라이브니스 상태가 변할 때마다 호출됩니다.

| 필드 | 타입 | 설명 |
|---|---|---|
| `phase` | `string` | 현재 단계 (아래 표 참고) |
| `step` | `string` \| `null` | 현재 챌린지 키 (`"blink"` 등) |
| `stepPhase` | `"action"` \| `"neutral"` | 동작 수행 중 / 원위치 복귀 중 |
| `stepIndex` | `number` | 현재 챌린지 순번 (0부터) |
| `totalSteps` | `number` | 전체 챌린지 수 |
| `progress` | `number` | 전체 진행률 0.0 ~ 1.0 |
| `reason` | `string` \| `null` | 실패 사유 (`phase === "failed"`일 때) |

**`phase` 값:**

| phase | 의미 |
|---|---|
| `"quality"` | 얼굴 품질 확인 중 (정면 유지 대기) |
| `"challenge"` | 챌린지 수행 중 |
| `"passed"` | 모든 챌린지 통과 → 자동 캡처 진행됨 |
| `"failed"` | 실패 (시간 초과, 얼굴 이탈 등) |
| `"idle"` | 미시작 상태 |

---

### `onError(error)`

카메라 권한 거부, HTTPS 미사용 등 SDK 초기화/실행 오류 시 호출됩니다.

```js
onError: (error) => {
  if (error.message.includes("HTTPS")) {
    showMessage("HTTPS 환경에서만 사용 가능합니다");
  } else {
    showMessage("카메라를 시작할 수 없습니다: " + error.message);
  }
}
```

---

## 5. 메서드

### `sdk.start()`

카메라를 열고 라이브니스 체크를 시작합니다. 이미 실행 중이면 아무 동작도 하지 않습니다.

- `async` 함수이지만 await 없이 호출해도 됩니다
- 오류 발생 시 `onError` 콜백으로 전달됩니다

```js
button.addEventListener("click", () => sdk.start());
```

---

### `sdk.stop()`

카메라를 닫고 모든 리소스를 해제합니다.

```js
sdk.stop();
```

---

### `sdk.capture()`

현재 프레임의 얼굴 이미지를 캡처해 `onCapture`를 호출합니다.

- **`liveness: false`인 경우** 직접 호출해야 합니다 (라이브니스 통과 이벤트가 없으므로)
- 라이브니스 활성화 시에는 통과 직후 자동으로 호출되므로 보통 불필요합니다

```js
// 라이브니스 없이 수동 촬영
captureButton.addEventListener("click", () => sdk.capture());
```

---

## 6. 사용 시나리오

### 시나리오 A: 풀 기능 (자이로스코프 + 라이브니스)

```js
const sdk = new FaceLiveness({
  video: videoEl,
  gyroscope: { minTilt: 45 },
  liveness: "random",
  onCapture: ({ image }) => sendToServer(image),
  onGyroChange: ({ angle, isReady }) => {
    tiltDisplay.textContent = `${angle ?? "--"}°`;
    tiltGuide.hidden = isReady;  // "화면을 세워주세요" 안내 숨기기/보이기
  },
  onLivenessChange: ({ phase, step, stepPhase }) => {
    instructionEl.textContent = getInstruction(phase, step, stepPhase);
  },
  onError: (e) => alert(e.message),
});
```

---

### 시나리오 B: 라이브니스만 (자이로스코프 없음)

```js
const sdk = new FaceLiveness({
  video: videoEl,
  gyroscope: false,
  liveness: { challenges: ["blink", "mouthOpen"] },
  onCapture: ({ image }) => sendToServer(image),
  onLivenessChange: ({ phase, step, stepPhase }) => { /* ... */ },
  onError: (e) => console.error(e),
});
```

---

### 시나리오 C: 자이로스코프만 (라이브니스 없음, 수동 촬영)

```js
const sdk = new FaceLiveness({
  video: videoEl,
  gyroscope: { minTilt: 45 },
  liveness: false,
  onCapture: ({ image, tilt }) => sendToServer(image, tilt),
  onGyroChange: ({ isReady }) => {
    captureBtn.disabled = !isReady;  // 세워진 상태에서만 촬영 버튼 활성화
  },
  onError: (e) => console.error(e),
});

// 사용자가 버튼 클릭 시 수동 촬영
captureBtn.addEventListener("click", () => sdk.capture());
```

---

### 시나리오 D: 최소 구성 (둘 다 없음)

```js
const sdk = new FaceLiveness({
  video: videoEl,
  gyroscope: false,
  liveness: false,
  onCapture: ({ image }) => sendToServer(image),
  onError: (e) => console.error(e),
});

sdk.start();
// 원하는 시점에 수동 촬영
captureBtn.addEventListener("click", () => sdk.capture());
```

---

## 7. 환경별 주의사항

### HTTPS 필수

카메라 API는 HTTPS 또는 `localhost`에서만 동작합니다.  
HTTP 환경에서 `sdk.start()`를 호출하면 `onError`로 오류가 전달됩니다.

---

### iOS 자이로스코프 권한 (iOS 13 이상)

iOS 13 이상에서는 `gyroscope`를 활성화하면 SDK가 자동으로 권한 다이얼로그를 표시합니다.  
**단, 반드시 사용자 제스처(버튼 클릭 등) 직후에 `sdk.start()`를 호출해야 합니다.**

```js
// ✅ 올바른 방법 — 버튼 클릭 이벤트에서 호출
button.addEventListener("click", () => sdk.start());

// ❌ 잘못된 방법 — 페이지 로드 시 자동 호출 (iOS에서 권한 다이얼로그 안 뜸)
window.onload = () => sdk.start();
```

사용자가 권한을 거부하면 `onGyroChange({ status: "denied" })` 콜백이 전달됩니다.  
이 경우 **설정 > Safari > 모션 및 방향 접근** 허용을 안내하세요.

---

### 망분리 환경

기본값으로 SDK는 다음 외부 URL에서 파일을 내려받습니다:

| 파일 | 기본 URL |
|---|---|
| WASM | `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm` |
| 모델 | `https://storage.googleapis.com/mediapipe-models/...` |

외부 인터넷 접근이 불가한 환경에서는 두 파일을 자체 서버에 호스팅하고 경로를 지정하세요:

```js
const sdk = new FaceLiveness({
  video: videoEl,
  wasmPath: "https://내부CDN/mediapipe-wasm/",
  modelUrl: "https://내부CDN/models/face_landmarker.task",
  // ...
});
```

WASM 파일 목록:
```
node_modules/@mediapipe/tasks-vision/wasm/
  vision_wasm_internal.js
  vision_wasm_internal.wasm
  vision_wasm_internal_simd.js      (선택)
  vision_wasm_internal_simd.wasm    (선택)
```

모델 파일:
```
face_landmarker.task  (~10MB, 최초 1회 다운로드 후 브라우저 캐시)
```

---

### Android 지원

| 환경 | 상태 |
|---|---|
| Android Chrome 66+ | 정상 동작 |
| 자이로스코프 없는 저사양 기기 | `onGyroChange({ status: "unavailable" })` 전달 |
| HTTP 환경 | 카메라 접근 불가 |

---

### WKWebView (앱 내 웹뷰)

iOS 앱 내 WKWebView에서는 `DeviceOrientationEvent.requestPermission`이 동작하지 않을 수 있습니다.  
이 경우 `gyroscope: false`로 설정하고, 자이로스코프 기능을 앱 네이티브 레이어에서 처리한 뒤 결과를 UI에 표시하는 방식을 권장합니다.
