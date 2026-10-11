import environments from "../../../config/environments/environments.json";
import { validateSchema } from "../api/SchemaValidator";
import {
  environmentsSchema,
  type EnvironmentConfig,
  type EnvironmentPermission,
} from "../config/environmentSchema";

function getEnvironments() {
  const data: unknown = environments;
  validateSchema(environmentsSchema, data);

  return data;
}

export function getCurrentEnvironment(): EnvironmentConfig {
  const configuredEnvironments = getEnvironments();
  const supportedNames = Object.keys(configuredEnvironments).join(", ");
  const name = process.env.TEST_ENV;

  // A silent default could send tests to a shared environment.
  if (!name) {
    throw new Error(
      `TEST_ENV is not set. Choose one of: ${supportedNames} (config/environments/environments.json).`,
    );
  }

  const environment = configuredEnvironments[name];

  if (!environment) {
    throw new Error(
      `Unknown TEST_ENV: ${name}. Choose one of: ${supportedNames}.`,
    );
  }

  return { name, ...environment };
}

export function assertEnvironmentAllows(
  permission: EnvironmentPermission,
  operation: string,
): void {
  const environment = getCurrentEnvironment();

  if (!environment.allow[permission]) {
    throw new Error(
      `${operation} is not allowed in the ${environment.name} environment. Set allow.${permission} in config/environments/environments.json only for a dedicated test-owned environment.`,
    );
  }
}
