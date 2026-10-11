import {
  test as frameworkTest,
  expect,
} from "../../framework/fixtures/framework-fixtures";

// Add application fixtures here (API clients, Page Objects, test data).
// See the fixture section of docs/TESTING_STANDARDS.md and .qa/index.json.
type AppFixtures = {};

export const test = frameworkTest.extend<AppFixtures>({});

export { expect };
