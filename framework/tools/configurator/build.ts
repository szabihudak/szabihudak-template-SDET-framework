import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { build } from "esbuild";

import { readTemplateSource } from "../setup";
import type { TemplateBundle } from "./entry";

// Builds the configurator's files (ADR-015) into a folder, by default
// dist/configurator: generator.js, the browser build of the project
// generator, and template.json, the template files a project is generated
// from. The configurator page loads both from the same folder.
//
//   npm run qa:configurator -- [<output folder>]

const ROOT = path.resolve(__dirname, "../../..");
const SHIMS = path.join(__dirname, "shims.ts");

export async function buildConfigurator(outDir: string): Promise<void> {
  fs.mkdirSync(outDir, { recursive: true });

  await build({
    entryPoints: [path.join(__dirname, "entry.ts")],
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2020",
    minify: true,
    legalComments: "none",
    outfile: path.join(outDir, "generator.js"),
    alias: {
      "@playwright/test": SHIMS,
      "node:fs": SHIMS,
      "node:path": SHIMS,
    },
    logLevel: "warning",
  });

  const source = readTemplateSource();
  const packageJson = JSON.parse(source.files["package.json"]);
  for (const name of source.exclusions.performance.devDependencies) {
    delete packageJson.devDependencies[name];
  }

  const bundle: TemplateBundle = {
    templateVersion: execSync("git describe --tags --always --dirty", {
      cwd: ROOT,
    })
      .toString()
      .trim(),
    files: source.files,
    projectFiles: source.projectFiles,
    executable: source.executable,
    exclusions: source.exclusions,
    lockWithoutPerformance: await source.packageLock(
      `${JSON.stringify(packageJson, null, 2)}\n`,
      source.exclusions.performance.devDependencies,
    ),
  };

  fs.writeFileSync(path.join(outDir, "template.json"), JSON.stringify(bundle));
}

if (require.main === module) {
  const outDir = path.resolve(
    process.argv[2] ?? path.join(ROOT, "dist/configurator"),
  );

  buildConfigurator(outDir)
    .then(() => console.log(`✔ configurator files in ${outDir}`))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
