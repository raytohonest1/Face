import { describe, it, expect } from "vitest";
import { clamp, shuffle } from "../src/utils.js";

describe("clamp", () => {
  it("값을 min~max 범위로 제한한다", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });
});

describe("shuffle", () => {
  it("원본 배열을 변경하지 않는다", () => {
    const arr = [1, 2, 3];
    shuffle(arr);
    expect(arr).toEqual([1, 2, 3]);
  });

  it("동일한 요소를 가진 배열을 반환한다", () => {
    const arr = ["a", "b", "c", "d"];
    const result = shuffle(arr);
    expect(result).toHaveLength(4);
    expect(result.sort()).toEqual(["a", "b", "c", "d"]);
  });
});
