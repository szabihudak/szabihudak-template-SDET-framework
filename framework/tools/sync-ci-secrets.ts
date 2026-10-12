import path from "node:path";

import { getFrameworkConfig } from "../core/config/frameworkConfig";
import {
  ciSecretNames,
  describeCiSettings,
  syncWorkflowSecrets,
} from "./ci-secrets";

// Run after changing roles or enabling the database module in
// config/framework.config.ts, so CI receives the matching secrets.
const secretNames = ciSecretNames(getFrameworkConfig());
const updated = syncWorkflowSecrets(
  path.resolve(__dirname, "../.."),
  secretNames,
);

console.log(
  updated.length > 0
    ? `Updated ${updated.join(", ")}`
    : "Workflows already list the configured secrets.",
);
console.log(describeCiSettings(undefined, secretNames));
