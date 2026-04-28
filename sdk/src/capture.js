const isValidPoint = (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y);

const getFaceCropRect = (landmarks, videoWidth, videoHeight) => {
  const pts = landmarks.filter(isValidPoint);
  if (!pts.length) return null;
  const xs = pts.map((p) => p.x * videoWidth);
  const ys = pts.map((p) => p.y * videoHeight);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const pad = Math.max(20, (maxX - minX) * 0.28);
  return {
    x: Math.max(0, minX - pad),
    y: Math.max(0, minY - pad),
    w: Math.min(videoWidth, maxX - minX + pad * 2),
    h: Math.min(videoHeight, maxY - minY + pad * 2),
  };
};

export const captureFrame = (video, landmarks, quality = 0.92) => {
  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 480;
  const crop = landmarks ? getFaceCropRect(landmarks, vw, vh) : null;
  const { x, y, w, h } = crop ?? { x: 0, y: 0, w: vw, h: vh };

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, x, y, w, h, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
};
