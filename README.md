# Face Detect Mobile Sample

모바일 웹에서 전면 카메라를 띄우고 MediaPipe Face Landmarker로 얼굴 랜드마크와 좌우 회전 각도를 표시하는 최소 샘플입니다.

## 실행

카메라 API는 보안 컨텍스트가 필요하므로 `file://` 대신 `localhost`로 실행하세요.

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

브라우저에서 `http://127.0.0.1:4173`을 열면 됩니다.

실제 휴대폰에서 PC 개발 서버에 접속할 때는 `http://PC_IP:4173`이 보안 컨텍스트가 아니므로 카메라가 차단될 수 있습니다. 모바일 실기기 검증은 HTTPS 배포 환경, HTTPS 터널, 또는 기기 내부에서 실행되는 localhost 환경을 사용하세요.

## 구성

- `index.html`: 모바일 웹 화면 구조
- `styles.css`: 전면 카메라 뷰어와 오버레이 UI
- `app.js`: 카메라 권한 요청, MediaPipe Face Landmarker 모델 로딩, 얼굴 랜드마크 추적 루프, 캔버스 렌더링
- `index_backup.html`: Face Detector 기반 이전 화면 백업

## 각도 표시

`Yaw`는 Face Landmarker의 `facialTransformationMatrixes`에서 좌우 회전 성분을 읽고, 화면 기준 방향 보정을 위해 랜드마크 위치를 함께 사용합니다. 화면은 셀피 뷰로 좌우 반전되어 있으므로 `왼쪽`/`오른쪽` 방향도 화면 기준으로 표시합니다.

## 참고

MediaPipe 모델과 WASM 런타임은 CDN에서 로드됩니다. 오프라인 실행이 필요하면 `app.js`의 `WASM_ROOT`, `MODEL_URL`을 로컬 파일 경로로 바꾸면 됩니다.
