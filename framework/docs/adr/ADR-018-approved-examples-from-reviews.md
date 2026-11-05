# ADR-018: Approved Examples from Reviewed Plans

## Status

Accepted

Amends ADR-016 (pr-opener proposes golden examples in its hand-off) and ADR-017 (the pr-handoff and golden-template-implementation skills).

---

## Context

`config/approved-examples.json` makes a project's reviewed files the first reference for their responsibility, ahead of the generic golden templates. Entries were written by hand, so they were mostly not written: a project kept copying the generic templates although it had better, reviewed files of its own.

An entry must only point to code that passed review and CI. Once registered, every agent and every AI tool copies it.

---

## Decision

`npm run qa:approve-examples -- test-plans/<feature>.md` proposes entries from a plan with a PASS review:

- only the plan's `create` rows whose "Golden example or template" id is in `framework/templates/index.json`, and only files that exist;
- one example per template id: never a second one for an id the project already has, never a file that is registered already, and never a replacement;
- `need` names the layer, the feature and the plan.

It changes nothing without `--write`; `--only <id,...>` writes a chosen subset.

pr-opener runs it before its hand-off plan and asks which proposals to add. The chosen entries go into the same commit and pull request as the files they name, so the pull request's CI run checks the code and `qa:templates:check` checks the entries, and they reach the default branch together or not at all. `qa:handoff-check` accepts a change to `config/approved-examples.json` only when it adds entries for the files of this hand-off and changes no existing entry. Without pr-opener, the reviewer's CP3 names the command.

Nothing runs after a merge: an entry that is not in a green, merged pull request does not exist.

---

## Consequences

### Positive

- A project's golden examples grow with its reviewed work instead of staying empty.
- No unreviewed or failing file becomes an example; a person decides each one in the hand-off and again in the pull request review.

### Trade-offs

- The first reviewed file of a responsibility becomes its example, not necessarily the best one. Replacing an example stays a hand edit in a reviewed pull request.
- A plan row without a template id, such as a pattern the project invented, is never proposed.

---

## Related Decisions

```text
ADR-016 → pull request opener
ADR-017 → agent skills
```
