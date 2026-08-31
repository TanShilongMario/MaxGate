import { describe, expect, it } from "vitest";
import { musicStepForApproach } from "./ChiptuneAudio";

describe("musicStepForApproach", () => {
  it("把一扇门的接近过程稳定切成 8 个节拍", () => {
    expect(musicStepForApproach(0)).toBe(0);
    expect(musicStepForApproach(0.124)).toBe(0);
    expect(musicStepForApproach(0.125)).toBe(1);
    expect(musicStepForApproach(0.5)).toBe(4);
    expect(musicStepForApproach(1)).toBe(7);
  });
});
