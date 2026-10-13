import type { FrameworkConfig } from "../core/config/frameworkConfigSchema";
import { buildProjects } from "../core/config/playwrightProjects";

// npm scripts that run one test category, for the modules and browsers the
// project enables. Module projects and browser projects come from the same
// buildProjects() as playwright.config.ts; UI and smoke specs have no project
// of their own (they run in every browser project), so they filter by folder.
export function testScripts(config: FrameworkConfig): Record<string, string> {
  const projects = buildProjects(config).map((project) => project.name ?? "");
  const browsers = new Set<string>(config.browsers);
  const script = (name: string, args: string) =>
    [`test:${name}`, `playwright test ${args}`] as const;

  return Object.fromEntries([
    ...projects
      .filter((name) => !browsers.has(name))
      .map((name) => script(name, `--project=${name}`)),
    ...(["ui", "smoke"] as const)
      .filter((module) => config.modules[module])
      .map((module) => script(module, `tests/${module}`)),
    ...projects
      .filter((name) => browsers.has(name))
      .map((name) => script(name, `--project=${name}`)),
  ]);
}

// The general scripts every project has; the rest of test:* are categories.
const GENERAL_TEST_SCRIPTS = new Set([
  "test",
  "test:list",
  "test:headed",
  "test:debug",
]);

export function categoryScriptNames(scripts: Record<string, string>): string[] {
  return Object.keys(scripts).filter(
    (name) => name.startsWith("test:") && !GENERAL_TEST_SCRIPTS.has(name),
  );
}

// Inserts the category scripts after the general test scripts, keeping the
// order of everything else.
export function withTestScripts(
  scripts: Record<string, string>,
  config: FrameworkConfig,
): Record<string, string> {
  const categories = testScripts(config);
  const entries = Object.entries(scripts).filter(
    ([name]) => !categoryScriptNames(scripts).includes(name),
  );
  const afterGeneral =
    entries.map(([name]) => GENERAL_TEST_SCRIPTS.has(name)).lastIndexOf(true) +
    1;

  entries.splice(afterGeneral, 0, ...Object.entries(categories));
  return Object.fromEntries(entries);
}
