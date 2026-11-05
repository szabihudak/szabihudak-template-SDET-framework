# Causes

| Cause        | Typical evidence                                                                                                                                                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **env**      | The runtime or the target application's infrastructure: connection refused, DNS, 502/503, a container or the application did not start, an image pull failed, a missing secret, the runner ran out of disk, a timeout before the test acted |
| **app**      | The application contradicts the plan's Source or the provider contract: a wrong status, field or message, a 500 with a stack trace in the application log, an error page on the screenshot                                                  |
| **test**     | The test code: a lint, typecheck or formatting failure, wrong test data, tests that depend on each other's order or data, an expected value the plan's Source does not support, a timing problem                                            |
| **pipeline** | The workflow or the build: invalid workflow YAML, an action version, job permissions, the cache, dependency installation such as `npm ci` with a stale lock file                                                                            |
| **unknown**  | The evidence is missing or contradicts itself. Say what would decide it, such as a trace of the first attempt                                                                                                                               |

- Give every verdict a confidence, `high`, `medium` or `low`, and list the evidence you opened. Never present an artifact you did not open as evidence.
- An `app` verdict needs the plan's Source or the contract. Without either, the verdict is `unknown`, and the report says the application is suspected.
- Flaky is a flag on a `test` or `env` verdict, not a cause.
- A failing test may be right: when the application is wrong, the fix is in the application, never in the test.
