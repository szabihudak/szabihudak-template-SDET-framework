import {
  getEnvironmentConfig,
  TestEnvironment,
} from "../../../config/environments/environment";

const DEFAULT_ENVIRONMENT: TestEnvironment = "hosted";

export function getCurrentEnvironment() {
  const environment =
    (process.env.TEST_ENV as TestEnvironment | undefined) ??
    DEFAULT_ENVIRONMENT;

  return getEnvironmentConfig(environment);
}
