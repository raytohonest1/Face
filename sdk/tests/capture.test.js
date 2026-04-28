import { describe, it, expect, vi } from "vitest";
import { captureFrame } from "../src/capture.js";

describe("captureFrame", () => {
  it("base64 data URL을 반환한다", () => {
    const video = document.createElement("video");
    Object.defineProperty(video, "videoWidth", { value: 640 });
    Object.defineProperty(video, "videoHeight", { value: 480 });

    const mockCtx = { drawImage: vi.fn() };
    const mockCanvas = {
      getContext: vi.fn(() => mockCtx),
      toDataURL: vi.fn(() => "data:image/jpeg;base64,mockdata"),
      width: 0,
      height: 0,
    };
    vi.spyOn(document, "createElement").mockReturnValueOnce(mockCanvas);

    const result = captureFrame(video, null);
    expect(result).toBe("data:image/jpeg;base64,mockdata");
    expect(mockCtx.drawImage).toHaveBeenCalledWith(video, 0, 0, 640, 480, 0, 0, 640, 480);
  });
});
