import path from "node:path";

const REDACTED = "[REDACTED]";
const REDACTED_EMAIL = "[REDACTED_EMAIL]";

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
    .replace(/Basic\s+[A-Za-z0-9+/=]+/gi, `Basic ${REDACTED}`)
    .replace(/^(Cookie|Set-Cookie):.*$/gim, `$1: ${REDACTED}`)
    .replace(
      /\b(access_token|refresh_token|token|session)=([^\s;]+)/gi,
      `$1=${REDACTED}`,
    )
    .replace(
      /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s)]+/gi,
      REDACTED,
    )
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, REDACTED_EMAIL);
}

function stripAnsi(value: string): string {
  return value.replace(
    // eslint-disable-next-line no-control-regex
    /\u001B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g,
    "",
  );
}
