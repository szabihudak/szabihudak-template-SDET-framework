import fs from "node:fs";
import path from "node:path";

import {
  changedFiles,
  defaultBase,
  hashFile,
  parseVerdict,
  stampReview,
  stampedFiles,
} from "./handoff";

// npm run qa:review-stamp -- test-plans/<feature>.md [--base <ref>] [--json]
//
// Writes the "Reviewed files" section at the end of test-reviews/<feature>.md
// (ADR-016): the SHA-256 of every file of the change the reviewer saw, the
// plan included. test-reviewer runs it as the last step of a review;
// qa:handoff-check then stops when any of those files has other content, so a
// change made after the review is caught even when a checkout or a copy keeps
// its modification time. Running it again replaces the section.

export function stampFor(
  planArgument: string,
  cwd: string,
  base: string,
): {
  plan: string;
  review: string;
  base: string;
  verdict: string;
  hashes: Record<string, string>;
  errors: string[];
} {
  const plan = path
    .relative(cwd, path.resolve(cwd, planArgument))
    .split(path.sep)
    .join("/");
  const review = `test-reviews/${path.basename(plan, ".md")}.md`;
  const reviewFile = path.join(cwd, review);
  const errors: string[] = [];
  if (!fs.existsSync(path.join(cwd, plan))) errors.push(`no plan at ${plan}`);
  if (!fs.existsSync(reviewFile)) {
    errors.push(`no review report at ${review}: write it first`);
  }
  if (errors.length > 0) {
    return { plan, review, base, verdict: "missing", hashes: {}, errors };
  }

  const hashes: Record<string, string> = {};
  for (const file of stampedFiles(changedFiles(base, cwd), review)) {
    hashes[file] = hashFile(path.join(cwd, file));
  }
  return {
    plan,
    review,
    base,
    verdict: parseVerdict(fs.readFileSync(reviewFile, "utf8")),
    hashes,
    errors,
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
      "Usage: npm run qa:review-stamp -- test-plans/<feature>.md [--base <ref>] [--json]",
    );
    process.exit(2);
  }

  const cwd = process.cwd();
  const result = stampFor(plan, cwd, base ?? defaultBase(cwd));
  if (result.errors.length === 0) {
    const file = path.join(cwd, result.review);
    fs.writeFileSync(
      file,
      stampReview(fs.readFileSync(file, "utf8"), result.hashes),
    );
  }

  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    for (const error of result.errors) console.log(`✘ ${error}`);
    if (result.errors.length === 0) {
      console.log(
        `Stamped ${Object.keys(result.hashes).length} file(s) in ${result.review} (base ${result.base}, verdict ${result.verdict}).`,
      );
    }
  }
  process.exit(result.errors.length === 0 ? 0 : 1);
}

if (require.main === module) main();
