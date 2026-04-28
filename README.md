# Face Liveness Mobile Sample

모바일 웹에서 전면 카메라를 열고 MediaPipe Face Landmarker로 얼굴 랜드마크, 좌우 회전 각도, 기본 라이브니스 체크를 수행하는 샘플입니다.

## 실행

브라우저의 카메라 API는 보안 컨텍스트에서만 동작하므로 `file://` 대신 `localhost`로 실행하세요.

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

브라우저에서 `http://127.0.0.1:4173`로 접속합니다.

휴대폰에서 PC 주소로 접속하는 경우 일반 HTTP에서는 카메라 권한이 차단될 수 있습니다. 실제 모바일 테스트는 HTTPS 터널, HTTPS 배포, 또는 기기 내 localhost 환경을 사용하세요.

## 기능

- 전면 카메라 미리보기
- MediaPipe Face Landmarker 기반 얼굴 랜드마크 표시
- 얼굴 좌우 회전 각도 표시
- 최근 프레임의 얼굴 중심/크기 변화 기반 흔들림 표시
- 얼굴 랜드마크 특징값 로컬 등록 및 현재 얼굴 유사도 비교
- 랜덤 순서 라이브니스 체크
  - 고개 왼쪽 또는 오른쪽 돌림
  - 양쪽 눈 깜빡임
  - 입 벌림
- 얼굴 품질 게이트
  - 얼굴 1개만 허용
  - 화면 중앙, 적정 크기, 정면, 낮은 흔들림 상태 확인
  - 얼굴 유실 또는 제한 시간 초과 시 실패

## 파일

- `index.html`: 모바일 카메라, 메트릭, 라이브니스 진행 UI
- `styles.css`: 모바일 전체 화면 카메라 UI 스타일
- `app.js`: 카메라 제어, Face Landmarker 실행, yaw 계산, 라이브니스 상태 머신
- `index_backup.html`: 이전 `index.html` 백업

## 구현 메모

`Yaw`는 Face Landmarker의 `facialTransformationMatrixes`에서 좌우 회전 성분을 읽고, 화면 기준 방향 보정을 위해 랜드마크 위치를 함께 사용합니다.

`Shake`는 최근 약 0.85초 동안 얼굴 안정점의 중심과 얼굴 크기 변화량을 얼굴 크기 기준으로 정규화해 0-100% 수준으로 표시합니다. 흔들림이 큰 상태에서는 라이브니스 시작 전 준비 단계가 통과되지 않습니다.

`Match`는 정면, 중앙, 낮은 흔들림 상태에서 `얼굴 등록`을 누르면 이미지 대신 정규화된 랜드마크 특징 벡터를 브라우저 `localStorage`에 저장하고, 현재 얼굴의 특징 벡터와 거리 기반 유사도를 비교합니다. Face Landmarker만 사용하는 데모용 비교이므로 실제 본인 인증 수준의 얼굴 인식 임베딩을 대체하지 않습니다.

라이브니스 체크는 `outputFaceBlendshapes`를 켜서 `eyeBlinkLeft`, `eyeBlinkRight`, `jawOpen` 점수를 우선 사용하고, 값이 없을 때는 랜드마크 거리 비율로 눈깜빡임과 입벌림을 보조 계산합니다.

현재 구현은 클라이언트 샘플입니다. 정식 인증/FAKE 방지 목적이라면 서버가 랜덤 챌린지를 발급하고, 세션 nonce, 실패 횟수, 재사용 방지, 짧은 증거 영상 또는 이벤트 로그 검증까지 맡아야 합니다.

## 외부 모델

MediaPipe WASM과 Face Landmarker 모델은 CDN에서 불러옵니다. 폐쇄망이나 오프라인 환경에서는 `app.js`의 `WASM_ROOT`, `MODEL_URL`을 자체 호스팅 경로로 바꾸세요.
