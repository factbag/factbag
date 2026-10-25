import { describe, expect, it } from "vitest";
import { predicate } from "../dsl";
import { CandidateSearch } from "./candidate-search";

describe("CandidateSearch", () => {
  it("reports only groups whose fixed points are still being evaluated", () => {
    // Arrange
    const outer = predicate("outer", {});
    const inner = predicate("inner", {});
    const search = new CandidateSearch([]);
    const observations: boolean[] = [];

    // Act
    search.candidates(outer({}), [], () => {
      observations.push(search.evaluatingAmong([outer]), search.evaluatingAmong([inner]));
      search.candidates(inner({}), [], () => {
        observations.push(search.evaluatingAmong([outer]), search.evaluatingAmong([inner]));
        return [];
      });
      observations.push(search.evaluatingAmong([outer]), search.evaluatingAmong([inner]));
      return [];
    });
    observations.push(search.evaluatingAmong([outer, inner]));

    // Assert
    expect(observations).toEqual([true, false, true, true, true, false, false]);
  });

  it("clears evaluating state when derivation throws", () => {
    // Arrange
    const failed = predicate("failed", {});
    const search = new CandidateSearch([]);
    const error = new Error("derivation failed");

    // Act
    const derive = () =>
      search.candidates(failed({}), [], () => {
        throw error;
      });

    // Assert
    expect(derive).toThrow(error);
    expect(search.evaluatingAmong([failed])).toBe(false);
  });
});
