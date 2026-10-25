// Stand-ins for the Node and Playwright modules the generator's imports reach
// but never call in the browser: project names come from buildProjects(),
// which reads only device descriptors, and the file system helpers of
// ci-secrets.ts are not used by the generator.
export const devices = new Proxy({}, { get: () => ({}) });

const unavailable = () => {
  throw new Error("Not available in the browser");
};

export default { existsSync: unavailable, readFileSync: unavailable };
export const existsSync = unavailable;
export const readFileSync = unavailable;
export const writeFileSync = unavailable;
export const join = unavailable;
