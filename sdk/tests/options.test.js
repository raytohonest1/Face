import { describe, it, expect } from "vitest";
import { parseOptions } from "../src/options.js";

const makeVideo = () => document.createElement("video");

describe("parseOptions", () => {
  it("video 없으면 에러를 던진다", () => {
    expect(() => parseOptions({})).toThrow("options.video is required");
  });

  it("기본값: gyroscope 비활성화, liveness 랜덤", () => {
    const opts = parseOptions({ video: makeVideo() });
    expect(opts.gyroscope.enabled).toBe(false);
    expect(opts.liveness.enabled).toBe(true);
    expect(opts.liveness.sequence).toBeNull();
  });

  it("gyroscope: false → 비활성화", () => {
    const opts = parseOptions({ video: makeVideo(), gyroscope: false });
    expect(opts.gyroscope.enabled).toBe(false);
  });

  it("gyroscope: true → 기본 minTilt 45 활성화", () => {
    const opts = parseOptions({ video: makeVideo(), gyroscope: true });
    expect(opts.gyroscope.enabled).toBe(true);
    expect(opts.gyroscope.minTilt).toBe(45);
  });

  it("gyroscope: { minTilt: 60 } → minTilt 덮어쓰기", () => {
    const opts = parseOptions({ video: makeVideo(), gyroscope: { minTilt: 60 } });
    expect(opts.gyroscope.enabled).toBe(true);
    expect(opts.gyroscope.minTilt).toBe(60);
  });

  it("liveness: false → 비활성화", () => {
    const opts = parseOptions({ video: makeVideo(), liveness: false });
    expect(opts.liveness.enabled).toBe(false);
    expect(opts.liveness.sequence).toEqual([]);
  });

  it("liveness: 'random' → sequence null (런타임 랜덤)", () => {
    const opts = parseOptions({ video: makeVideo(), liveness: "random" });
    expect(opts.liveness.enabled).toBe(true);
    expect(opts.liveness.sequence).toBeNull();
  });

  it("liveness.challenges 배열 → 순서 그대로 고정", () => {
    const opts = parseOptions({
      video: makeVideo(),
      liveness: { challenges: ["blink", "turnLeft"] },
    });
    expect(opts.liveness.sequence).toEqual(["blink", "turnLeft"]);
  });

  it("없는 콜백은 noop으로 채운다", () => {
    const opts = parseOptions({ video: makeVideo() });
    expect(typeof opts.onCapture).toBe("function");
    expect(typeof opts.onGyroChange).toBe("function");
    expect(typeof opts.onLivenessChange).toBe("function");
    expect(typeof opts.onError).toBe("function");
  });
});
