import environments from "../../../config/environments/environments.json";
import { validateSchema } from "../api/SchemaValidator";
import {
  environmentsSchema,
  REQUIRED_URLS,
  type EnvironmentConfig,
  type EnvironmentPermission,
  type EnvironmentUrl,
} from "../config/environmentSchema";
import { getFrameworkConfig } from "../config/frameworkConfig";

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

  const { modules } = getFrameworkConfig();
  for (const [url, needers] of Object.entries(REQUIRED_URLS)) {
    const module = needers.find(
      (item) => modules[item as keyof typeof modules],
    );
    if (module && !environment[url as EnvironmentUrl]) {
      throw new Error(
        `${name}: the ${module} module is enabled, so ${url} is required in config/environments/environments.json.`,
      );
    }
  }

  return { name, ...environment };
}

// A URL the caller needs; an environment may leave out a URL no enabled module
// requires, and a fixture that still uses it fails here with its name.
export function requireUrl(url: EnvironmentUrl): string {
  const environment = getCurrentEnvironment();
  const value = environment[url];

  if (!value) {
    throw new Error(
      `${environment.name} has no ${url} in config/environments/environments.json.`,
    );
  }

  return value;
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
