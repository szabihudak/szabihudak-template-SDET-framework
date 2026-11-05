---
name: pr-handoff
description: "Hand a reviewed test change to the team: check it with qa:handoff-check, commit each file on a new branch, push it and open a draft pull request from the template. Use after a PASS review."
---

# Pull request hand-off

> Part of the example agents: change it freely in your project. Its source is `framework/skills/pr-handoff/` in the template repository.

Follow [AGENTS.md](../../../AGENTS.md). The pull request and its CI run are the approval: a hand-off never merges, approves or bypasses a check.

## Process

1. **Check the hand-off.** Run `npm run qa:handoff-check -- test-plans/<feature>.md --json`. It checks that the review is PASS and newer than every changed file, and that only the plan's `create` and `extend` files, the plan and the review report changed; `files` is the list you commit. If it exits with an error, report each of its `errors` and stop: a stale or failed review goes back to test-reviewer, a file outside the plan is the user's to commit or revert. Never commit a file that is not in `files`, and never work around the check.
2. **Check the tools.** `gh auth status` and `git remote get-url origin`. Without a signed-in GitHub CLI or a remote, say what is missing and stop. Find the default branch with `gh repo view --json defaultBranchRef`.
3. **Validate.** Run the `AGENTS.md` validation commands that need no target environment: `npx prettier --check .`, `npm run typecheck`, `npm run lint:architecture` and `npm run qa:templates:check`. If one fails, report it and stop; fixing is test-builder's job. The tests themselves run in CI on the pull request.
4. **Prepare.** Name the branch `tests/<feature>`; if it exists locally or on the remote, add `-2`, `-3`. When the change is already on a branch other than the default one, keep that branch. Write the commit message (`Add <feature> tests: <case IDs>`, then a body naming the plan and the review report) and the pull request title and body from [the pull request template](pull-request.template.md).
5. **Show the hand-off plan** and wait: the branch, the files, the commit message, the pull request title and body, and the base branch. Run nothing that writes before the user confirms.
6. **Open the pull request.** Run the hand-off check again; if it no longer passes, stop. Then `git switch -c <branch>` (unless you kept a branch), `git add` with each file of `files` by name, `git commit`, `git push -u origin <branch>`, then `gh pr create --draft --base <default branch> --head <branch> --title "<title>" --body-file -` with the body on standard input. If the pre-push hook rejects the push, report its output and stop.
