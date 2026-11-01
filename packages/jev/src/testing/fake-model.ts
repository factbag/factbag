import type { Model, Subject } from "../types/model";

/**
 * A model that only judges relevance, scoring each subject with `score`. Routing tests use
 * it to state which subjects a passage bears on without scripting Jev's wire format.
 */
export function relevanceModel(score: (subject: Subject) => number): Model {
  return {
    name: "fake",
    relevance: async ({ subjects }) =>
      await Promise.resolve(subjects.map((subject) => ({ subject, relevance: score(subject) }))),
    classify: async () => await Promise.reject(new Error("relevanceModel only judges relevance")),
    adjudicate: async () => await Promise.reject(new Error("relevanceModel only judges relevance")),
  };
}
