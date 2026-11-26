import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { deckDuration, slideAtTime, syncDeckTimeLock, validSlideTimes } from "./deck-timeline";

const slides = [0, 15, 30].map((start) => ({ id: String(start), start, name: "Slide", src: "" }));
const expect = (actual: unknown) => ({ toBe: (expected: unknown) => assert.equal(actual, expected) });
describe("pitch slide synchronization", () => {
  test("deck time includes the last slide instead of ending at its start", () => {
    expect(deckDuration(slides)).toBe(45);
    expect(deckDuration([slides[0]].filter((slide) => slide !== undefined))).toBe(15);
  });
  test("custom final-slide duration updates the total pitch limit", () => {
    expect(deckDuration(slides, 20)).toBe(50);
    expect(deckDuration([{ id: "a", name: "Slide", src: "", start: 0 }, { id: "b", name: "Slide", src: "", start: 2 }], 4)).toBe(6);
  });
  test("empty or invalid decks do not replace a saved pitch limit", () => {
    expect(deckDuration([])).toBe(0);
    expect(deckDuration([{ id: "a", name: "Slide", src: "", start: 3 }])).toBe(0);
  });
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
  test("removing a deck clears the countdown lock it set", () => {
    const locked = syncDeckTimeLock({ targetTime: 0, timeLocked: false }, 45);
    expect(locked.targetTime).toBe(45);
    const cleared = syncDeckTimeLock(locked, 0);
    expect(cleared.targetTime).toBe(0);
    expect(cleared.timeLocked).toBe(false);
  });
  test("no deck keeps a pitch time the speaker locked themselves", () => {
    const manual = syncDeckTimeLock({ targetTime: 90, timeLocked: true, deckLocked: false }, 0);
    expect(manual.targetTime).toBe(90);
    expect(manual.timeLocked).toBe(true);
  });
});
