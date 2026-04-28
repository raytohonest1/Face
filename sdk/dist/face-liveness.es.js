var et = (t) => {
  throw TypeError(t);
};
var K = (t, e, n) => e.has(t) || et("Cannot " + n);
var s = (t, e, n) => (K(t, e, "read from private field"), n ? n.call(t) : e.get(t)), c = (t, e, n) => e.has(t) ? et("Cannot add the same private member more than once") : e instanceof WeakSet ? e.add(t) : e.set(t, n), o = (t, e, n, i) => (K(t, e, "write to private field"), i ? i.call(t, n) : e.set(t, n), n), l = (t, e, n) => (K(t, e, "access private method"), n);
import { FilesetResolver as lt, FaceLandmarker as ut } from "@mediapipe/tasks-vision";
const dt = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm", mt = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task", ft = 90, it = 180 / Math.PI, pt = 900, gt = 5500, Mt = 18e3, yt = 800, st = 18, St = 8, xt = 0.48, Et = 0.26, vt = 0.45, At = 0.24, $ = 45, X = () => {
}, Lt = (t) => !t || t === !1 ? { enabled: !1, minTilt: $ } : t === !0 ? { enabled: !0, minTilt: $ } : { enabled: t.enabled !== !1, minTilt: t.minTilt ?? $ }, Ot = (t) => t === void 0 || t === "random" ? { enabled: !0, sequence: null } : !t || t === !1 ? { enabled: !1, sequence: [] } : Array.isArray(t.challenges) ? { enabled: !0, sequence: t.challenges } : t.challenges === "random" ? { enabled: !0, sequence: null } : { enabled: !0, sequence: null }, Tt = (t) => {
  if (!t.video) throw new Error("options.video is required");
  return {
    video: t.video,
    wasmPath: t.wasmPath ?? null,
    modelUrl: t.modelUrl ?? null,
    gyroscope: Lt(t.gyroscope),
    liveness: Ot(t.liveness),
    onCapture: t.onCapture ?? X,
    onGyroChange: t.onGyroChange ?? X,
    onLivenessChange: t.onLivenessChange ?? X,
    onError: t.onError ?? X
  };
};
var S, v, W, at;
class _t {
  constructor(e) {
    c(this, W);
    c(this, S);
    c(this, v, null);
    o(this, S, e);
  }
  async start() {
    var e;
    if (!window.isSecureContext)
      throw new Error("카메라는 HTTPS 또는 localhost에서만 사용 가능합니다.");
    if (!((e = navigator.mediaDevices) != null && e.getUserMedia))
      throw new Error("이 브라우저는 카메라 접근을 지원하지 않습니다.");
    o(this, v, await navigator.mediaDevices.getUserMedia({
      audio: !1,
      video: { facingMode: { ideal: "user" }, width: { ideal: 1280 }, height: { ideal: 720 } }
    })), s(this, S).srcObject = s(this, v), await l(this, W, at).call(this), await s(this, S).play();
  }
  stop() {
    s(this, S).pause(), s(this, S).srcObject = null, s(this, v) && (s(this, v).getTracks().forEach((e) => e.stop()), o(this, v, null));
  }
  get video() {
    return s(this, S);
  }
}
S = new WeakMap(), v = new WeakMap(), W = new WeakSet(), at = function() {
  return s(this, S).readyState >= HTMLMediaElement.HAVE_METADATA ? Promise.resolve() : new Promise((e) => {
    s(this, S).addEventListener("loadedmetadata", e, { once: !0 });
  });
};
const F = (t, e, n) => Math.min(Math.max(t, e), n), bt = (t) => {
  const e = [...t];
  for (let n = e.length - 1; n > 0; n--) {
    const i = Math.floor(Math.random() * (n + 1));
    [e[n], e[i]] = [e[i], e[n]];
  }
  return e;
}, R = (t) => Number.isFinite(t == null ? void 0 : t.x) && Number.isFinite(t == null ? void 0 : t.y), P = (t, e) => {
  const n = e.map((i) => t[i]).filter(R);
  return n.length ? {
    x: n.reduce((i, r) => i + r.x, 0) / n.length,
    y: n.reduce((i, r) => i + r.y, 0) / n.length
  } : null;
}, Ft = (t) => {
  const e = (t == null ? void 0 : t.data) ?? t;
  if (!e || e.length < 16) return null;
  const n = Math.atan2(e[2], e[10]) * it;
  return Number.isFinite(n) ? F(n, -75, 75) : null;
}, Ct = (t) => {
  const e = P(t, [33, 133]), n = P(t, [362, 263]), i = t[1], r = P(t, [13, 14, 61, 291]);
  if (!e || !n || !R(i)) return 0;
  const u = (e.x + n.x) / 2 - (r ? i.x * 0.72 + r.x * 0.28 : i.x);
  return Math.abs(u) < 6e-3 ? 0 : u > 0 ? 1 : -1;
}, Pt = (t) => {
  const e = P(t, [33, 133]), n = P(t, [362, 263]), i = t[1], r = P(t, [13, 14, 61, 291]);
  if (!e || !n || !R(i)) return null;
  const u = Math.abs(e.x - n.x);
  if (u < 0.02) return null;
  const p = r ? i.x * 0.72 + r.x * 0.28 : i.x, g = F(((e.x + n.x) / 2 - p) / (u * 0.62), -1, 1);
  return F(Math.asin(g) * it, -60, 60);
};
var w, k, E, q, D;
class Nt {
  constructor({ wasmPath: e, modelUrl: n } = {}) {
    c(this, w);
    c(this, k);
    c(this, E, null);
    c(this, q, null);
    c(this, D, 0);
    o(this, w, e ?? dt), o(this, k, n ?? mt);
  }
  get lastLandmarks() {
    return s(this, q);
  }
  async load() {
    const e = await lt.forVisionTasks(s(this, w)), n = (i) => ut.createFromOptions(e, {
      baseOptions: { modelAssetPath: s(this, k), delegate: i },
      runningMode: "VIDEO",
      numFaces: 2,
      minFaceDetectionConfidence: 0.55,
      minFacePresenceConfidence: 0.55,
      minTrackingConfidence: 0.55,
      outputFaceBlendshapes: !0,
      outputFacialTransformationMatrixes: !0
    });
    try {
      o(this, E, await n("GPU"));
    } catch {
      o(this, E, await n("CPU"));
    }
  }
  detect(e, n) {
    if (!s(this, E) || e.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || n - s(this, D) < ft) return null;
    const i = s(this, E).detectForVideo(e, n);
    o(this, D, n);
    const r = i.faceLandmarks ?? [], u = r.map((g, d) => {
      var m;
      const f = Ft((m = i.facialTransformationMatrixes) == null ? void 0 : m[d]);
      if (Number.isFinite(f)) {
        const y = Ct(g) || -Math.sign(f) || 0;
        return F(Math.abs(f) * y, -75, 75);
      }
      return Pt(g);
    }), p = r.reduce((g, d, f) => {
      const m = d.filter(R).map((C) => C.x), y = d.filter(R).map((C) => C.y), j = (Math.max(...m) - Math.min(...m)) * (Math.max(...y) - Math.min(...y));
      return j > (g.area ?? 0) ? { i: f, area: j } : g;
    }, {}).i ?? -1;
    return o(this, q, p >= 0 ? r[p] : null), { result: i, faces: r, yawMeasurements: u, primaryIndex: p };
  }
  dispose() {
    var e, n;
    (n = (e = s(this, E)) == null ? void 0 : e.close) == null || n.call(e), o(this, E, null);
  }
}
w = new WeakMap(), k = new WeakMap(), E = new WeakMap(), q = new WeakMap(), D = new WeakMap();
const It = (t) => {
  if (!t) {
    const e = Math.random() > 0.5 ? "turnLeft" : "turnRight";
    return bt([e, "blink", "mouthOpen"]);
  }
  return t;
}, Rt = (t, e) => t === "turnLeft" ? e.yaw <= -st : t === "turnRight" ? e.yaw >= st : t === "blink" ? e.blink >= xt : t === "mouthOpen" ? e.mouthOpen >= vt : !1, wt = (t, e) => t === "turnLeft" || t === "turnRight" ? Math.abs(e.yaw) <= St : t === "blink" ? e.blink <= Et : t === "mouthOpen" ? e.mouthOpen <= At : !1, nt = { blink: 80, mouthOpen: 180, default: 160 }, kt = (t) => nt[t] ?? nt.default, z = () => ({
  phase: "idle",
  sequence: [],
  stepIndex: 0,
  stepPhase: "action",
  startedAt: 0,
  stepStartedAt: 0,
  holdStartedAt: 0,
  qualityStartedAt: 0,
  progress: 0,
  faceLostSince: 0
});
var N, a, U, h, rt, ot, ht, ct, Z, Q, x;
class qt {
  constructor(e, n = () => {
  }) {
    c(this, h);
    c(this, N);
    c(this, a, z());
    c(this, U);
    o(this, N, e), o(this, U, n);
  }
  get phase() {
    return s(this, a).phase;
  }
  get progress() {
    return s(this, a).progress;
  }
  start(e = performance.now()) {
    if (!s(this, N).enabled) {
      o(this, a, { ...z(), phase: "passed" }), l(this, h, x).call(this);
      return;
    }
    o(this, a, {
      ...z(),
      phase: "quality",
      sequence: It(s(this, N).sequence),
      startedAt: e
    }), l(this, h, x).call(this);
  }
  update(e, n, i = performance.now()) {
    if (["quality", "challenge"].includes(s(this, a).phase)) {
      if (!n) {
        if (s(this, a).phase === "challenge") {
          if (s(this, a).faceLostSince || (s(this, a).faceLostSince = i), i - s(this, a).faceLostSince >= yt) {
            l(this, h, Q).call(this, "얼굴을 카메라 안에 유지해주세요.", i);
            return;
          }
        } else
          s(this, a).qualityStartedAt = 0, s(this, a).progress = 0;
        l(this, h, x).call(this);
        return;
      }
      s(this, a).faceLostSince = 0, s(this, a).phase === "quality" ? l(this, h, rt).call(this, i) : l(this, h, ht).call(this, e, i);
    }
  }
}
N = new WeakMap(), a = new WeakMap(), U = new WeakMap(), h = new WeakSet(), rt = function(e) {
  if (s(this, a).qualityStartedAt || (s(this, a).qualityStartedAt = e), s(this, a).progress = F((e - s(this, a).qualityStartedAt) / pt, 0, 1), s(this, a).progress >= 1) {
    l(this, h, ot).call(this, e);
    return;
  }
  l(this, h, x).call(this);
}, ot = function(e) {
  s(this, a).phase = "challenge", s(this, a).stepIndex = 0, s(this, a).stepPhase = "action", s(this, a).startedAt = e, s(this, a).stepStartedAt = e, s(this, a).holdStartedAt = 0, l(this, h, x).call(this);
}, ht = function(e, n) {
  const i = s(this, a).sequence[s(this, a).stepIndex];
  if (!i) {
    l(this, h, Z).call(this);
    return;
  }
  if (n - s(this, a).startedAt > Mt) {
    l(this, h, Q).call(this, "제한 시간이 초과되었습니다.", n);
    return;
  }
  if (n - s(this, a).stepStartedAt > gt) {
    l(this, h, Q).call(this, "현재 동작 시간이 초과되었습니다.", n);
    return;
  }
  if (!(s(this, a).stepPhase === "action" ? Rt(i, e) : wt(i, e)))
    s(this, a).holdStartedAt = 0;
  else {
    s(this, a).holdStartedAt || (s(this, a).holdStartedAt = n);
    const u = s(this, a).stepPhase === "action" ? kt(i) : 160;
    if (n - s(this, a).holdStartedAt >= u)
      if (s(this, a).stepPhase === "action")
        s(this, a).stepPhase = "neutral", s(this, a).holdStartedAt = 0;
      else {
        l(this, h, ct).call(this, n);
        return;
      }
  }
  l(this, h, x).call(this);
}, ct = function(e) {
  if (s(this, a).stepIndex += 1, s(this, a).stepIndex >= s(this, a).sequence.length) {
    l(this, h, Z).call(this);
    return;
  }
  s(this, a).stepPhase = "action", s(this, a).stepStartedAt = e, s(this, a).holdStartedAt = 0, l(this, h, x).call(this);
}, Z = function() {
  s(this, a).phase = "passed", s(this, a).progress = 1, l(this, h, x).call(this);
}, Q = function(e, n) {
  s(this, a).phase = "failed", l(this, h, x).call(this, e);
}, x = function(e) {
  s(this, U).call(this, {
    phase: s(this, a).phase,
    step: s(this, a).sequence[s(this, a).stepIndex] ?? null,
    stepPhase: s(this, a).stepPhase,
    stepIndex: s(this, a).stepIndex,
    totalSteps: s(this, a).sequence.length,
    progress: s(this, a).progress,
    reason: e ?? null
  });
};
const Dt = (t, e) => {
  if (!Number.isFinite(t))
    return { angle: null, isReady: !1, status: "unavailable" };
  const n = Math.round(Math.abs(t)), i = n >= e;
  return { angle: n, isReady: i, status: i ? "upright" : "flat" };
};
var O, V, B, A;
class Ut {
  constructor(e) {
    c(this, O);
    c(this, V, null);
    c(this, B, !1);
    c(this, A, null);
    o(this, O, e);
  }
  get currentAngle() {
    return s(this, V);
  }
  get isReady() {
    return !s(this, O).enabled || s(this, B);
  }
  async init(e) {
    if (!s(this, O).enabled || !window.DeviceOrientationEvent) return;
    const n = () => {
      o(this, A, (i) => {
        const r = Dt(i.beta, s(this, O).minTilt);
        o(this, V, r.angle), o(this, B, r.isReady), e(r);
      }), window.addEventListener("deviceorientation", s(this, A));
    };
    if (typeof DeviceOrientationEvent.requestPermission == "function") {
      try {
        await DeviceOrientationEvent.requestPermission() === "granted" && n();
      } catch {
      }
      return;
    }
    n();
  }
  dispose() {
    s(this, A) && (window.removeEventListener("deviceorientation", s(this, A)), o(this, A, null));
  }
}
O = new WeakMap(), V = new WeakMap(), B = new WeakMap(), A = new WeakMap();
const Vt = (t) => Number.isFinite(t == null ? void 0 : t.x) && Number.isFinite(t == null ? void 0 : t.y), Bt = (t, e, n) => {
  const i = t.filter(Vt);
  if (!i.length) return null;
  const r = i.map((y) => y.x * e), u = i.map((y) => y.y * n), p = Math.min(...r), g = Math.max(...r), d = Math.min(...u), f = Math.max(...u), m = Math.max(20, (g - p) * 0.28);
  return {
    x: Math.max(0, p - m),
    y: Math.max(0, d - m),
    w: Math.min(e, g - p + m * 2),
    h: Math.min(n, f - d + m * 2)
  };
}, Gt = (t, e, n = 0.92) => {
  const i = t.videoWidth || 640, r = t.videoHeight || 480, u = e ? Bt(e, i, r) : null, { x: p, y: g, w: d, h: f } = u ?? { x: 0, y: 0, w: i, h: r }, m = document.createElement("canvas");
  return m.width = d, m.height = f, m.getContext("2d").drawImage(t, p, g, d, f, 0, 0, d, f), m.toDataURL("image/jpeg", n);
}, Ht = (t) => Number.isFinite(t == null ? void 0 : t.x) && Number.isFinite(t == null ? void 0 : t.y), Yt = (t) => {
  const e = t.filter(Ht);
  if (!e.length) return null;
  const n = e.map((r) => r.x), i = e.map((r) => r.y);
  return {
    centerX: (Math.min(...n) + Math.max(...n)) / 2,
    centerY: (Math.min(...i) + Math.max(...i)) / 2,
    area: (Math.max(...n) - Math.min(...n)) * (Math.max(...i) - Math.min(...i))
  };
}, jt = (t, e, n, i) => {
  if (!t.length || t.length > 1 || e < 0 || !n) return !1;
  const r = Yt(n);
  return !(!r || r.area < 0.045 || r.area > 0.48 || r.centerX < 0.3 || r.centerX > 0.7 || r.centerY < 0.25 || r.centerY > 0.78 || Number.isFinite(i) && Math.abs(i) > 15);
}, J = (t, e) => {
  const n = (t == null ? void 0 : t.categories) ?? [];
  for (const i of e) {
    const r = n.find((u) => u.categoryName === i || u.displayName === i);
    if (Number.isFinite(r == null ? void 0 : r.score)) return r.score;
  }
  return null;
}, Xt = (t, e, n) => {
  const i = J(n, ["eyeBlinkLeft"]) ?? 0, r = J(n, ["eyeBlinkRight"]) ?? 0, u = J(n, ["jawOpen", "mouthOpen"]) ?? 0;
  return {
    yaw: Number.isFinite(e) ? e : 0,
    blink: F(Math.min(i, r), 0, 1),
    mouthOpen: F(u, 0, 1)
  };
};
var M, T, L, _, b, I, G, H, Y, tt;
class Kt {
  constructor(e) {
    c(this, Y);
    c(this, M);
    c(this, T);
    c(this, L);
    c(this, _);
    c(this, b);
    c(this, I, !1);
    c(this, G, 0);
    c(this, H, -1);
    o(this, M, Tt(e)), o(this, T, new _t(s(this, M).video)), o(this, L, new Nt({
      wasmPath: s(this, M).wasmPath,
      modelUrl: s(this, M).modelUrl
    })), o(this, _, new qt(
      s(this, M).liveness,
      s(this, M).onLivenessChange
    )), o(this, b, new Ut(s(this, M).gyroscope));
  }
  async start() {
    try {
      await s(this, T).start(), await s(this, L).load(), await s(this, b).init(s(this, M).onGyroChange), s(this, _).start(), o(this, I, !0), l(this, Y, tt).call(this);
    } catch (e) {
      s(this, M).onError(e);
    }
  }
  stop() {
    o(this, I, !1), cancelAnimationFrame(s(this, G)), s(this, T).stop(), s(this, L).dispose(), s(this, b).dispose();
  }
  capture() {
    const e = Gt(s(this, M).video, s(this, L).lastLandmarks);
    s(this, M).onCapture({
      image: e,
      liveness: s(this, _).phase,
      tilt: s(this, b).currentAngle
    });
  }
}
M = new WeakMap(), T = new WeakMap(), L = new WeakMap(), _ = new WeakMap(), b = new WeakMap(), I = new WeakMap(), G = new WeakMap(), H = new WeakMap(), Y = new WeakSet(), tt = function() {
  var i;
  if (!s(this, I)) return;
  const e = performance.now(), n = s(this, T).video;
  if (n.currentTime !== s(this, H)) {
    const r = s(this, L).detect(n, e);
    if (r) {
      o(this, H, n.currentTime);
      const { result: u, faces: p, yawMeasurements: g, primaryIndex: d } = r, f = d >= 0 ? p[d] : null, m = d >= 0 ? g[d] : null, y = jt(p, d, f, m), j = d >= 0 ? (i = u.faceBlendshapes) == null ? void 0 : i[d] : null, C = f ? Xt(f, m, j) : null;
      C && s(this, _).update(C, y, e);
    }
  }
  o(this, G, requestAnimationFrame(() => l(this, Y, tt).call(this)));
};
export {
  Kt as FaceLiveness
};
