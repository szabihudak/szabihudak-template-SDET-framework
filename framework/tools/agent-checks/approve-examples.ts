import fs from "node:fs";
import path from "node:path";

import {
  EXAMPLES_FILE,
  parsePlannedFiles,
  parseVerdict,
  type PlannedFile,
} from "./handoff";

// npm run qa:approve-examples -- test-plans/<feature>.md [--only <id,...>] [--write] [--json]
//
// Proposes the files a reviewed plan created as this project's golden
// examples in config/approved-examples.json (ADR-018): one per template id,
// only from create rows whose template id is in framework/templates/index.json,
// never replacing an example the project already has. With --write it adds the
// proposed entries (or those named by --only); without it, it changes nothing.
// pr-opener asks the user before writing, so the entries go into the same pull
// request, and its CI run, as the files they name.

const INDEX_FILE = "framework/templates/index.json";

export interface ApprovedExample {
  id: string;
  need: string;
  file: string;
}

export interface ExamplesFile {
  $comment?: string;
  examples: ApprovedExample[];
}

export interface Proposal extends ApprovedExample {
  layer: string;
}

export interface Skipped {
  id: string;
  file: string;
  reason: string;
}

export interface ExampleProposals {
  plan: string;
  review: string;
  verdict: string;
  proposals: Proposal[];
  skipped: Skipped[];
  errors: string[];
}

// "# Login test plan" → "Login".
export function featureTitle(plan: string, fallback: string): string {
  const heading = /^#\s+(.+?)\s+test plan\s*$/im.exec(plan);
  return heading ? heading[1].trim() : fallback;
}

export function proposeExamples(input: {
  plan: string;
  review: string;
  verdict: string;
  title: string;
  planned: PlannedFile[];
  templateIds: string[];
  existing: ApprovedExample[];
  exists: (file: string) => boolean;
}): ExampleProposals {
  const proposals: Proposal[] = [];
  const skipped: Skipped[] = [];
  const errors: string[] = [];

  if (input.verdict !== "PASS") {
    errors.push(
      `review verdict is ${input.verdict} in ${input.review}; only files of a PASS review become examples`,
    );
  }

  for (const row of input.planned) {
    const id = row.template;
    const skip = (reason: string) =>
      skipped.push({ id: id || "(none)", file: row.path, reason });

    if (!/^create\b/.test(row.decision)) {
      skip(`decision is ${row.decision.split(":")[0]}, not create`);
    } else if (!id || !input.templateIds.includes(id)) {
      skip(`no golden template id in the plan row (${id || "empty"})`);
    } else if (!input.exists(row.path)) {
      skip("the file does not exist");
    } else if (input.existing.some((example) => example.file === row.path)) {
      skip("already an approved example");
    } else if (input.existing.some((example) => example.id === id)) {
      const current = input.existing.find((example) => example.id === id);
      skip(`the project already has an example for ${id}: ${current?.file}`);
    } else if (proposals.some((proposal) => proposal.id === id)) {
      skip(`this plan already proposes ${id}`);
    } else {
      proposals.push({
        id,
        need: `${row.layer} for ${input.title} (${input.plan})`,
        file: row.path,
        layer: row.layer,
      });
    }
  }

  return {
    plan: input.plan,
    review: input.review,
    verdict: input.verdict,
    proposals: errors.length > 0 ? [] : proposals,
    skipped,
    errors,
  };
}

export function addExamples(
  current: ExamplesFile,
  proposals: Proposal[],
): ExamplesFile {
  return {
    ...current,
    examples: [
      ...current.examples,
      ...proposals.map(({ id, need, file }) => ({ id, need, file })),
    ],
  };
}

function readJson<T>(file: string, fallback: T): T {
  return fs.existsSync(file)
    ? (JSON.parse(fs.readFileSync(file, "utf8")) as T)
    : fallback;
}

export function loadProposals(
  planArgument: string,
  cwd: string,
): ExampleProposals {
  const plan = path
    .relative(cwd, path.resolve(cwd, planArgument))
    .split(path.sep)
    .join("/");
  const feature = path.basename(plan, ".md");
  const review = `test-reviews/${feature}.md`;
  const planFile = path.join(cwd, plan);

  if (!fs.existsSync(planFile)) {
    return {
      plan,
      review,
      verdict: "missing",
      proposals: [],
      skipped: [],
      errors: [`no plan at ${plan}`],
    };
  }
  const planText = fs.readFileSync(planFile, "utf8");
  const reviewFile = path.join(cwd, review);
  const index = readJson<{ templates: { id: string }[] }>(
    path.join(cwd, INDEX_FILE),
    { templates: [] },
  );

  return proposeExamples({
    plan,
    review,
    verdict: fs.existsSync(reviewFile)
      ? parseVerdict(fs.readFileSync(reviewFile, "utf8"))
      : "missing",
    title: featureTitle(planText, feature),
    planned: parsePlannedFiles(planText),
    templateIds: index.templates.map((template) => template.id),
    existing: readJson<ExamplesFile>(path.join(cwd, EXAMPLES_FILE), {
      examples: [],
    }).examples,
    exists: (file) => fs.existsSync(path.join(cwd, file)),
  });
}

function main(): void {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const write = args.includes("--write");
  const onlyIndex = args.indexOf("--only");
  const only =
    onlyIndex >= 0
      ? (args[onlyIndex + 1] ?? "")
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean)
      : undefined;
  const plan = args.find(
    (arg, index) =>
      !arg.startsWith("--") && !(onlyIndex >= 0 && index === onlyIndex + 1),
  );

  if (!plan || (only !== undefined && only.length === 0)) {
    console.error(
      "Usage: npm run qa:approve-examples -- test-plans/<feature>.md [--only <id,...>] [--write] [--json]",
    );
    process.exit(2);
  }

  const cwd = process.cwd();
  const result = loadProposals(plan, cwd);
  const chosen = result.proposals.filter(
    (proposal) => !only || only.includes(proposal.id),
  );
  const unknown = (only ?? []).filter(
    (id) => !result.proposals.some((proposal) => proposal.id === id),
  );
  if (unknown.length > 0) {
    result.errors.push(`not proposed for this plan: ${unknown.join(", ")}`);
  }

  if (write && result.errors.length === 0 && chosen.length > 0) {
    const file = path.join(cwd, EXAMPLES_FILE);
    const current = readJson<ExamplesFile>(file, { examples: [] });
    fs.writeFileSync(
      file,
      `${JSON.stringify(addExamples(current, chosen), null, 2)}\n`,
    );
  }

  if (json) {
    console.log(
      JSON.stringify(
        {
          ...result,
          written: write && result.errors.length === 0 ? chosen : [],
        },
        null,
        2,
      ),
    );
  } else {
    for (const error of result.errors) console.log(`✘ ${error}`);
    for (const proposal of result.proposals) {
      console.log(
        `${chosen.includes(proposal) ? "+" : " "} ${proposal.id}: ${proposal.file} (${proposal.need})`,
      );
    }
    for (const skip of result.skipped) {
      console.log(`- ${skip.id}: ${skip.file}: ${skip.reason}`);
    }
    if (result.errors.length === 0) {
      console.log(
        chosen.length === 0
          ? "No new examples to propose."
          : write
            ? `Added ${chosen.length} example(s) to ${EXAMPLES_FILE}.`
            : `Proposed ${chosen.length} example(s); run again with --write to add them to ${EXAMPLES_FILE}.`,
      );
    }
  }
  process.exit(result.errors.length === 0 ? 0 : 1);
}

if (require.main === module) main();
