/**
 * CLUTRR (Sinha, Sodhani, Dong, Pineau and Hamilton, 2019; CC BY-NC 4.0). The data is not
 * vendored: pass the directory of one pre-generated configuration with --data, or set
 * FACTBAG_DATA_DIR so it is found at $FACTBAG_DATA_DIR/clutrr/<configuration>. The
 * directory holds the generator's CSV files, one per split, named by the clause lengths
 * they cover: `1.2,1.3_train.csv`, `1.2_test.csv`, `1.10_test.csv` and so on.
 *
 * Only the story, the queried pair and the gold label are read for prediction. The
 * generator's own account of the story (its proof, from the `proof_state` column, and its
 * genders) is read for the clause length, which reports accuracy by reasoning length, and
 * kept for diagnosis; it is never given to either system.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type Split = "train" | "test";

/** The configuration the evaluation uses: train on clause lengths 2 and 3, test on 2 to 10. */
export const CONFIGURATION = "data_089907f8";

/** An edge of the generator's proof: `to` is `from`'s `label`, in the generator's gendered words. */
export type Edge = readonly [from: string, label: string, to: string];

export type Story = Readonly<{
  id: string;
  /** The file the story came from, such as "1.2_test.csv". */
  file: string;
  /** The story text, with the generator's brackets around names removed. */
  text: string;
  /** The queried pair as the data gives it: the label says how `second` is related to `first`. */
  query: readonly [first: string, second: string];
  /** The gold label, such as "grandmother": `second` is `first`'s grandmother. */
  target: string;
  /** The generator's task name, such as "task_1.3": noise type, then clause length. */
  task: string;
  /** The number of supporting facts the story was generated from. */
  length: number;
  /** The generator's record of each person's gender, kept for diagnosis only. */
  genders: Readonly<Record<string, string>>;
  /** The supporting facts of the generator's proof, in its words, for diagnosis only. */
  edges: readonly Edge[];
}>;

/** $FACTBAG_DATA_DIR/clutrr/<configuration>, when the variable is set. */
export function defaultDataDir(configuration = CONFIGURATION): string | undefined {
  const root = process.env["FACTBAG_DATA_DIR"];
  return root === undefined || root === "" ? undefined : join(root, "clutrr", configuration);
}

/** Whether a data directory holds the split's files. */
export function hasSplit(dir: string | undefined, split: Split): boolean {
  return (
    dir !== undefined &&
    existsSync(dir) &&
    readdirSync(dir).some((name) => name.endsWith(`_${split}.csv`))
  );
}

/** Every story of a split, in file order, files sorted by the clause length in their name. */
export function loadStories(dir: string, split: Split): readonly Story[] {
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(`_${split}.csv`))
    .sort((a, b) => lengthOfFile(a) - lengthOfFile(b) || a.localeCompare(b));
  if (files.length === 0) {
    throw new Error(`No *_${split}.csv under ${dir}`);
  }
  return files.flatMap((file) => parseStories(file, readFileSync(join(dir, file), "utf8")));
}

/** The last clause length a file's name covers: "1.2,1.3_train.csv" is 3. */
function lengthOfFile(file: string): number {
  const lengths = [...file.matchAll(/\d+\.(\d+)/gu)].map((match) => Number(match[1]));
  return Math.max(...lengths, 0);
}

/** The stories of one CSV file. */
export function parseStories(file: string, csv: string): readonly Story[] {
  const rows = parseCsv(csv);
  const [header, ...body] = rows;
  if (header === undefined) {
    throw new Error(`${file}: empty`);
  }
  const column = (name: string): number => {
    const index = header.indexOf(name);
    if (index < 0) {
      throw new Error(`${file}: no column ${name}`);
    }
    return index;
  };
  const columns = {
    id: column("id"),
    story: column("story"),
    query: column("query"),
    target: column("target"),
    task: column("task_name"),
    genders: column("genders"),
    proof: column("proof_state"),
  };
  return body
    .filter((row) => row.length > 1)
    .map((row) => {
      const at = (index: number): string => row[index] ?? "";
      const task = at(columns.task);
      const length = Number(/^task_\d+\.(\d+)$/u.exec(task)?.[1]);
      if (!Number.isInteger(length)) {
        throw new Error(`${file}: cannot read the clause length of ${task}`);
      }
      return {
        id: at(columns.id),
        file,
        text: at(columns.story)
          .replaceAll(/\[([^\]]*)\]/gu, "$1")
          .trim(),
        query: parseQuery(file, at(columns.query)),
        target: at(columns.target).trim(),
        task,
        length,
        genders: Object.fromEntries(
          at(columns.genders)
            .split(",")
            .map((entry) => entry.split(":"))
            .filter((pair): pair is [string, string] => pair.length === 2)
            .map(([name, gender]) => [name.trim(), gender.trim()]),
        ),
        edges: proofLeaves(at(columns.proof)),
      };
    });
}

/** "('Carol', 'Justin')" as the two names. */
function parseQuery(file: string, text: string): readonly [string, string] {
  const names = pythonStrings(text);
  const [first, second] = names;
  if (names.length !== 2 || first === undefined || second === undefined) {
    throw new Error(`${file}: cannot read the query ${text}`);
  }
  return [first, second];
}

/** The quoted strings in a Python literal, in order. */
function pythonStrings(text: string): readonly string[] {
  return [...text.matchAll(/'([^']*)'/gu)].map((match) => match[1] ?? "");
}

const TRIPLE = /\('([^']*)',\s*'([^']*)',\s*'([^']*)'\)/gu;
const DERIVED = /\('([^']*)',\s*'([^']*)',\s*'([^']*)'\):/gu;

/**
 * The supporting facts of a proof such as
 * `[{('Donald', 'aunt', 'Dorothy'): [('Donald', 'father', 'Michael'), ('Michael', 'sister',
 * 'Dorothy')]}]`: every triple that is not itself derived in the proof, in order.
 */
export function proofLeaves(text: string): readonly Edge[] {
  const derived = new Set(
    [...text.matchAll(DERIVED)].map((match) => `${match[1]}|${match[2]}|${match[3]}`),
  );
  const leaves: Edge[] = [];
  for (const match of text.matchAll(TRIPLE)) {
    const [, from = "", label = "", to = ""] = match;
    if (!derived.has(`${from}|${label}|${to}`)) {
      leaves.push([from, label, to]);
    }
  }
  return leaves;
}

/**
 * RFC 4180 rows: fields separated by commas, quoted with double quotes when they hold a
 * comma, a quote or a line break, a quote doubled inside a quoted field.
 */
export function parseCsv(text: string): readonly (readonly string[])[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") {
        index += 1;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
