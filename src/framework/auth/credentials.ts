import { getFrameworkConfig } from "../config/frameworkConfig";

export type Credentials = {
  username: string;
  password: string;
};

export function getRoleCredentials(role: string): Credentials {
  const roleConfig = getFrameworkConfig().roles[role];

  if (!roleConfig) {
    throw new Error(
      `Unknown role: ${role}. Configure it under roles in config/framework.config.ts.`,
    );
  }

  const username = process.env[roleConfig.usernameEnv];
  const password = process.env[roleConfig.passwordEnv];

  if (!username || !password) {
    throw new Error(
      `Credentials for role "${role}" are missing. Set ${roleConfig.usernameEnv} and ${roleConfig.passwordEnv} in .env.`,
    );
  }

  return { username, password };
}
