import fs from "node:fs";
import path from "node:path";

import { getFrameworkConfig } from "../core/config/frameworkConfig";
import { buildProjects } from "../core/config/playwrightProjects";
import { getCurrentEnvironment } from "../core/utils/env";

// Projects for the pull-request workflow, derived from config/framework.config.ts
// so CI follows module and browser changes without editing the workflow.
// Performance runs only in the manually triggered performance workflow.
const EXCLUDED_PROJECTS = new Set(["performance"]);
const ROOT = path.resolve(__dirname, "../..");

function specFiles(directory = "tests"): string[] {
  const absolute = path.join(ROOT, directory);

  if (!fs.existsSync(absolute)) return [];

  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.posix.join(directory, entry.name);

    if (entry.isDirectory()) return specFiles(relative);

    return relative.endsWith(".spec.ts") ? [relative] : [];
  });
}

function main(): void {
  const environment = getCurrentEnvironment();
  const projects: string[] = [];
  const specs = specFiles();

  for (const project of buildProjects(getFrameworkConfig())) {
    const name = project.name ?? "";

    if (EXCLUDED_PROJECTS.has(name)) continue;

    // A new project has no tests until the first ones are written; running an
    // empty project would fail CI with "No tests found".
    const patterns = [project.testMatch ?? []].flat();
    const hasSpecs = specs.some((spec) =>
      patterns.some((pattern) =>
        pattern instanceof RegExp ? pattern.test(spec) : false,
      ),
    );

    if (!hasSpecs) {
      console.log(`Skipping ${name}: no tests yet.`);
      continue;
    }

    if (name === "database" && !environment.allow.database) {
      console.log(
        `Skipping database: ${environment.name} does not allow database access.`,
      );
      continue;
    }

    projects.push(name);
  }

  const output = JSON.stringify(projects);
  console.log(`Projects for ${environment.name}: ${output}`);

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `projects=${output}\n`);
  }
}

main();
