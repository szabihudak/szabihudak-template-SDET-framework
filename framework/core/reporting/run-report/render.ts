import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import type { FrameworkConfig } from "../../config/frameworkConfigSchema";
import { buildView } from "./analyze";
import type { ReportMeta, ReportView, RunData } from "./model";

// Writes the report page (index.html, one file that needs nothing else) and
// its summary (summary.md) from the data of one or more runs.

const PAGE = path.join(__dirname, "page.html");
// Prettier may put a space before null.
const DATA_MARK = /\/\*__RUN_REPORT_DATA__\*\/\s*null/;

export function renderPage(view: ReportView): string {
  // "<" escaped, so no test title or error can end the script element.
  const data = JSON.stringify(view).replaceAll("<", "\\u003c");
  const page = fs.readFileSync(PAGE, "utf8");
  return page
    .replace(
      "<title>Run report</title>",
      `<title>${escapeHtml(view.meta.title)} · Run report</title>`,
    )
    .replace(DATA_MARK, () => data);
}

export function writeReport(
  outDir: string,
  runs: RunData[],
  meta: ReportMeta,
): ReportView {
  const view = buildView(runs, meta);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.html"), renderPage(view));
  fs.writeFileSync(path.join(outDir, "summary.md"), view.summary);
  return view;
}

// The title and subtitle from config/framework.config.ts (report), else the
// project's name; the commit, branch and run page from CI or git.
export function reportMeta(
  config: Pick<FrameworkConfig, "report">,
  root = process.cwd(),
): ReportMeta {
  const env = process.env;
  const runUrl =
    env.GITHUB_SERVER_URL && env.GITHUB_REPOSITORY && env.GITHUB_RUN_ID
      ? `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`
      : null;

  return {
    title: config.report?.title ?? projectTitle(root),
    subtitle: config.report?.subtitle ?? "Playwright run report",
    commit: env.GITHUB_SHA?.slice(0, 7) ?? git("rev-parse --short HEAD", root),
    branch:
      env.GITHUB_HEAD_REF ||
      env.GITHUB_REF_NAME ||
      git("rev-parse --abbrev-ref HEAD", root),
    runUrl,
  };
}

function projectTitle(root: string): string {
  try {
    const { name } = JSON.parse(
      fs.readFileSync(path.join(root, "package.json"), "utf8"),
    ) as { name?: string };
    if (name) {
      return name
        .replace(/^@[^/]+\//, "")
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map((part) => part[0].toUpperCase() + part.slice(1))
        .join(" ");
    }
  } catch {
    // Without a readable package.json the report keeps a plain title.
  }
  return "Test run";
}

function git(args: string, cwd: string): string | null {
  try {
    return (
      execSync(`git ${args}`, { cwd, stdio: ["ignore", "pipe", "ignore"] })
        .toString()
        .trim() || null
    );
  } catch {
    return null;
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
