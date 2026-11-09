import fs from "node:fs";
import path from "node:path";

import { getFrameworkConfig } from "../core/config/frameworkConfig";
import type { RunData } from "../core/reporting/run-report/model";
import { reportMeta, writeReport } from "../core/reporting/run-report/render";

// npm run qa:run-report -- <data folder> [<output folder>]
//
// Draws one run report (ADR-020) from the data files of several Playwright
// runs: in CI, the run-report-data-* artifacts of every test job. Writes
// index.html and summary.md to the output folder, by default run-report, and
// copies the runs' attachments next to them.

export function readRuns(dataDir: string): RunData[] {
  const files = fs
    .readdirSync(dataDir, { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(".json"))
    .sort();

  return files.flatMap((file) => {
    const run = JSON.parse(
      fs.readFileSync(path.join(dataDir, file), "utf8"),
    ) as Partial<RunData>;
    if (run.version !== 1 || !Array.isArray(run.tests)) {
      console.warn(`Skipped ${file}: not run report data.`);
      return [];
    }
    return [run as RunData];
  });
}

// The data artifacts keep run-report/attachments as attachments/.
export function copyAttachments(dataDir: string, outDir: string): void {
  const attachments = path.join(dataDir, "attachments");
  if (fs.existsSync(attachments)) {
    fs.cpSync(attachments, path.join(outDir, "attachments"), {
      recursive: true,
    });
  }
}

function main(): void {
  const [dataDir, outDir = "run-report"] = process.argv.slice(2);
  if (!dataDir) {
    console.error(
      "Usage: npm run qa:run-report -- <data folder> [<output folder>]",
    );
    process.exit(1);
  }
  if (!fs.existsSync(dataDir)) {
    console.error(`No run report data in ${dataDir}: no test job wrote any.`);
    process.exit(1);
  }

  const runs = readRuns(dataDir);
  if (runs.length === 0) {
    console.error(`No run report data in ${dataDir}.`);
    process.exit(1);
  }

  const view = writeReport(outDir, runs, reportMeta(getFrameworkConfig()));
  copyAttachments(dataDir, outDir);
  console.log(
    `✔ Run report of ${runs.length} run(s), ${view.tests.length} tests: ${path.join(outDir, "index.html")}`,
  );
}

if (require.main === module) {
  main();
}
