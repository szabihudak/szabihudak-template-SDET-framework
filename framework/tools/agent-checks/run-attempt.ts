import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// npm run qa:run-attempt -- [<run URL or ID>] [--attempt <n>] [--json]
//
// The facts ci-failure-analyst needs about one attempt of a GitHub Actions
// run (ADR-016): its status, commit and start, its failed and skipped jobs,
// which artifacts were created during this attempt and which are left from an
// earlier one, the report folder of this attempt and the reports of earlier
// attempts. It reads through the GitHub CLI only; deciding causes is the
// analyst's job.

export interface ApiRun {
  id: number;
  run_number: number;
  run_attempt: number;
  name: string;
  event: string;
  head_sha: string;
  head_branch: string;
  status: string;
  conclusion: string | null;
  html_url: string;
  run_started_at: string;
}

export interface ApiJob {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  html_url: string;
  steps?: { name: string; number: number; conclusion: string | null }[];
}

export interface ApiArtifact {
  id: number;
  name: string;
  created_at: string;
  expired: boolean;
  size_in_bytes: number;
}

export interface AttemptFacts {
  run: number;
  number: number;
  workflow: string;
  attempt: number;
  latestAttempt: number;
  status: string;
  conclusion: string | null;
  url: string;
  event: string;
  branch: string;
  commit: string;
  startedAt: string;
  failedJobs: {
    id: number;
    name: string;
    url: string;
    failedSteps: string[];
  }[];
  skippedJobs: string[];
  artifacts: {
    thisAttempt: string[];
    earlierAttempts: string[];
    expired: string[];
  };
  reportDir: string;
  earlierReports: string[];
  legacyReport: string | null;
}

// A run URL (…/actions/runs/<id> or …/runs/<id>/attempts/<n>) or a bare ID.
export function parseRunReference(reference: string): {
  run: number;
  attempt?: number;
} {
  const url = /\/runs\/(\d+)(?:\/attempts\/(\d+))?/.exec(reference);
  if (url) {
    return {
      run: Number(url[1]),
      ...(url[2] ? { attempt: Number(url[2]) } : {}),
    };
  }
  if (/^\d+$/.test(reference)) return { run: Number(reference) };
  throw new Error(`Not a GitHub Actions run URL or ID: ${reference}`);
}

export function describeAttempt(
  latest: ApiRun,
  attempt: ApiRun,
  jobs: ApiJob[],
  artifacts: ApiArtifact[],
  existingReports: string[],
): AttemptFacts {
  const started = Date.parse(attempt.run_started_at);
  const reportDir = `ci-analysis/${attempt.id}/attempt-${attempt.run_attempt}`;
  const usable = artifacts.filter((artifact) => !artifact.expired);

  return {
    run: attempt.id,
    number: attempt.run_number,
    workflow: attempt.name,
    attempt: attempt.run_attempt,
    latestAttempt: latest.run_attempt,
    status: attempt.status,
    conclusion: attempt.conclusion,
    url: attempt.html_url,
    event: attempt.event,
    branch: attempt.head_branch,
    commit: attempt.head_sha.slice(0, 7),
    startedAt: attempt.run_started_at,
    failedJobs: jobs
      .filter((job) => job.conclusion === "failure")
      .map((job) => ({
        id: job.id,
        name: job.name,
        url: job.html_url,
        failedSteps: (job.steps ?? [])
          .filter((step) => step.conclusion === "failure")
          .map((step) => `${step.number}: ${step.name}`),
      })),
    skippedJobs: jobs
      .filter((job) => job.conclusion === "skipped")
      .map((job) => job.name),
    artifacts: {
      thisAttempt: usable
        .filter((artifact) => Date.parse(artifact.created_at) >= started)
        .map((artifact) => artifact.name),
      earlierAttempts: usable
        .filter((artifact) => Date.parse(artifact.created_at) < started)
        .map((artifact) => artifact.name),
      expired: artifacts
        .filter((artifact) => artifact.expired)
        .map((artifact) => artifact.name),
    },
    reportDir,
    earlierReports: existingReports
      .filter((report) => {
        const match = /\/attempt-(\d+)\/analysis\.md$/.exec(report);
        return match !== null && Number(match[1]) < attempt.run_attempt;
      })
      .sort(),
    legacyReport: existingReports.includes(
      `ci-analysis/${attempt.id}/analysis.md`,
    )
      ? `ci-analysis/${attempt.id}/analysis.md`
      : null,
  };
}

function gh<T>(endpoint: string): T {
  return JSON.parse(
    execFileSync("gh", ["api", endpoint], { encoding: "utf8" }),
  ) as T;
}

function reportsOf(run: number, cwd: string): string[] {
  const folder = path.join(cwd, "ci-analysis", String(run));
  if (!fs.existsSync(folder)) return [];

  const reports: string[] = [];
  if (fs.existsSync(path.join(folder, "analysis.md"))) {
    reports.push(`ci-analysis/${run}/analysis.md`);
  }
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    if (
      entry.isDirectory() &&
      /^attempt-\d+$/.test(entry.name) &&
      fs.existsSync(path.join(folder, entry.name, "analysis.md"))
    ) {
      reports.push(`ci-analysis/${run}/${entry.name}/analysis.md`);
    }
  }
  return reports;
}

export function loadAttempt(
  reference: string | undefined,
  requestedAttempt: number | undefined,
  cwd: string,
): AttemptFacts {
  const repo = "repos/{owner}/{repo}/actions";
  const parsed = reference
    ? parseRunReference(reference)
    : {
        run: gh<{ workflow_runs: ApiRun[] }>(`${repo}/runs?per_page=1`)
          .workflow_runs[0]?.id,
      };
  if (!parsed.run) throw new Error("The repository has no workflow runs.");

  const latest = gh<ApiRun>(`${repo}/runs/${parsed.run}`);
  const attemptNumber =
    requestedAttempt ??
    ("attempt" in parsed ? parsed.attempt : undefined) ??
    latest.run_attempt;
  if (attemptNumber < 1 || attemptNumber > latest.run_attempt) {
    throw new Error(
      `Run ${parsed.run} has attempts 1 to ${latest.run_attempt}, not ${attemptNumber}.`,
    );
  }

  const attempt = gh<ApiRun>(
    `${repo}/runs/${parsed.run}/attempts/${attemptNumber}`,
  );
  const { jobs } = gh<{ jobs: ApiJob[] }>(
    `${repo}/runs/${parsed.run}/attempts/${attemptNumber}/jobs?per_page=100`,
  );
  const { artifacts } = gh<{ artifacts: ApiArtifact[] }>(
    `${repo}/runs/${parsed.run}/artifacts?per_page=100`,
  );

  return describeAttempt(
    latest,
    attempt,
    jobs,
    artifacts,
    reportsOf(parsed.run, cwd),
  );
}

function main(): void {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const attemptIndex = args.indexOf("--attempt");
  const attempt =
    attemptIndex >= 0 ? Number(args[attemptIndex + 1]) : undefined;
  const reference = args.find(
    (arg, index) =>
      !arg.startsWith("--") &&
      !(attemptIndex >= 0 && index === attemptIndex + 1),
  );

  if (attempt !== undefined && !Number.isInteger(attempt)) {
    console.error(
      "Usage: npm run qa:run-attempt -- [<run URL or ID>] [--attempt <n>] [--json]",
    );
    process.exit(2);
  }

  let facts: AttemptFacts;
  try {
    facts = loadAttempt(reference, attempt, process.cwd());
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }

  if (json) {
    console.log(JSON.stringify(facts, null, 2));
    return;
  }

  console.log(
    `${facts.workflow} run #${facts.number}, attempt ${facts.attempt} of ${facts.latestAttempt}: ${facts.status}${facts.conclusion ? ` (${facts.conclusion})` : ""}`,
  );
  console.log(
    `Run: ${facts.url} · Commit: ${facts.commit} · Branch: ${facts.branch} · Event: ${facts.event} · Started: ${facts.startedAt}`,
  );
  console.log(
    `Failed jobs: ${facts.failedJobs.map((job) => `${job.name} (${job.id}${job.failedSteps.length ? `; ${job.failedSteps.join(", ")}` : ""})`).join(", ") || "none"}`,
  );
  console.log(`Skipped jobs: ${facts.skippedJobs.join(", ") || "none"}`);
  console.log(
    `Artifacts of this attempt: ${facts.artifacts.thisAttempt.join(", ") || "none"}`,
  );
  console.log(
    `Artifacts of earlier attempts (not evidence for this one): ${facts.artifacts.earlierAttempts.join(", ") || "none"}`,
  );
  if (facts.artifacts.expired.length > 0) {
    console.log(`Expired artifacts: ${facts.artifacts.expired.join(", ")}`);
  }
  console.log(`Report: ${facts.reportDir}/analysis.md`);
  console.log(
    `Earlier attempt reports: ${facts.earlierReports.join(", ") || "none"}`,
  );
  if (facts.legacyReport) {
    console.log(
      `Report written before attempts had folders: ${facts.legacyReport}`,
    );
  }
}

if (require.main === module) main();
