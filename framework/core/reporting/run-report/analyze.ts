import type {
  FailureCategory,
  Lane,
  ReportMeta,
  ReportView,
  RootCause,
  RunData,
  TestOutcome,
  TestRecord,
} from "./model";

// Turns the data of one or more runs into what the report page draws: the
// counts, the projects, the failures grouped into root causes, the timeline's
// lanes and the summary for a pull request. Pure; the page only draws it.

const OUTCOMES: TestOutcome[] = ["passed", "failed", "flaky", "skipped"];
const CATEGORIES: FailureCategory[] = ["app", "test", "env", "unknown"];

// A first guess from the error alone, in the ci-failure-analyst's categories;
// its analysis gives the verdict (ADR-013). The first pattern that matches wins.
const CATEGORY_PATTERNS: [FailureCategory, RegExp][] = [
  [
    "env",
    /ECONNREFUSED|ECONNRESET|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|net::ERR_|socket hang up|getaddrinfo|\b50[234]\b|Bad Gateway|Service Unavailable|Executable doesn't exist|browserType\.launch|TEST_ENV/i,
  ],
  [
    "test",
    /\b(TypeError|ReferenceError|SyntaxError)\b|is not a function|is not defined|Cannot read propert|strict mode violation/,
  ],
  ["app", /expect\(|\bto(Be|Have|Equal|Match|Contain)\w*|schema|violation/i],
];

const SLOWEST = 5;
const SUMMARY_CAUSES = 5;

export function categorize(error: string): FailureCategory {
  return (
    CATEGORY_PATTERNS.find(([, pattern]) => pattern.test(error))?.[0] ??
    "unknown"
  );
}

// The same error in another browser or with other numbers is the same cause.
export function causeKey(file: string, error: string): string {
  const firstLine = error.split("\n").find((line) => line.trim()) ?? "";
  return `${file}\n${firstLine.replace(/\d+/g, "N").replace(/\s+/g, " ").trim()}`;
}

export function buildView(runs: RunData[], meta: ReportMeta): ReportView {
  const tests = runs.flatMap((run) => run.tests);
  const counts = Object.fromEntries(
    OUTCOMES.map((outcome) => [
      outcome,
      tests.filter((test) => test.outcome === outcome).length,
    ]),
  ) as Record<TestOutcome, number>;
  const ran = tests.length - counts.skipped;

  const causes = rootCauses(tests);
  const categories = Object.fromEntries(
    CATEGORIES.map((category) => [
      category,
      causes
        .filter((cause) => cause.category === category)
        .reduce((sum, cause) => sum + cause.tests.length, 0),
    ]),
  ) as Record<FailureCategory, number>;

  const startedAt = Math.min(...runs.map((run) => run.startedAt));
  const endedAt = Math.max(
    ...runs.map((run) => run.startedAt + run.durationMs),
  );

  const view: Omit<ReportView, "summary"> = {
    meta,
    environment:
      runs.map((run) => run.environment).find((environment) => environment) ??
      null,
    startedAt: runs.length ? startedAt : 0,
    durationMs: runs.length ? endedAt - startedAt : 0,
    runs: runs.length,
    workers: runs.reduce((sum, run) => sum + run.workers, 0),
    counts,
    passRate: ran ? (counts.passed + counts.flaky) / ran : 0,
    projects: groupIndexes(tests, (test) => test.project).map(
      ([name, indexes]) => ({ name, tests: indexes }),
    ),
    causes,
    categories,
    lanes: lanes(runs),
    slowest: tests
      .map((test, index) => ({ test, index }))
      .filter(({ test }) => test.outcome !== "skipped")
      .sort((left, right) => right.test.durationMs - left.test.durationMs)
      .slice(0, SLOWEST)
      .map(({ index }) => index),
    tests,
  };

  return { ...view, summary: summarize(view) };
}

function rootCauses(tests: TestRecord[]): RootCause[] {
  const groups = new Map<string, number[]>();

  tests.forEach((test, index) => {
    if (test.outcome !== "failed") {
      return;
    }
    const key = causeKey(test.file, test.error ?? "");
    groups.set(key, [...(groups.get(key) ?? []), index]);
  });

  return [...groups.values()]
    .map((indexes) => {
      const first = tests[indexes[0]];
      const error = first.error ?? "No error was recorded.";
      return {
        file: first.file,
        category: categorize(error),
        error,
        projects: [...new Set(indexes.map((index) => tests[index].project))],
        tests: indexes,
      };
    })
    .sort(
      (left, right) =>
        right.tests.length - left.tests.length ||
        left.file.localeCompare(right.file),
    );
}

// One lane per worker slot of each run, in the order the runs started. A
// test's index is its place in all runs' tests, which keep the runs' order.
function lanes(runs: RunData[]): Lane[] {
  const firsts = runs.map((_, index) =>
    runs.slice(0, index).reduce((sum, run) => sum + run.tests.length, 0),
  );

  return runs
    .map((run, index) => ({ run, first: firsts[index] }))
    .sort((left, right) => left.run.startedAt - right.run.startedAt)
    .flatMap(({ run, first }) =>
      groupIndexes(run.tests, (test) => String(test.lane))
        .sort(([left], [right]) => Number(left) - Number(right))
        .map(([lane, indexes]) => ({
          name:
            runs.length > 1
              ? `${run.name} / ${Number(lane) + 1}`
              : `worker ${Number(lane) + 1}`,
          tests: indexes.map((index) => first + index),
        })),
    );
}

function groupIndexes<T>(
  items: T[],
  keyOf: (item: T) => string,
): [string, number[]][] {
  const groups = new Map<string, number[]>();
  items.forEach((item, index) => {
    const key = keyOf(item);
    groups.set(key, [...(groups.get(key) ?? []), index]);
  });
  return [...groups.entries()];
}

export function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${String(seconds % 60).padStart(2, "0")}s`;
}

// Markdown for a pull request or the CI run's summary page.
function summarize(view: Omit<ReportView, "summary">): string {
  const { counts, meta, causes, tests } = view;
  const failed = counts.failed > 0;
  const percent = `${(view.passRate * 100).toFixed(1)}%`;
  const facts = [
    view.environment,
    meta.branch && meta.commit
      ? `${meta.branch} ${meta.commit}`
      : (meta.commit ?? meta.branch),
    formatDuration(view.durationMs),
  ].filter(Boolean);

  const lines = [
    failed
      ? `## ❌ ${meta.title} — ${counts.failed} failed (${percent} passed)`
      : `## ✅ ${meta.title} — all passed (${tests.length - counts.skipped} tests)`,
    "",
    facts.join(" · "),
    "",
    "| Passed | Failed | Flaky | Skipped |",
    "| ---: | ---: | ---: | ---: |",
    `| ${counts.passed} | ${counts.failed} | ${counts.flaky} | ${counts.skipped} |`,
  ];

  if (causes.length) {
    lines.push("", `### Root causes (${causes.length})`, "");
    for (const cause of causes.slice(0, SUMMARY_CAUSES)) {
      const firstLine = cause.error.split("\n")[0].slice(0, 120);
      lines.push(
        `- **${cause.tests.length} × \`${cause.file}\`** · ${cause.projects.join(", ")} · likely ${cause.category}  \n  ${firstLine.replaceAll("|", "\\|")}`,
      );
    }
    if (causes.length > SUMMARY_CAUSES) {
      lines.push(`- … and ${causes.length - SUMMARY_CAUSES} more`);
    }
  }

  if (meta.runUrl) {
    lines.push(
      "",
      `Full report: the \`run-report\` artifact of ${meta.runUrl}`,
    );
  }

  return `${lines.join("\n")}\n`;
}
