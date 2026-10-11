import fs from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";

// Variables already set in the process (for example CI secrets) take precedence.
export function loadDotEnv(file = path.resolve(__dirname, "../../../.env")) {
  if (!fs.existsSync(file)) return;

  const values = parseEnv(fs.readFileSync(file, "utf8"));

  for (const [key, value] of Object.entries(values)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
