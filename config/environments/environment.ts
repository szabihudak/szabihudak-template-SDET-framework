import environments from "./environments.json";

export type TestEnvironment = keyof typeof environments;

export interface EnvironmentConfig {
  webBaseUrl: string;
  apiBaseUrl: string;
}

export function getEnvironmentConfig(
  environment: TestEnvironment,
): EnvironmentConfig {
  const config = environments[environment];

  if (!config) {
    throw new Error(`Unknown TEST_ENV: ${environment}`);
  }

  return config;
}
