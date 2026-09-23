# Portfolio Publication Matrix

## Purpose

This document is the publication contract between the canonical private framework and any public portfolio representation derived from it.

The private repository remains the engineering source of truth. Public documentation, selected source examples, and demo evidence must be derived from the latest verified private implementation and filtered through this matrix before publication.

This matrix defines the maximum public representation permitted for each capability. It does not require every permitted item to be published.

## Publication Categories

- **A — Selected full source:** representative, self-contained, public-safe implementation may be published in full. This does not authorize publication of an entire subsystem.
- **B — Curated representation:** architecture, sanitized snippets, partial examples, or portfolio-oriented documentation may be published; the complete implementation remains private.
- **C — Evidence only:** sanitized evidence from real execution may be published; implementation details remain private.
- **D — Private only:** no source, snippet, operational detail, or execution artifact is published.

Every candidate asset still requires a public-safety review. A category is permission to consider publication, not an automatic approval.

## Publication Matrix

| Capability                                                      | Public source | Snippet / curated representation | Demo evidence | Private only | Notes                                                                                                                                                                          |
| --------------------------------------------------------------- | ------------- | -------------------------------- | ------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Framework architecture                                          |               | B                                | C             |              | Publish portfolio-oriented architecture and responsibility boundaries, not a mirror of the complete private documentation.                                                     |
| API domain client                                               | A             | B                                | C             |              | Publish one representative public-safe client where dependencies and target details are safe.                                                                                  |
| API contracts / TypeBox schemas                                 | A             | B                                | C             |              | Publish representative schemas that demonstrate schema-first design without exposing unnecessary domain coverage.                                                              |
| AJV runtime validation                                          | A             | B                                | C             |              | Representative reusable validation path may be published.                                                                                                                      |
| API specifications                                              | A             | B                                | C             |              | Publish a small representative subset only.                                                                                                                                    |
| Page Objects                                                    | A             | B                                | C             |              | Publish representative page behavior, not the complete private page layer.                                                                                                     |
| Component Objects                                               | A             | B                                | C             |              | Publish when it adds architectural signal beyond the Page Object example.                                                                                                      |
| Fixtures and lifecycle composition                              |               | B                                | C             |              | Prefer a curated example that demonstrates composition and ownership without exposing the complete fixture graph.                                                              |
| Deterministic factories / test data                             | A             | B                                | C             |              | Representative deterministic factory may be public.                                                                                                                            |
| Authentication architecture                                     |               | B                                | C             |              | Explain programmatic API/browser authentication and show only sanitized, public-safe examples. Never publish credentials, tokens, cookies, session state, or reusable secrets. |
| Network mocking                                                 | A             | B                                | C             |              | Representative public-safe mock pattern may be published.                                                                                                                      |
| Cross-browser UI execution                                      |               | B                                | C             |              | Show execution ownership and Chromium/Firefox/WebKit evidence; complete orchestration remains private.                                                                         |
| Accessibility testing                                           |               | B                                | C             |              | Publish architecture/policy concepts and sanitized evidence. Do not claim automated axe coverage proves complete WCAG conformance.                                             |
| Visual regression                                               |               | B                                | C             |              | Publish baseline ownership strategy and reviewed visual evidence. Do not expose unsafe application data in screenshots.                                                        |
| k6 API performance                                              |               | B                                | C             |              | A small sanitized scenario may be considered later if independently reviewed; default representation is curated architecture plus real evidence.                               |
| Lighthouse browser performance                                  |               | B                                | C             |              | Publish measurement architecture, repeated-run/aggregation concept, shared policy concepts, and sanitized evidence; keep full orchestration private.                           |
| Docker execution                                                |               | B                                | C             |              | Publish reproducibility and runtime-boundary concepts. Avoid private registry, environment, or operational details.                                                            |
| GitHub Actions CI/CD                                            |               | B                                | C             |              | Publish the responsibility model and build-once/run-many design. Do not blindly copy private workflows.                                                                        |
| GHCR image reuse                                                |               | B                                | C             |              | Publish architectural behavior such as immutable commit-SHA reuse; review package/registry identifiers before exposure.                                                        |
| Diagnostics and reports                                         |               | B                                | C             |              | Publish only sanitized representative reports, screenshots, traces, or artifact layouts.                                                                                       |
| Testing standards                                               |               | B                                |               |              | Derive concise public-safe standards; do not mirror the complete private operational manual.                                                                                   |
| ADRs / engineering decisions                                    |               | B                                |               |              | Publish selected decisions and trade-offs that add portfolio signal.                                                                                                           |
| AI-agent / Copilot engineering guidance                         |               | B                                |               |              | Public representation may describe engineering governance and reuse principles. Full private agent instructions remain private.                                                |
| Complete private framework source                               |               |                                  |               | D            | Never publish as part of the showcase.                                                                                                                                         |
| Complete fixture graph and operational internals                |               |                                  |               | D            | Keep complete internal composition private even when representative fixture patterns are public.                                                                               |
| Secrets, credentials, tokens, cookies, session state            |               |                                  |               | D            | Never publish.                                                                                                                                                                 |
| Private environment configuration or sensitive endpoints        |               |                                  |               | D            | Never publish.                                                                                                                                                                 |
| Unreviewed raw traces, reports, screenshots, logs, or artifacts |               |                                  |               | D            | Evidence becomes eligible only after explicit sanitization review.                                                                                                             |

## Roadmap Capability Rule

The roadmap is a separate source of truth for future engineering direction.

A roadmap capability may be represented publicly as **Planned** or **In Progress** when that status accurately reflects the roadmap and current work. It must not be represented as implemented until the canonical private repository contains validated implementation or another explicitly defined deliverable supports that claim.

Planned capabilities may include intended scope and architecture-level direction, but they must not receive fabricated source examples, execution evidence, metrics, or completion claims.

The public lifecycle is:

```text
Planned
   ↓
implementation in canonical source
   ↓
validation
   ↓
public-safety review
   ↓
Implemented
   ↓
selected source / architecture / real evidence as permitted by this matrix
```

## Publication Workflow

Before adding or changing public showcase material:

1. Verify the latest remote state of the canonical private repository.
2. Determine whether the claim is implemented, in progress, or planned.
3. Find the capability in this publication matrix.
4. Use no more public detail than the matrix permits.
5. Review the exact text, source, screenshot, report, trace, or other evidence for public safety.
6. Publish only the minimum material needed to demonstrate the engineering signal.
7. Verify that the resulting public representation does not imply broader implementation or exposure than the canonical source supports.

If the private implementation and public representation disagree, the private implementation wins and the public material must be corrected.

## Evidence Safety Checklist

Before publishing execution evidence, explicitly review it for:

- credentials, API keys, tokens, authorization headers, cookies, and session identifiers;
- private or environment-specific URLs and endpoints;
- personal email addresses or other unnecessary personal data;
- local filesystem paths and usernames;
- environment variables and secret names where disclosure would be inappropriate;
- internal identifiers or data that should not be public;
- private container/package/image references;
- screenshots containing sensitive application or account data;
- traces, reports, logs, and JSON payloads containing hidden sensitive values.

Raw execution artifacts are private by default until reviewed and sanitized.

## Governance

The showcase is a curated public representation, not a second independently maintained framework.

The governing flow is:

```text
canonical private implementation
        ↓
truth verification
        ↓
publication matrix
        ↓
public-safety review
        ↓
curated showcase representation
```

When a new capability is implemented, this matrix must be reviewed before that capability is exposed publicly. When the roadmap evolves, planned public capability descriptions must remain clearly separated from verified implementation claims.
