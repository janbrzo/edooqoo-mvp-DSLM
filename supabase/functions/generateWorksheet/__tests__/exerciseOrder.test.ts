import { describe, expect, it } from "vitest";
import { getOrderedExercises } from "../prompts/exercise-order";

describe("getOrderedExercises", () => {
  const requested = ["reading", "matching", "listening-comprehension", "fill-in-blanks-picture", "true-false-audio", "discussion"];

  it("returns the requested order unchanged when no media is attached", () => {
    expect(getOrderedExercises(requested, 6, false, false)).toEqual(requested);
    expect(getOrderedExercises(requested, 6)).toEqual(requested);
  });

  it("does not mutate the input", () => {
    const copy = [...requested];
    getOrderedExercises(requested, 6, true, true);
    expect(requested).toEqual(copy);
  });

  it("orders picture, then audio, then the rest when media is attached", () => {
    expect(getOrderedExercises(requested, 6, true, true)).toEqual([
      "fill-in-blanks-picture",
      "listening-comprehension",
      "true-false-audio",
      "reading",
      "matching",
      "discussion",
    ]);
  });

  it("keeps the relative order inside each group for audio only", () => {
    expect(getOrderedExercises(["reading", "multiple-choice-audio", "matching", "true-false-audio"], 4, false, true)).toEqual([
      "multiple-choice-audio",
      "true-false-audio",
      "reading",
      "matching",
    ]);
  });

  it("slices to the exercise count before sorting", () => {
    expect(getOrderedExercises(requested, 3, false, true)).toEqual(["listening-comprehension", "reading", "matching"]);
    expect(getOrderedExercises(requested, 2)).toEqual(["reading", "matching"]);
  });
});
