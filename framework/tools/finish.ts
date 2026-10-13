import fs from "node:fs";
import path from "node:path";

import {
  cdTarget,
  nextSteps,
  type Onboarding,
  readProjectState,
} from "./next-steps";

// The installer's last words: the finish box from framework/install (on a
// terminal only, like the banner) and what to do next in the IDE.
//
// install.sh runs it as:
//   finish.ts <onboarding outcome> <doctor ok: 1|0> <start folder> [<project folder>]
// with QA_COLOR=1 for color and QA_EMOJI=1 for emoji marks, decided there.

const ROOT = path.resolve(__dirname, "../..");
const [onboarding = "skipped", doctor = "1", start = "", project = ""] =
  process.argv.slice(2);
const color = process.env.QA_COLOR === "1";
const emoji = process.env.QA_EMOJI === "1";

const paint = (code: string, text: string) =>
  color && code ? `\x1b[${code}m${text}\x1b[0m` : text;

// Green border, bold title, dim italic quote (the lines after the empty one).
function finishBox(box: string): string {
  let quote = false;

  return box
    .trimEnd()
    .split("\n")
    .map((line) => {
      const row = /^(\s*)\|(.*)\|$/.exec(line);

      if (!row) return line.replace(/\S+/, (border) => paint("32", border));

      const [, indent, inner] = row;
      if (!inner.trim()) quote = true;

      const style = inner.includes("INSTALLER FINISHED")
        ? "1"
        : quote && inner.trim()
          ? "2;3"
          : "";

      return `${indent}${paint("32", "|")}${paint(style, inner)}${paint("32", "|")}`;
    })
    .join("\n");
}

console.log("");
if (process.stdout.isTTY) {
  console.log(`  ${emoji ? "🤘" : "\\m/"}`);
  console.log(
    finishBox(
      fs.readFileSync(
        path.join(ROOT, "framework/install/finished.txt"),
        "utf8",
      ),
    ),
  );
  console.log("");
}

console.log(
  nextSteps(
    {
      ...readProjectState(ROOT),
      onboarding: onboarding as Onboarding,
      doctorOk: doctor === "1",
      cd: project ? cdTarget(start, project) : undefined,
    },
    emoji ? "👉" : "->",
  ).join("\n"),
);
