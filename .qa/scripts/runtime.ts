// Lighthouse 13 and other dependencies require Node.js 22.19 or newer.
const MINIMUM_NODE = [22, 19] as const;

export function assertSupportedNode(): void {
  const [major, minor] = process.versions.node.split(".").map(Number);

  if (
    major < MINIMUM_NODE[0] ||
    (major === MINIMUM_NODE[0] && minor < MINIMUM_NODE[1])
  ) {
    throw new Error(
      `Node.js ${MINIMUM_NODE.join(".")} or newer is required (found ${process.versions.node}). Install Node 22 LTS, for example: nvm install 22 && nvm use 22.`,
    );
  }
}
