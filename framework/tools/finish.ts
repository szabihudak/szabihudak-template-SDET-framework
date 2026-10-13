import fs from "node:fs";
import path from "node:path";

import { nextSteps, type Onboarding, readProjectState } from "./next-steps";

// The installer's last words: the finish box from framework/install (on a
// terminal only, like the banner) and what to do next in the IDE.
//
// install.sh runs it as: finish.ts <onboarding outcome> <doctor ok: 1|0> [<cd path>]

const ROOT = path.resolve(__dirname, "../..");
const [onboarding = "skipped", doctor = "1", cd] = process.argv.slice(2);

if (process.stdout.isTTY) {
  const box = fs.readFileSync(
    path.join(ROOT, "framework/install/finished.txt"),
    "utf8",
  );
  const color =
    !process.env.NO_COLOR && (process.env.TERM ?? "dumb") !== "dumb";

  console.log(
    `\n${
      color
        ? box.replace(/^(.*INSTALLER FINISHED.*)$/m, "\x1b[1;32m$1\x1b[0m")
        : box
    }`,
  );
} else {
  console.log("");
}

console.log(
  nextSteps({
    ...readProjectState(ROOT),
    onboarding: onboarding as Onboarding,
    doctorOk: doctor === "1",
    cd: cd || undefined,
  }).join("\n"),
);
