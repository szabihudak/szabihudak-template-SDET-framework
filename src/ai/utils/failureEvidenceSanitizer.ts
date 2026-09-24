import path from "node:path";

const REDACTED = "[REDACTED]";

function toPosixPath(value: string): string {
  return value.split(path.sep).join("/");
}

export function sanitizePath(value: string): string {
  const cwd = process.cwd();
  const relative = path.relative(cwd, value);

  if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
    return toPosixPath(relative);
  }

  return path.basename(value);
}

export function sanitizeText(value: string): string {
  const cwd = toPosixPath(process.cwd());

  return stripAnsi(value)
    .replaceAll(`${cwd}/`, "")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, `Bearer ${REDACTED}`)
    .replace(
      /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s)]+/gi,
      REDACTED,
    );
}

function stripAnsi(value: string): string {
  return value.replace(
    // eslint-disable-next-line no-control-regex
    /\u001B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g,
    "",
  );
}