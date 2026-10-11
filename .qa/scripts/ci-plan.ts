import fs from "node:fs";

import { getFrameworkConfig } from "../../src/framework/config/frameworkConfig";
import { buildProjects } from "../../src/framework/config/playwrightProjects";
import { getCurrentEnvironment } from "../../src/framework/utils/env";

// Projects for the pull-request workflow, derived from config/framework.config.ts
// so CI follows module and browser changes without editing the workflow.
// Performance runs only in the manually triggered performance workflow.
const EXCLUDED_PROJECTS = new Set(["performance"]);

function main(): void {
  const environment = getCurrentEnvironment();
  const projects: string[] = [];

  for (const project of buildProjects(getFrameworkConfig())) {
    const name = project.name ?? "";

    if (EXCLUDED_PROJECTS.has(name)) continue;

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
