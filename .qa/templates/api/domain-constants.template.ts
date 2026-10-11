// @template domain-constants: Reusable domain values such as supported statuses, with derived union types.
// @template Canonical source: src/app/api/constants/task.ts. Rules: docs/TESTING_STANDARDS.md#constants-standard
// @template Replace the __Tokens__ described in .qa/index.json. Fields, locators and test data are illustrative.
export const __DOMAIN___PRIORITIES = ["low", "medium", "high"] as const;

export const __DOMAIN___STATUSES = ["backlog", "in_progress", "done"] as const;

export type __Domain__Priority = (typeof __DOMAIN___PRIORITIES)[number];

export type __Domain__Status = (typeof __DOMAIN___STATUSES)[number];
