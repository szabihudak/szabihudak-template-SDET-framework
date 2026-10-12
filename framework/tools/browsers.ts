import { getFrameworkConfig } from "../core/config/frameworkConfig";
import { buildProjects } from "../core/config/playwrightProjects";

// Prints the browsers the configured Playwright projects launch, so install.sh
// downloads only those. API-only projects print nothing.
const browsers = new Set(
  buildProjects(getFrameworkConfig()).flatMap((project) =>
    project.use?.defaultBrowserType ? [project.use.defaultBrowserType] : [],
  ),
);

console.log([...browsers].join(" "));
