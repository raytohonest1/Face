import { describe, it, expect } from "vitest";
import { computeGyroState } from "../src/gyroscope.js";

describe("computeGyroState", () => {
  it("beta null → angle null, isReady false, status unavailable", () => {
    const s = computeGyroState(null, 45);
    expect(s.angle).toBeNull();
    expect(s.isReady).toBe(false);
    expect(s.status).toBe("unavailable");
  });

  it("beta 87 (세워짐) → isReady true, status upright", () => {
    const s = computeGyroState(87, 45);
    expect(s.angle).toBe(87);
    expect(s.isReady).toBe(true);
    expect(s.status).toBe("upright");
  });

  it("beta -87 (뒤집어 세워짐) → angle 87, isReady true", () => {
    const s = computeGyroState(-87, 45);
    expect(s.angle).toBe(87);
    expect(s.isReady).toBe(true);
  });

  it("beta 20 (눕혀짐) → isReady false, status flat", () => {
    const s = computeGyroState(20, 45);
    expect(s.angle).toBe(20);
    expect(s.isReady).toBe(false);
    expect(s.status).toBe("flat");
  });

  it("beta 정확히 minTilt → isReady true", () => {
    const s = computeGyroState(45, 45);
    expect(s.isReady).toBe(true);
  });
});
