import assert from "node:assert/strict";
import { test } from "node:test";

import {
  packageChanges,
  planUpdate,
  projectAnswers,
} from "../project-update.ts";
import { isTemplateOwned, sha256, stampFor } from "../template-stamp.ts";

const actionsOf = (plan: ReturnType<typeof planUpdate>) =>
  Object.fromEntries(plan.actions.map(({ file, action }) => [file, action]));

test("owns framework/, AGENTS.md, the Copilot instructions, agents and skills only", () => {
  for (const file of [
    "framework/core/x.ts",
    "AGENTS.md",
    ".github/copilot-instructions.md",
    ".github/agents/test-planner.agent.md",
    ".github/skills/validation-gates/SKILL.md",
  ]) {
    assert.ok(isTemplateOwned(file), file);
  }
  for (const file of [
    "src/pages/LoginPage.ts",
    "tests/api/login.spec.ts",
    "config/framework.config.ts",
    "config/approved-examples.json",
    "test-plans/login.md",
    "README.md",
    "package.json",
    ".github/workflows/playwright.yml",
    ".env",
    ".sdet-template.json",
  ]) {
    assert.ok(!isTemplateOwned(file), file);
  }
});

test("hashes as SHA-256 and stamps only the template-owned files", async () => {
  assert.equal(
    await sha256("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
  const stamp = await stampFor(
    { "AGENTS.md": "a", "src/x.ts": "b", "framework/y.ts": "c" },
    "abc1234",
    ["test-runner"],
  );
  assert.equal(stamp.template, "abc1234");
  assert.deepEqual(stamp.agents, ["test-runner"]);
  assert.deepEqual(Object.keys(stamp.files), ["AGENTS.md", "framework/y.ts"]);
});

test("updates files the project left alone and keeps the ones it changed", () => {
  const plan = planUpdate({
    generated: {
      "framework/same.ts": "s1",
      "framework/changed.ts": "c2",
      "framework/edited.ts": "e2",
      "framework/new.ts": "n1",
      "framework/deleted.ts": "d1",
    },
    current: {
      "framework/same.ts": "s1",
      "framework/changed.ts": "c1",
      "framework/edited.ts": "e-local",
      "framework/dropped.ts": "x1",
      "framework/dropped-edited.ts": "y-local",
      ".github/skills/own-skill/SKILL.md": "own",
    },
    stamped: {
      "framework/same.ts": "s1",
      "framework/changed.ts": "c1",
      "framework/edited.ts": "e1",
      "framework/deleted.ts": "d1",
      "framework/dropped.ts": "x1",
      "framework/dropped-edited.ts": "y1",
    },
    force: false,
  });

  assert.deepEqual(actionsOf(plan), {
    "framework/changed.ts": "update",
    "framework/edited.ts": "skip",
    "framework/new.ts": "add",
    "framework/deleted.ts": "skip",
    "framework/dropped.ts": "remove",
    "framework/dropped-edited.ts": "skip",
  });
  assert.equal(plan.unchanged, 1);
  // The project's own skill is neither touched nor reported.
  assert.ok(!plan.actions.some(({ file }) => file.includes("own-skill")));
  // A kept file keeps its old hash, so the next update still sees the change.
  assert.deepEqual(plan.stampFiles, {
    "framework/same.ts": "s1",
    "framework/changed.ts": "c2",
    "framework/edited.ts": "e1",
    "framework/new.ts": "n1",
    "framework/deleted.ts": "d1",
    "framework/dropped-edited.ts": "y1",
  });
});

test("--force replaces local changes and removes edited files the template dropped", () => {
  const plan = planUpdate({
    generated: { "framework/edited.ts": "e2", "framework/deleted.ts": "d1" },
    current: {
      "framework/edited.ts": "e-local",
      "framework/dropped-edited.ts": "y-local",
    },
    stamped: {
      "framework/edited.ts": "e1",
      "framework/deleted.ts": "d1",
      "framework/dropped-edited.ts": "y1",
    },
    force: true,
  });
  assert.deepEqual(actionsOf(plan), {
    "framework/edited.ts": "update",
    "framework/deleted.ts": "add",
    "framework/dropped-edited.ts": "remove",
  });
});

test("updates a project without a stamp, and only reports framework files the template dropped", () => {
  const plan = planUpdate({
    generated: { "framework/a.ts": "a2", "AGENTS.md": "g1" },
    current: {
      "framework/a.ts": "a1",
      "AGENTS.md": "g1",
      "framework/old.ts": "o1",
      ".github/skills/own-skill/SKILL.md": "own",
    },
    force: false,
  });
  assert.deepEqual(actionsOf(plan), {
    "framework/a.ts": "update",
    "framework/old.ts": "skip",
  });
  assert.match(plan.actions[0].reason, /no stamp/);
});

test("adds missing scripts and packages, and reports different versions without changing them", () => {
  const changes = packageChanges(
    {
      name: "my-app",
      scripts: { test: "playwright test", "qa:handoff-check": "own" },
      devDependencies: { "@playwright/test": "1.50.0" },
    },
    {
      name: "my-app",
      scripts: {
        test: "playwright test",
        "qa:handoff-check": "tsx framework/tools/agent-checks/handoff.ts",
        "qa:review-stamp": "tsx framework/tools/agent-checks/review-stamp.ts",
      },
      devDependencies: { "@playwright/test": "1.56.1", tsx: "4.20.6" },
    },
  );
  assert.deepEqual(changes.scripts, ["qa:review-stamp"]);
  assert.deepEqual(changes.dependencies, ["tsx@4.20.6"]);
  assert.match(changes.differing.join("\n"), /@playwright\/test: 1\.50\.0/);
  assert.equal(changes.packageJson.scripts?.["qa:handoff-check"], "own");
  assert.equal(
    changes.packageJson.devDependencies?.["@playwright/test"],
    "1.50.0",
  );
});

const CONFIG = `import { defineFrameworkConfig } from "../framework/core/config/frameworkConfigSchema";

export default defineFrameworkConfig({
  requirementsDoc: "docs/requirements.md",
  modules: {
    api: true,
    ui: true,
    smoke: false,
    accessibility: false,
    database: false,
    visual: false,
    performance: false,
  },
  browsers: ["chromium", "firefox"],
  execution: { ciRetries: 2, ciWorkers: "50%" },
});
`;

test("reads the settings from the project, the agents from the stamp or the agent files", () => {
  const environments = {
    staging: { webBaseUrl: "https://staging.example.com" },
  } as never;
  const fromFiles = projectAnswers({
    packageJson: { name: "my-app" },
    environments,
    frameworkConfig: CONFIG,
    agentFiles: ["test-runner.agent.md", "my-own.agent.md", "README.md"],
    knownAgents: ["test-runner", "pr-opener"],
  });
  assert.equal(fromFiles.inferredAgents, true);
  assert.equal(fromFiles.answers.appName, "my-app");
  assert.deepEqual(fromFiles.answers.browsers, ["chromium", "firefox"]);
  assert.equal(fromFiles.answers.modules.api, true);
  assert.equal(fromFiles.answers.modules.performance, false);
  assert.deepEqual(fromFiles.answers.agents, ["test-runner"]);

  const fromStamp = projectAnswers({
    packageJson: { name: "my-app" },
    environments,
    frameworkConfig: CONFIG,
    agentFiles: ["test-runner.agent.md"],
    stamp: { template: "abc", agents: ["pr-opener"], files: {} },
    knownAgents: ["test-runner", "pr-opener"],
  });
  assert.equal(fromStamp.inferredAgents, false);
  assert.deepEqual(fromStamp.answers.agents, ["pr-opener"]);

  assert.throws(
    () =>
      projectAnswers({
        packageJson: {},
        environments,
        frameworkConfig: "export default {};",
        agentFiles: [],
        knownAgents: [],
      }),
    /cannot read its modules/,
  );
});
