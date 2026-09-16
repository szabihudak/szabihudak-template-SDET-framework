import environments from "./environments.json";

export type TestEnvironment = keyof typeof environments;

export interface EnvironmentConfig {
  webBaseUrl: string;
  apiBaseUrl: string;
}

export function getEnvironmentConfig(
  environment: TestEnvironment,
): EnvironmentConfig {
  return environments[environment];
}
