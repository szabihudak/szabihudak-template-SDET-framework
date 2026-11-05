# CI failure analysis: <workflow> run #<number>, attempt <n>

Run: <run URL> · Attempt: <n> of <attempts> · Commit: <short sha> · Branch: <branch> · Event: <event> · Date: <YYYY-MM-DD>
Failed jobs: <names> · Skipped because of them: <names, or none>
Findings: env <n> · app <n> · test <n> · pipeline <n> · unknown <n>
Earlier attempts: <attempt <m>: <its findings line>, resolved / still failing; or none analyzed>

## F1 · <job> · <env | app | test | pipeline | unknown> · confidence: <high | medium | low>

- **Job:** <job name> (<job log URL>)
- **Cause:** <cause>, flaky: <yes | no>
- **Failed test case:** <case ID: title>, or not a test failure
  - Description: <the plan's case, or not planned>
  - Expected: <the plan's expected result and its source>
  - Actual: <the observed result>
- **Analysis:** <what the evidence shows, in order>
- **Verdict:** <cause>, because <the reasoning>
- **Suggested fix:** <what to change>; owner: <test code | application developers | infrastructure | CI>
- **Also affected:** <other tests with the same root cause, or none>
- **Evidence:**
  - Log: <job log URL>#step:<step>:<line>
  - Screenshot: [<file>](artifacts/<artifact>/<path>)
  - Video: [<file>](artifacts/<artifact>/<path>)
  - Trace: [<file>](artifacts/<artifact>/<path>), open with `npx playwright show-trace <path>`
  - Application log: <job log URL>#step:<step>:<line>
  - Artifact: <artifact URL>, kept for <retention> days
  - Not available: <evidence that would help but does not exist, or none>
