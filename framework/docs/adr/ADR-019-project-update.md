# ADR-019: Updating an Existing Project from the Template

## Status

Accepted

Amends ADR-007 (template-owned files reach existing projects through an update command) and ADR-015 (the project generator writes a stamp, and the update uses the same generator).

---

## Context

`npm run setup` copies the framework into a new project once. A project created earlier kept its version: new agent checks, skills, golden templates and fixes reached it only by copying files by hand, which missed files, kept removed ones and could overwrite a change the project had made on purpose. Nothing recorded which template version a project came from.

---

## Decision

### The stamp

Setup and the configurator write `.sdet-template.json` into every new project:

- `template`: the template's short commit, with `-dirty` for uncommitted changes;
- `agents`: the example agents the project chose;
- `files`: the SHA-256 of every template-owned file as setup wrote it.

Template-owned files are `framework/`, `AGENTS.md`, `.github/copilot-instructions.md`, `.github/agents/` and `.github/skills/` (`isTemplateOwned` in `framework/tools/template-stamp.ts`). Everything else belongs to the project.

### The update

From an up-to-date template clone, `npm run setup -- --update <project folder>`:

- generates the project again with the template's current generator, from the project's own settings: its name, `config/environments/environments.json`, the modules and browsers of `config/framework.config.ts` (so a module enabled since setup is included), and the agents of the stamp;
- compares each template-owned file with the new version and the stamp:

| The project's file                   | Update                                              |
| ------------------------------------ | --------------------------------------------------- |
| as setup wrote it, template changed  | replaced                                            |
| new in the template                  | added                                               |
| no longer in the template (or agent) | removed                                             |
| changed in the project since setup   | kept and reported; `--force` replaces or removes it |
| deleted in the project               | not added again; `--force` adds it                  |
| added by the project (its own skill) | not touched                                         |
| already the template's current file  | nothing to do                                       |

- adds the `package.json` scripts and dependencies the new version needs, keeps every existing entry, reports packages whose version differs from the template's and says when `npm install` is needed. It never changes `package-lock.json`.
- never touches `src/`, `tests/`, `config/`, `test-plans/`, `test-reviews/`, `README.md`, the workflows or `.env`.

It is a dry run by default and prints every decision. `--write` applies it only in a git repository with a clean working tree, so `git diff` shows the update and `git checkout .` undoes it, then writes the new stamp: the new hash of every file it wrote, and the old hash of every file it kept, so the next update still sees the local change.

### Projects without a stamp

A project created before the stamp is updated the same way, with two differences printed in the dry run: its agents are read from `.github/agents/`, and a local change cannot be told apart from an old template file, so every differing template-owned file is replaced. Files in `framework/` that the template no longer has are reported, not removed. The first `--write` gives the project its stamp.

---

## Consequences

### Positive

- A project gets new framework versions, agents and skills with one reviewed command, and stays a separate repository with its own history.
- A file the project changed on purpose is never overwritten silently.
- The self-test updates a generated project: a fresh one needs nothing, an older template file is replaced, a local change is kept and project files are untouched.

### Trade-offs

- The update runs from a template clone, not from the project; the project has no setup tooling.
- A project file that the template also changed (a workflow, `README.md`) is not merged; compare it with a new project from the same answers.
- Without a stamp, local changes in template-owned files are overwritten; `git diff` before the commit is the only check.
- Dependency versions that differ from the template's are reported, not raised; the project decides when to upgrade.

---

## Related Decisions

```text
ADR-007 → reusable template architecture, template-owned framework/
ADR-015 → project generator and configurator
ADR-017 → agent skills
```
