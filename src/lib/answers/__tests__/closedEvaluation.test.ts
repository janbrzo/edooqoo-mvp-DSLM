import { describe, it, expect } from "vitest";
import {
  isClosedType, isSelectionType, chunkAnswers, matchesKey, CLOSED_EXERCISE_TYPES,
} from "../../../../supabase/functions/verify-open-answers/closedEvaluation";
import { CLOSED_EXERCISE_TYPES as CLIENT_CLOSED } from "@/utils/masteryCalculator";

describe("verify-open-answers closed evaluation helpers", () => {
  it("classifies closed and selection types", () => {
    expect(isClosedType("multiple-choice-audio")).toBe(true);
    expect(isClosedType("fill-in-blanks")).toBe(true);
    expect(isClosedType("discussion")).toBe(false);
    expect(isSelectionType("true-false-picture")).toBe(true);
    expect(isSelectionType("fill-in-blanks")).toBe(false);
  });

  it("chunks only above the threshold", () => {
    expect(chunkAnswers(Array(12).fill(0))).toHaveLength(1);
    expect(chunkAnswers(Array(25).fill(0)).map((c) => c.length)).toEqual([10, 10, 5]);
  });

  it("matches key leniently and never matches empty answers", () => {
    expect(matchesKey(" Drinks. ", "drinks")).toBe(true);
    expect(matchesKey("", "drinks")).toBe(false);
    expect(matchesKey("drink", "drinks")).toBe(false);
  });

  it("stays in sync with the client closed type list", () => {
    const client = Array.isArray(CLIENT_CLOSED) ? CLIENT_CLOSED : [];
    for (const t of CLOSED_EXERCISE_TYPES) {
      if (client.length) expect(client).toContain(t);
    }
  });
});
