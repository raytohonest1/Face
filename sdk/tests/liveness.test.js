import { describe, it, expect } from "vitest";
import { generateSequence, getActionMatched, getNeutralMatched } from "../src/liveness.js";

describe("generateSequence", () => {
  it("null → DEFAULT_CHALLENGES 기반 3개 랜덤 배열", () => {
    const seq = generateSequence(null);
    expect(seq).toHaveLength(3);
    expect(seq).toContain("blink");
    expect(seq).toContain("mouthOpen");
    const hasTurn = seq.includes("turnLeft") || seq.includes("turnRight");
    expect(hasTurn).toBe(true);
  });

  it("배열 그대로 반환 (순서 유지)", () => {
    expect(generateSequence(["blink", "turnLeft"])).toEqual(["blink", "turnLeft"]);
  });

  it("빈 배열 → 빈 배열", () => {
    expect(generateSequence([])).toEqual([]);
  });
});

describe("getActionMatched", () => {
  it("turnLeft: yaw <= -18 이면 true", () => {
    expect(getActionMatched("turnLeft", { yaw: -20, blink: 0, mouthOpen: 0 })).toBe(true);
    expect(getActionMatched("turnLeft", { yaw: -17, blink: 0, mouthOpen: 0 })).toBe(false);
  });

  it("turnRight: yaw >= 18 이면 true", () => {
    expect(getActionMatched("turnRight", { yaw: 20, blink: 0, mouthOpen: 0 })).toBe(true);
    expect(getActionMatched("turnRight", { yaw: 15, blink: 0, mouthOpen: 0 })).toBe(false);
  });

  it("blink: blink >= 0.48 이면 true", () => {
    expect(getActionMatched("blink", { yaw: 0, blink: 0.5, mouthOpen: 0 })).toBe(true);
    expect(getActionMatched("blink", { yaw: 0, blink: 0.4, mouthOpen: 0 })).toBe(false);
  });

  it("mouthOpen: mouthOpen >= 0.45 이면 true", () => {
    expect(getActionMatched("mouthOpen", { yaw: 0, blink: 0, mouthOpen: 0.5 })).toBe(true);
    expect(getActionMatched("mouthOpen", { yaw: 0, blink: 0, mouthOpen: 0.3 })).toBe(false);
  });
});

describe("getNeutralMatched", () => {
  it("turn: |yaw| <= 8 이면 neutral", () => {
    expect(getNeutralMatched("turnLeft", { yaw: 5, blink: 0, mouthOpen: 0 })).toBe(true);
    expect(getNeutralMatched("turnLeft", { yaw: 10, blink: 0, mouthOpen: 0 })).toBe(false);
  });

  it("blink: blink <= 0.26 이면 neutral", () => {
    expect(getNeutralMatched("blink", { yaw: 0, blink: 0.2, mouthOpen: 0 })).toBe(true);
    expect(getNeutralMatched("blink", { yaw: 0, blink: 0.3, mouthOpen: 0 })).toBe(false);
  });
});
