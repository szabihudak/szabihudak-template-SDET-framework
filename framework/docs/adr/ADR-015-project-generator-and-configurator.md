# ADR-015: Project Generator, Agent Choice and Configurator Download

## Status

Accepted

Amends ADR-007 (setup is a generator with two front ends) and ADR-010 (setup includes the example agents a user chooses; it still includes none by default).

---

## Context

A project is created by `npm run setup` in a clone of the template, interactively or from an answers file. The portfolio's configurator page builds that answers file in the browser, but a visitor still has to clone the template and run the installer to get a project.

Two requests followed:

- a visitor should be able to configure a project on the page and download it, without cloning the template;
- the example Copilot agents should be part of the project when a user wants them, instead of being copied by hand from `examples/copilot-agents/`.

A second implementation of setup for the browser would drift from the real one. Setup also does three things a browser cannot: it reads the template folder, regenerates `package-lock.json` with npm when the performance packages are left out, and formats files with prettier for Node.

---

## Decision

### One generator, two front ends

`framework/tools/project-generator.ts` holds what setup decides: the answers schema and its checks, the framework configuration, the environments file, the README, the skeleton folders, the MCP configuration, the package files, the CI secrets block and the chosen agents. It turns answers and a template source into project files, with no file system, terminal or npm.

- `setup.ts` is the terminal front end: the questions, reading the template folder (`readTemplateSource()`), writing the files, `.env`, git and the closing messages. Its output is unchanged.
- The configurator is the browser front end: `framework/tools/configurator/entry.ts`, bundled by `npm run qa:configurator` into `generator.js`, with `template.json`, the template files a project is made from.

Where the two differ, the source supplies the difference:

| Step                                    | setup.ts                             | Configurator                                                                                              |
| --------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Template files                          | the template folder (`git ls-files`) | `template.json`, built from the same list                                                                 |
| `package-lock.json` without performance | `npm install --package-lock-only`    | the same npm result, generated when `template.json` is built                                              |
| Formatting                              | prettier                             | prettier's browser build, same version and plugins                                                        |
| `.env`, git repository                  | created                              | created by the project's `./install.sh`, which now also initialises git when the folder has no repository |

The configurator zips the files under one folder, with Unix modes so `install.sh` stays executable, and asks for no secret. `npm run qa:selftest` runs the browser generator against every setup scenario and fails unless it creates the same files, byte for byte, with the same executable files.

### Agent choice

Setup asks which example agents to include, and answers files take `agents`. The planner, builder and reviewer hand work to each other through hand-off buttons, so they are one choice, the build pipeline; `test-runner` and `ci-failure-analyst` are chosen alone. A partial pipeline is refused. Chosen agents are copied to `.github/agents/`, and the project README names them. The default is still no agents.

### Files

The generator, the configurator build and its entry are template-only, like `setup.ts`. `dist/` is git-ignored. The bundle is built with esbuild, which the template already installs through `tsx`.

---

## Consequences

### Positive

- A visitor gets a project without cloning the template; the project is the one setup would create.
- One place decides what a project contains; the self-test keeps the browser and the terminal in step.
- The agents come with the project when wanted, ready for Copilot Chat.

### Trade-offs

- `generator.js` is about 2 MB, most of it prettier's browser build; it loads only when a visitor downloads a project.
- `template.json` is a snapshot. The configurator offers the template version it was built from until it is rebuilt and published again.
- The browser download shows its files to whoever downloads them, as a clone does; it hides the template's tooling and history, not the framework.
- esbuild comes in through `tsx`; a change of `tsx` that drops it would need esbuild as a direct devDependency.

---

## Related Decisions

```text
ADR-007 → reusable template architecture
ADR-010 → agents outside the template
ADR-014 → test runner agent
```
