import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { slideAtTime, validSlideTimes } from "./deck-timeline";

const slides = [0, 15, 30].map((start) => ({ id: String(start), start, name: "Slide", src: "" }));
const expect = (actual: unknown) => ({ toBe: (expected: unknown) => assert.equal(actual, expected) });
describe("pitch slide synchronization", () => {
  test("changes exactly at the chosen pitch time", () => {
    expect(slideAtTime(slides, 14.9)).toBe(0);
    expect(slideAtTime(slides, 15)).toBe(1);
    expect(slideAtTime(slides, 30)).toBe(2);
    expect(slideAtTime(slides, 90)).toBe(2);
  });
  test("rewinding the pitch returns to the first slide", () => {
    expect(slideAtTime(slides, 31)).toBe(2);
    expect(slideAtTime(slides, 0)).toBe(0);
  });
  test("requires a zero start and strictly increasing cue times", () => {
    expect(validSlideTimes(slides)).toBe(true);
    expect(validSlideTimes([{ id: "a", name: "Slide", src: "", start: 1 }])).toBe(false);
    expect(validSlideTimes([0, 0].map((start) => ({ id: String(start), name: "Slide", src: "", start })))).toBe(false);
  });
});