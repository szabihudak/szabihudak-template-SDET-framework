import fs from "node:fs";
import { parseEnv } from "node:util";

// The one test account npm run onboard adds when the project has no roles yet.
// The login method is configured afterwards (README.md, Configure login).
export const DEFAULT_ROLE = {
  name: "user",
  usernameEnv: "USER_USERNAME",
  passwordEnv: "USER_PASSWORD",
};

// setup writes config/framework.config.ts with an empty roles object until a
// role exists. Returns false when the file has no empty roles object.
export function addRoleToConfig(
  configFile: string,
  role = DEFAULT_ROLE,
): boolean {
  const config = fs.readFileSync(configFile, "utf8");
  const updated = config.replace(
    /roles: \{\}/,
    `roles: { ${role.name}: { usernameEnv: "${role.usernameEnv}", passwordEnv: "${role.passwordEnv}" } }`,
  );

  if (updated === config) return false;
  fs.writeFileSync(configFile, updated);
  return true;
}

// Replaces setup's "add one USERNAME/PASSWORD pair per role" note with the
// role's variable names, or appends them.
export function addRoleToEnvExample(file: string, role = DEFAULT_ROLE): void {
  const content = fs.readFileSync(file, "utf8");

  if (new RegExp(`^${role.usernameEnv}=`, "m").test(content)) return;

  const block = `# ${role.name} role test account\n${role.usernameEnv}=\n${role.passwordEnv}=\n`;
  const note =
    /^# Test accounts: add one USERNAME\/PASSWORD pair[^\n]*\n#[^\n]*\n/m;

  fs.writeFileSync(
    file,
    note.test(content)
      ? content.replace(note, block)
      : `${content.replace(/\n*$/, "\n")}\n${block}`,
  );
}

// Quotes a value so the .env parser reads it back unchanged: '#', spaces and
// '$' are literal inside quotes. Returns undefined for values no quoting keeps
// intact (a line break, or all three quote characters).
export function quoteEnvValue(value: string): string | undefined {
  if (/[\r\n]/.test(value)) return undefined;

  const quoted = !value.includes("'")
    ? `'${value}'`
    : !/["\\]/.test(value)
      ? `"${value}"`
      : !value.includes("`")
        ? `\`${value}\``
        : undefined;

  return quoted !== undefined && parseEnv(`V=${quoted}`).V === value
    ? quoted
    : undefined;
}

// Sets the given variables in .env, replacing existing lines and appending
// missing ones. Returns the names whose values could not be written safely.
export function setEnvValues(
  envFile: string,
  values: Record<string, string>,
): string[] {
  let content = fs.existsSync(envFile) ? fs.readFileSync(envFile, "utf8") : "";
  const rejected: string[] = [];

  for (const [name, value] of Object.entries(values)) {
    const quoted = quoteEnvValue(value);

    if (quoted === undefined) {
      rejected.push(name);
      continue;
    }

    const line = `${name}=${quoted}`;
    const existing = new RegExp(`^${name}=.*$`, "m");

    content = existing.test(content)
      ? content.replace(existing, () => line)
      : `${content.replace(/\n*$/, content ? "\n" : "")}${line}\n`;
  }

  fs.writeFileSync(envFile, content);
  return rejected;
}

// Values already in .env, so a rerun can keep them.
export function readEnvValues(envFile: string): Record<string, string> {
  return fs.existsSync(envFile)
    ? (parseEnv(fs.readFileSync(envFile, "utf8")) as Record<string, string>)
    : {};
}
