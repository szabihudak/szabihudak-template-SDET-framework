import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// npm run qa:handoff-check -- test-plans/<feature>.md [--base <ref>] [--json]
//
// Decides whether the change of a reviewed plan may be committed and handed
// off as a pull request (pr-opener, ADR-016): the review is PASS and newer
// than every changed file, and only the plan's create and extend files, the
// plan and the review report changed. It reads only; exit code 1 means the
// hand-off must stop, and every reason is printed.

// Paths that never go into a hand-off, whoever asks.
const NEVER = [
  /^\.env$/,
  /^\.env\.(?!example$)/,
  /^test-runs\//,
  /^ci-analysis\//,
];
const NEVER_DIRS = [
  /^test-results\//,
  /^playwright-report\//,
  /^blob-report\//,
];

export type Verdict = "PASS" | "CHANGES NEEDED" | "missing";

export interface PlannedFile {
  layer: string;
  path: string;
  decision: string;
  // The plan's "Golden example or template" id, or "" when the row has none.
  template: string;
}

// pr-opener may add the plan's files to config/approved-examples.json in the
// same pull request (ADR-018); any other change to it is not part of a
// hand-off.
export const EXAMPLES_FILE = "config/approved-examples.json";

interface Example {
  id: string;
  need: string;
  file: string;
}

export interface HandoffInput {
  plan: string;
  review: string;
  reviewExists: boolean;
  verdict: Verdict;
  planned: PlannedFile[];
  changed: string[];
  // Modification time in milliseconds of every changed file that exists, and
  // of the review report.
  modified: Record<string, number>;
  // The approved examples at the base and now, when EXAMPLES_FILE changed.
  examples?: { base: Example[]; current: Example[] };
}

export interface HandoffResult {
  ok: boolean;
  plan: string;
  review: string;
  verdict: Verdict;
  files: string[];
  errors: string[];
  warnings: string[];
}

const posix = (file: string) => file.split(path.sep).join("/");

export function parseVerdict(review: string): Verdict {
  const match = /^Verdict:\s*(PASS|CHANGES NEEDED)\b/m.exec(review);
  return match ? (match[1] as Verdict) : "missing";
}

// The rows of the plan's "## Files" table: Layer | Path | Decision | Template.
export function parsePlannedFiles(plan: string): PlannedFile[] {
  const lines = plan.split(/\r?\n/);
  const start = lines.findIndex((line) => /^##\s+Files\s*$/.test(line));
  if (start < 0) return [];

  const rows: PlannedFile[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^##\s/.test(line)) break;
    if (!line.trim().startsWith("|")) continue;

    const cells = line
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((cell) => cell.trim());
    if (cells.length < 3) continue;

    const file = cells[1].replace(/`/g, "").trim();
    const decision = cells[2].toLowerCase();
    if (/^-+$/.test(file) || file.toLowerCase() === "path") continue;
    if (!file || file.toLowerCase().startsWith("none")) continue;

    rows.push({
      layer: cells[0],
      path: posix(file),
      decision,
      template: (cells[3] ?? "").replace(/`/g, "").trim(),
    });
  }
  return rows;
}

export function evaluateHandoff(input: HandoffInput): HandoffResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!input.reviewExists) {
    errors.push(
      `no review report at ${input.review}: run test-reviewer for ${input.plan} first`,
    );
  } else if (input.verdict !== "PASS") {
    errors.push(
      `review verdict is ${input.verdict === "missing" ? "missing" : input.verdict} in ${input.review}; only a PASS review is handed off`,
    );
  }

  const handedOff = input.planned
    .filter(({ decision }) => /^(create|extend)\b/.test(decision))
    .map(({ path: file }) => file);
  const allowed = new Set([...handedOff, input.plan, input.review]);

  if (input.planned.length === 0) {
    errors.push(
      `${input.plan} has no Files table with create or extend rows; the hand-off cannot tell which files belong to it`,
    );
  }

  const examplesProblem = input.changed.includes(EXAMPLES_FILE)
    ? examplesChange(input.examples, handedOff)
    : undefined;
  if (examplesProblem === "") allowed.add(EXAMPLES_FILE);

  for (const file of input.changed) {
    if (file === EXAMPLES_FILE && examplesProblem) {
      errors.push(`${EXAMPLES_FILE}: ${examplesProblem}`);
    } else if (
      [...NEVER, ...NEVER_DIRS].some((pattern) => pattern.test(file))
    ) {
      errors.push(`never handed off: ${file}`);
    } else if (!allowed.has(file)) {
      errors.push(
        `not in the plan, the plan's review or its Files table: ${file}`,
      );
    }
  }

  for (const file of handedOff) {
    if (!input.changed.includes(file)) {
      warnings.push(`planned file did not change: ${file}`);
    }
  }

  const reviewTime = input.modified[input.review];
  if (input.reviewExists && reviewTime !== undefined) {
    for (const file of input.changed) {
      const time = input.modified[file];
      // The hand-off itself writes the approved examples after the review.
      if (file === input.review || file === EXAMPLES_FILE) continue;
      if (time === undefined) continue;
      if (time > reviewTime) {
        errors.push(
          `${file} changed after the review (${new Date(time).toISOString()} > ${new Date(reviewTime).toISOString()}): run test-reviewer again`,
        );
      }
    }
  }

  return {
    ok: errors.length === 0,
    plan: input.plan,
    review: input.review,
    verdict: input.verdict,
    files: input.changed.filter((file) => allowed.has(file)),
    errors,
    warnings,
  };
}

// "" when the change to the approved examples only adds entries for files
// this hand-off commits, otherwise the reason it does not.
export function examplesChange(
  examples: HandoffInput["examples"],
  handedOff: string[],
): string {
  if (!examples) return "could not be read";
  const key = (example: Example) =>
    `${example.id}\u0000${example.file}\u0000${example.need}`;
  const current = new Set(examples.current.map(key));
  if (examples.base.some((example) => !current.has(key(example)))) {
    return "an existing example was changed or removed; only new entries for this plan's files are handed off";
  }
  const before = new Set(examples.base.map(key));
  const added = examples.current.filter((example) => !before.has(key(example)));
  const foreign = added.filter((example) => !handedOff.includes(example.file));
  if (foreign.length > 0) {
    return `new examples for files outside this plan: ${foreign.map((example) => example.file).join(", ")}`;
  }
  return "";
}

function git(args: string[], cwd: string): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

function refExists(ref: string, cwd: string): boolean {
  try {
    git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], cwd);
    return true;
  } catch {
    return false;
  }
}

// The default branch on the remote, then locally; HEAD when neither exists,
// so a project that was never pushed compares its uncommitted work.
export function defaultBase(cwd: string): string {
  for (const ref of [
    "origin/HEAD",
    "origin/main",
    "origin/master",
    "main",
    "master",
  ]) {
    if (refExists(ref, cwd)) return ref;
  }
  return "HEAD";
}

export function changedFiles(base: string, cwd: string): string[] {
  const lines = (output: string) =>
    output
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  const tracked = lines(git(["diff", "--name-only", base], cwd));
  const untracked = lines(
    git(["ls-files", "--others", "--exclude-standard"], cwd),
  );
  return [...new Set([...tracked, ...untracked].map(posix))].sort();
}

function readIfExists(file: string): string | undefined {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : undefined;
}

export function checkHandoff(
  planArgument: string,
  cwd: string,
  base = defaultBase(cwd),
): HandoffResult & { base: string } {
  const plan = posix(path.relative(cwd, path.resolve(cwd, planArgument)));
  const feature = path.basename(plan, ".md");
  const review = `test-reviews/${feature}.md`;

  const planText = readIfExists(path.join(cwd, plan));
  if (planText === undefined) {
    return {
      ok: false,
      plan,
      review,
      verdict: "missing",
      files: [],
      errors: [`no plan at ${plan}`],
      warnings: [],
      base,
    };
  }
  const reviewText = readIfExists(path.join(cwd, review));
  const changed = changedFiles(base, cwd);

  const readExamples = (text: string | undefined): Example[] =>
    text ? ((JSON.parse(text) as { examples?: Example[] }).examples ?? []) : [];
  let examples: HandoffInput["examples"];
  if (changed.includes(EXAMPLES_FILE)) {
    try {
      let baseText: string | undefined;
      try {
        baseText = git(["show", `${base}:${EXAMPLES_FILE}`], cwd);
      } catch {
        baseText = undefined;
      }
      examples = {
        base: readExamples(baseText),
        current: readExamples(readIfExists(path.join(cwd, EXAMPLES_FILE))),
      };
    } catch {
      examples = undefined;
    }
  }

  const modified: Record<string, number> = {};
  for (const file of [...changed, review]) {
    const absolute = path.join(cwd, file);
    if (fs.existsSync(absolute)) modified[file] = fs.statSync(absolute).mtimeMs;
  }

  return {
    ...evaluateHandoff({
      plan,
      review,
      reviewExists: reviewText !== undefined,
      verdict: reviewText === undefined ? "missing" : parseVerdict(reviewText),
      planned: parsePlannedFiles(planText),
      changed,
      modified,
      examples,
    }),
    base,
  };
}

function main(): void {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const baseIndex = args.indexOf("--base");
  const base = baseIndex >= 0 ? args[baseIndex + 1] : undefined;
  const plan = args.find(
    (arg, index) =>
      !arg.startsWith("--") && !(baseIndex >= 0 && index === baseIndex + 1),
  );

  if (!plan || (baseIndex >= 0 && !base)) {
    console.error(
      "Usage: npm run qa:handoff-check -- test-plans/<feature>.md [--base <ref>] [--json]",
    );
    process.exit(2);
  }

  const cwd = process.cwd();
  const result = checkHandoff(plan, cwd, base ?? defaultBase(cwd));

  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(
      `Plan: ${result.plan} · Review: ${result.review} · Base: ${result.base}`,
    );
    console.log(
      `${result.verdict === "PASS" ? "✔" : "✘"} review verdict: ${result.verdict}`,
    );
    for (const error of result.errors) console.log(`✘ ${error}`);
    for (const warning of result.warnings) console.log(`! ${warning}`);
    console.log(
      result.ok
        ? `Ready to hand off: ${result.files.length} files\n${result.files.map((file) => `  ${file}`).join("\n")}`
        : "Not ready to hand off.",
    );
  }
  process.exit(result.ok ? 0 : 1);
}

if (require.main === module) main();
