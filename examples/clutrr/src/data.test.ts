import { expect, test } from "vitest";
import { parseCsv, parseStories, proofLeaves } from "./data";

test("reads quoted fields with commas, quotes and line breaks", () => {
  expect(parseCsv('a,"b,c","d""e"\n1,"two\nlines",3\n')).toEqual([
    ["a", "b,c", 'd"e'],
    ["1", "two\nlines", "3"],
  ]);
});

test("reads a story row the way the generator writes it", () => {
  const csv =
    ",id,story,query,text_query,target,text_target,clean_story,proof_state,f_comb,task_name,story_edges,edge_types,query_edge,genders,syn_story,node_mapping,task_split\n" +
    "0,abc,\"[Kristin] and her son [Justin] went to visit her mother [Carol].\",\"('Justin', 'Carol')\",,grandmother,,,\"[{('Justin', 'grandmother', 'Carol'): [('Justin', 'mother', 'Kristin'), ('Kristin', 'mother', 'Carol')]}]\",mother-mother,task_1.2,\"[(0, 1), (1, 2)]\",\"['mother', 'mother']\",\"(0, 2)\",\"Justin:male,Kristin:female,Carol:female\",,\"{7: 0, 2: 1, 3: 2}\",train\n";
  const [story] = parseStories("1.2_train.csv", csv);
  expect(story).toEqual({
    id: "abc",
    file: "1.2_train.csv",
    text: "Kristin and her son Justin went to visit her mother Carol.",
    query: ["Justin", "Carol"],
    target: "grandmother",
    task: "task_1.2",
    length: 2,
    genders: { Justin: "male", Kristin: "female", Carol: "female" },
    edges: [
      ["Justin", "mother", "Kristin"],
      ["Kristin", "mother", "Carol"],
    ],
  });
});

test("a proof of several steps keeps only the facts that are not themselves derived", () => {
  const proof =
    "[{('Alan', 'nephew', 'Anthony'): [('Alan', 'sibling', 'James'), ('James', 'son', 'Anthony')]}, " +
    "{('Alan', 'sibling', 'James'): [('Alan', 'daughter', 'Annie'), ('Annie', 'uncle', 'James')]}]";
  expect(proofLeaves(proof)).toEqual([
    ["James", "son", "Anthony"],
    ["Alan", "daughter", "Annie"],
    ["Annie", "uncle", "James"],
  ]);
});
