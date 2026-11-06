// The project stamp (ADR-019), with no dependencies, so the project
// generator (also in the configurator page) and the project update share it.

// The template version, agents and template-owned file hashes a project was
// created or last updated from (ADR-019); npm run setup -- --update reads it.
export const STAMP_FILE = ".sdet-template.json";

// The files the template owns in a project: an update may replace them.
// Everything else (src, tests, config, plans, reviews, README, workflows,
// package.json apart from added entries) belongs to the project.
export const isTemplateOwned = (file: string) =>
  file === "AGENTS.md" ||
  file === ".github/copilot-instructions.md" ||
  file.startsWith("framework/") ||
  file.startsWith(".github/agents/") ||
  file.startsWith(".github/skills/");

export type TemplateStamp = {
  $comment?: string;
  template: string;
  agents: string[];
  files: Record<string, string>;
};

export const STAMP_COMMENT =
  "Written by npm run setup and npm run setup -- --update: the template version this project was created or last updated from, its agents, and the SHA-256 of every template-owned file as setup wrote it, so an update can tell a local change from an older template file. Do not edit.";

// SHA-256 in hex, in Node and in the configurator page alike.
export async function sha256(content: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(content),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function stampFor(
  files: Record<string, string>,
  version: string,
  agents: string[],
): Promise<TemplateStamp> {
  const owned = Object.keys(files).filter(isTemplateOwned).sort();
  return {
    $comment: STAMP_COMMENT,
    template: version,
    agents: [...agents],
    files: Object.fromEntries(
      await Promise.all(
        owned.map(async (file) => [file, await sha256(files[file])] as const),
      ),
    ),
  };
}
