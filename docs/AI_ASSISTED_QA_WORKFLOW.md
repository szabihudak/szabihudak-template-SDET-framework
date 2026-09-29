# AI-Assisted QA Workflow

## Purpose

This document defines the validated AI-assisted QA workflow used by the Playwright Enterprise Framework.

The workflow combines two different categories of AI capability:

```text
Framework-Owned AI Capabilities
+
AI-Assisted Engineering
```

Framework-owned AI capabilities use the OpenAI API directly as part of framework tooling.

AI-assisted engineering uses external development assistants such as GitHub Copilot together with repository context, Golden Templates, and authoritative external context such as OpenAPI and runtime browser evidence from Playwright MCP.

AI assistance complements the existing engineering workflow.

It does not replace:

- framework architecture;
- deterministic evidence;
- Golden Templates;
- human engineering review;
- deterministic validation.

AI output must be treated as a proposal until it has passed the required review and validation gates.

---

## Core Principles

### Evidence Before Assumption

AI must prefer available evidence over inference.

Relevant evidence may include:

```text
repository implementation
repository documentation
Golden Templates
runtime browser evidence
OpenAPI contracts
test failure artifacts
```

When evidence is insufficient, the AI should explicitly report uncertainty rather than invent missing behavior.

### Repository Architecture Remains Authoritative

AI-generated implementation must follow the framework rather than introducing a parallel AI-generated architecture.

The standard decision order remains:

```text
reuse
→ extend
→ create
```

### Human Review Remains Mandatory

AI may:

- analyze;
- propose;
- generate;
- inspect;
- classify;
- validate;
- report.

The human engineer remains responsible for:

- test intent;
- architectural decisions;
- provider-contract interpretation;
- Golden Template selection;
- acceptable type-system escapes;
- abstraction boundaries;
- evidence sufficiency;
- final implementation approval.

### Deterministic Validation Remains Mandatory

An AI explanation is not validation evidence.

Generated or modified implementation must still pass the repository's deterministic validation process.

---

# End-to-End AI-Assisted QA Architecture

The current architecture contains two complementary flows.

## Test Design and Implementation Flow

```text
Requirement / User Story / Acceptance Criteria
        ↓
AI Test Scenario Generator
        ↓
structured scenarios
+ risks
+ recommended test layer
+ missing context
        ↓
Human Review
        ↓
approved scenario
        ↓
Repository Context
+ Golden Templates
+ authoritative external context when available
        ↓
Copilot / Agent
        ↓
test implementation
        ↓
Human Code Review
        ↓
formatting
+ typecheck
+ targeted execution
+ affected regression
        ↓
CI
```

For API work, authoritative external context may come from:

```text
OpenAPI MCP
```

For UI work, authoritative runtime browser context may come from:

```text
Playwright MCP
```

Playwright MCP-assisted UI engineering has been validated through a real browser exploration, repository-grounded implementation proposal, human review, and deterministic Playwright execution.

## Failure Analysis Flow

```text
Playwright Failure
        ↓
deterministic evidence collection
        ↓
sanitization
        ↓
structured failure evidence
        ↓
OpenAI API
        ↓
structured failure analysis
        ↓
Human Review
        ↓
engineering action
```

The AI Failure Analysis capability is advisory.

It does not autonomously modify framework code or test expectations.

---

# AI Failure Analysis

## Purpose

AI Failure Analysis provides structured diagnostic assistance for Playwright failures.

The capability converts deterministic failure evidence into a machine-readable context, sanitizes that context, sends it to the OpenAI Responses API, validates the returned structured analysis, and presents the result for human review.

The canonical flow is:

```text
Playwright failure
→ deterministic evidence collection
→ sanitized machine-readable failure context
→ AI analysis
→ failure classification + hypotheses
→ human review
→ optional engineering change
```

## Current Architecture

```text
src/ai/
  analyzers/
    FailureAnalyzer.ts
    OpenAIFailureAnalyzer.ts

  cli/
    analyzeFailure.ts

  prompts/
    buildFailureAnalysisPrompt.ts

  reporters/
    FailureEvidenceReporter.ts

  schemas/
    FailureAnalysisSchema.ts
    FailureEvidenceSchema.ts

  utils/
    failureEvidenceSanitizer.ts
```

The capability also reuses the generic runtime schema validation infrastructure:

```text
src/api/utils/SchemaValidator.ts
```

## Evidence Boundary

The AI receives structured failure evidence rather than unrestricted repository or environment state.

Evidence is sanitized before being sent to the model.

The capability is designed to avoid exposing credentials or other sensitive runtime information through failure analysis.

## Structured Output

The OpenAI provider uses structured output through the Responses API.

The returned analysis must satisfy the framework-owned failure-analysis schema before it is trusted.

The model is not allowed to return arbitrary unvalidated diagnostic prose as the canonical result.

## Classification Guardrail

Failure classification must reflect available evidence.

When the supplied evidence is insufficient to support a confident classification, the analysis must prefer:

```text
unknown
+
low confidence
```

rather than inventing a root cause.

This guardrail was introduced after live validation showed that an unconstrained model could over-classify failures when evidence was incomplete.

## Human Review Boundary

The AI analyzer is read-only and advisory.

It does not:

- modify test files;
- modify framework files;
- remove assertions;
- update visual baselines;
- suppress failures;
- automatically rerun arbitrary tests;
- modify CI configuration.

The human engineer reviews the structured analysis and decides whether engineering action is justified.

## Validated Workflow

The capability has been locally validated end-to-end using a live OpenAI API call:

```text
failure evidence
→ schema validation
→ sanitization
→ prompt construction
→ OpenAI Responses API
→ structured output
→ output schema validation
→ JSON result
```

The live local workflow is validated.

## Current Limitations and Remaining Hardening

The following work remains outside the currently validated local flow:

- live GitHub Actions end-to-end validation;
- stronger reporter artifact mapping for real browser failures;
- reporter filename collision handling;
- full-title and status semantics;
- first-error selection behavior;
- CLI defense-in-depth sanitization;
- OpenAI refusal and incomplete-response handling;
- trusted checkout and secret-exposure review;
- artifact-source trust review;
- job-summary Markdown injection hardening;
- Structured-output schema validation guarantees output shape, not semantic correctness. Critical semantic guardrails are currently enforced through prompt constraints and mandatory human review. Deterministic semantic validation may be introduced if recurring violations are observed or AI output begins driving automated actions.

These items must not be described as already validated.

---

# AI Test Scenario Generation

## Purpose

The AI Test Scenario Generator converts requirements into structured test-design input for human review.

It does not directly generate Playwright implementation.

The canonical flow is:

```text
Requirement / User Story
+ optional Acceptance Criteria
+ optional Framework Context
        ↓
OpenAI API
        ↓
structured TestDesign
        ↓
Human Review
        ↓
approved scenario
```

## Input

The generator accepts:

```text
requirement / user story
optional acceptance criteria
optional short framework context
```

## Structured Output

The current `TestDesign` structure contains:

```text
TestDesign
├── summary
├── risks[]
├── scenarios[]
│   ├── title
│   ├── type
│   │   ├── positive
│   │   ├── negative
│   │   └── boundary
│   ├── recommendedLayer
│   │   ├── api
│   │   ├── ui
│   │   ├── database
│   │   ├── contract
│   │   └── unknown
│   ├── reason
│   ├── preconditions[]
│   └── expectedOutcome
└── missingContext[]
```

## Missing Context

`missingContext` is an explicit anti-hallucination mechanism.

When required product or contract information is unavailable, the generator should report the missing information rather than invent it.

Similarly:

```text
recommendedLayer: unknown
```

is valid when the available information is insufficient to determine the correct test layer.

## Provider-Behavior Guardrail

The generator must not invent specific provider behavior.

The validated prompt contains the following guardrail:

```text
Do not include specific error-response behavior, status codes, messages, fields, or validation semantics in expected outcomes unless explicitly provided.

When mechanism is known but response contract is unknown, keep expected outcome behavioral and record missing details in missingContext.
```

For example, when a required task title is absent but the exact API error contract is unknown, an acceptable expected outcome is:

```text
Task creation does not succeed because the required title is absent.
```

The generator should not invent a status code, error field, or error message unless that information was provided.

## Current Implementation

```text
src/ai/
  generators/
    TestScenarioGenerator.ts
    OpenAITestScenarioGenerator.ts

  prompts/
    buildTestDesignPrompt.ts

  schemas/
    TestDesignSchema.ts
    TestDesignInputSchema.ts

  cli/
    generateTestDesign.ts
```

The CLI is exposed through:

```text
npm run ai:generate-test-design
```

Example validated invocation:

```text
npm run ai:generate-test-design -- test-results/ai-test-design-input/task-creation.json
```

Example output:

```text
test-results/ai-test-design/task-creation-test-design.json
```

## Validated Workflow

The capability has been validated through a live OpenAI API execution.

The validated flow is:

```text
requirement input
→ input schema
→ prompt
→ OpenAI Responses API
→ structured TestDesign
→ output schema validation
→ human-readable JSON artifact
```

The validated example produced scenarios covering task priorities, missing required data, and persistence considerations while reporting missing provider-contract information rather than inventing it.

## Scope Boundary

The Test Scenario Generator does not currently:

- generate Playwright spec files;
- modify repository files;
- execute tests;
- explore the browser;
- generate locators;
- query OpenAPI through MCP;
- use RAG or a vector database;
- autonomously implement generated scenarios.

Actual implementation happens after human review through the AI-assisted engineering workflow.

---

# Repository Context for AI Engineering

AI-assisted implementation must be grounded in repository-owned engineering context.

Before proposing or modifying code, the AI assistant must read and follow:

```text
.github/copilot-instructions.md
AGENTS.md
docs/ARCHITECTURE.md
docs/TESTING_STANDARDS.md
relevant ADRs
```

The assistant must also inspect existing implementations analogous to the requested change.

Repository instructions define the engineering constraints.

Existing validated implementations define the Golden Templates.

Both are required context.

---

# Golden Template Principle

A Golden Template is a documented reference pattern derived from an already existing and validated canonical implementation.

The lifecycle is:

```text
existing validated canonical implementation
        ↓
documented Golden Template
        ↓
future human or AI-assisted implementation
```

A pattern does not become a Golden Template merely because it has been documented.

The implementation must exist and be validated first.

When an existing validated implementation has the same responsibility as the requested change, AI-assisted development must use it as the primary implementation reference.

Relevant characteristics may include:

- test placement;
- execution project;
- fixture usage;
- factory usage;
- naming;
- request flow;
- schema validation;
- assertion ownership;
- API client usage;
- constants;
- Page Object ownership;
- Component Object ownership;
- interaction patterns;
- assertion placement and style;
- locator ownership;
- formatting;
- code organization.

Golden Template compliance means following the validated reference not only behaviorally and architecturally, but also structurally and stylistically where the same responsibility already has an established pattern.

Existing implementations are references to follow deliberately, not code to copy blindly.

---

# Copilot-Assisted Test Generation

## Workflow

The validated Copilot-assisted generation workflow is:

```text
Test Scenario
        ↓
Repository Context
        ↓
Golden Template Discovery
        ↓
Copilot Proposal
        ↓
Human Review
        ↓
Targeted Feedback
        ↓
Copilot Implementation
        ↓
Deterministic Validation
        ↓
Human Approval
```

The initial AI interaction should be review-first.

The assistant should not immediately modify files.

---

## Reusable Test Generation Prompt Template

```text
Before proposing any code, read and follow:

- .github/copilot-instructions.md
- AGENTS.md
- docs/ARCHITECTURE.md
- docs/TESTING_STANDARDS.md
- relevant ADRs referenced by those documents

Treat .github/copilot-instructions.md as the repository-level AI engineering instruction source and follow its rules throughout this task.

If these documents point to existing validated implementations as canonical or Golden Template references, inspect and follow those implementations before proposing new code.

We want to add coverage for this scenario:

{{TEST_SCENARIO}}

Before proposing the change:

1. Inspect the relevant existing implementation and documentation.
2. Identify the existing validated tests and their owning framework components that should act as the Golden Template.
3. Reuse the existing architecture and patterns rather than introducing new abstractions.

Treat the selected validated tests and their owning framework components as the Golden Template.

The proposed implementation must follow the Golden Template not only behaviorally and architecturally, but also structurally and stylistically where applicable, including:

- test organization and placement
- Page Object / Component Object ownership
- fixture usage
- factory usage
- naming conventions
- Arrange / Act / Assert structure
- interaction patterns
- assertion placement and style
- locator ownership
- client usage
- schema validation pattern
- constants and shared utilities
- formatting and code style

Do not introduce a different test structure, ownership model, interaction pattern, or coding pattern when an equivalent validated pattern already exists.

Important constraints:

- Follow the repository architecture and testing standards.
- Prefer reuse → extend → create.
- Prefer the smallest architecturally complete change.
- Do not weaken shared domain types merely to support malformed test data.
- Do not introduce abstractions solely for a single scenario.
- Do not invent provider behavior that is not established by repository or authoritative contract evidence.
- If the repository does not provide enough evidence for a specific assertion, explicitly identify that uncertainty instead of guessing.

Do not modify any files yet.

First provide:

1. Which existing test or implementation you selected as the Golden Template and why.
2. Which repository documentation and instructions you used.
3. Whether the requested scenario is already covered.
4. The exact minimal code diff you propose.
5. An explanation of how the proposed code follows the Golden Template behaviorally, architecturally, structurally, and stylistically.
6. Any assertions or expected behavior that cannot be safely determined from the available evidence.

Wait for human review before applying any changes.
```

---

# Validated Copilot Test Generation Example

The first validated Copilot-assisted implementation used the scenario:

```text
Task creation is rejected when priority is outside the supported values:
low, medium, high.
```

Copilot identified the existing negative create-task validation tests as the relevant Golden Template.

The initial proposal used a broad object-level cast:

```ts
const taskData = {
  ...createTask(),
  priority: "critical",
} as Partial<TaskRequest>;
```

Human review identified that this surrendered more type safety than necessary.

---

# Validated Human Feedback Prompt

The following feedback was given to Copilot:

```text
The proposed change is close, but make two refinements.

1. Do not cast the entire task payload to Partial<TaskRequest>.

Keep the valid baseline object strongly typed and make the intentional runtime-invalid value explicit only at the priority field.

Use the smallest possible local type escape:

priority: "critical" as TaskRequest["priority"]

2. Do not place this test between the existing default-value behavior tests.

Place it with the existing negative/validation task-creation scenarios, near the missing-field validation tests that you identified as the Golden Template. Preserve the existing logical organization of create-task.spec.ts.

Now generate and apply the final code change to create-task.spec.ts only.

Do not make any other changes.
```

Copilot then generated:

```ts
test("rejects task with unsupported priority", async ({
  taskApi,
  authenticatedTestUser,
}) => {
  const user = authenticatedTestUser;
  const taskData = {
    ...createTask(),
    priority: "critical" as TaskRequest["priority"],
  };

  const response = await taskApi.createTask(taskData, user.accessToken);
  expect(response.status()).toBe(HTTP_STATUS.BAD_REQUEST);

  const body = await response.json();

  expect(body.error).toBe(API_ERRORS.VALIDATION_FAILED);
});
```

This preserves:

```text
createTask()
→ strongly typed valid baseline

priority
→ explicit scenario-owned malformed runtime value

TaskPriority
→ remains strict
```

No shared factory or domain type was weakened.

## Validation

The generated implementation passed:

```text
Prettier
→ PASS

TypeScript typecheck
→ PASS

targeted create-task API execution
→ PASS
```

The implementation was reviewed before commit and push.

---

# Copilot Agent Engineering Validation

Copilot Agent is used differently from assisted code generation.

The distinction is:

```text
Copilot-Assisted Generation
→ human drives individual implementation steps
→ Copilot proposes/generates
→ human reviews

Copilot Agent
→ receives bounded engineering objective
→ independently discovers repository context
→ determines whether modification is necessary
→ selects and runs validation
→ reports evidence and uncertainty
```

A successful Agent task does not require code modification.

Correctly determining that no change is necessary is a valid engineering result.

---

# Reusable Agent Validation Prompt

```text
Before making changes, read and follow:

- .github/copilot-instructions.md
- AGENTS.md
- docs/ARCHITECTURE.md
- docs/TESTING_STANDARDS.md
- relevant ADRs

Use existing validated implementations as Golden Templates.

Treat the selected validated tests and their owning framework components as Golden Templates not only behaviorally and architecturally, but also structurally and stylistically where applicable.

Task:

Review the implementation for:

{{IMPLEMENTATION_OR_SCENARIO}}

Treat this as an engineering validation task, not just a code-generation task.

Independently:

1. Inspect the relevant constants, schemas, factories, clients, fixtures, tests, and other owning framework layers.
2. Verify that the implementation follows the repository architecture, testing standards, and existing Golden Template.
3. Verify structural and stylistic consistency with the Golden Template, including test placement, responsibility ownership, interaction patterns, assertion placement, naming, and code organization.
4. Check for unnecessary type weakening, duplicated abstractions, invented behavior, or inconsistent structure.
5. Determine the appropriate repository validation commands for this change.
6. Run the relevant formatting, type-checking, and targeted test validation.
7. If you identify a justified code issue, make the smallest architecturally complete correction and validate it.
8. Do not change code merely for stylistic preference when the existing implementation already follows repository standards.
9. Do not commit or push anything.

At the end, report:

- files inspected;
- repository rules and Golden Templates used;
- whether any code changes were necessary;
- validation commands executed;
- validation results;
- any remaining uncertainty.

Do not ask the human to perform steps that you can safely perform yourself in the repository.
```

---

# Validated Copilot Agent Example

The unsupported-priority test was subsequently given to Copilot Agent as an engineering validation task.

The Agent independently inspected:

```text
create-task.spec.ts
task.ts
TaskRequestSchema.ts
taskFactory.ts
TaskApiClient.ts
test-fixtures.ts
```

It also used:

```text
.github/copilot-instructions.md
AGENTS.md
docs/ARCHITECTURE.md
docs/TESTING_STANDARDS.md
ADR-003
ADR-004
```

The Agent selected the existing create-task validation tests as the Golden Template.

It correctly determined:

```text
architecture
→ preserved

factory pattern
→ preserved

TaskPriority
→ not weakened

new abstraction
→ unnecessary

code correction
→ unnecessary
```

The correct Agent outcome was:

```text
no code changes necessary
```

## Agent Validation Evidence

The Agent executed:

```text
npx prettier --check tests/api/create-task.spec.ts
→ PASS

npx tsc --noEmit --pretty false
→ PASS

targeted unsupported-priority test
→ PASS

complete create-task API spec
→ 8 passed
```

The Agent also reported the remaining evidence boundary:

```text
exact field-level invalid-enum response
→ not established
→ intentionally not asserted
```

This validated Copilot Agent as a repository-aware engineering reviewer and validation executor.

---

# OpenAPI MCP-Assisted API Engineering

## Purpose

Repository evidence describes how the framework currently represents and tests an API.

It is not necessarily the authoritative definition of the external provider contract.

For API engineering, OpenAPI MCP provides an additional context source:

```text
Repository Context
+ Golden Templates
+ OpenAPI Contract
        ↓
Copilot Agent
```

This allows the Agent to distinguish:

```text
what the provider documents
```

from:

```text
what the framework currently implements or assumes
```

This is especially useful when deciding:

- valid enum values;
- required request fields;
- authentication requirements;
- documented response statuses;
- endpoint paths;
- HTTP methods.

## Context Boundary

OpenAPI MCP is currently used for contract discovery.

The validated POC intentionally did not use MCP to execute the real API.

The desired responsibility is:

```text
OpenAPI specification
        ↓
read / explore
        ↓
contract evidence
        ↓
Copilot Agent reasoning
```

not:

```text
Agent
→ uncontrolled provider API execution
```

---

# OpenAPI MCP Contract Discovery Prompt

The following prompt was used for the first validated OpenAPI MCP POC:

```text
Use the configured OpenAPI MCP server.

Inspect the UPEX API contract for task creation.

OpenAPI documentation:
https://dojo.upexgalaxy.com/api/docs

Find the machine-readable OpenAPI specification behind that documentation if necessary.

For the task-creation endpoint, report only:

- HTTP method
- path
- required request fields
- allowed priority values
- documented success response status
- documented validation-error response status
- documented authentication requirement

Do not modify any files.
Do not call the API.
Use the OpenAPI MCP tools for contract discovery rather than relying only on repository code.
Clearly distinguish contract evidence from repository evidence.
```

## Validated Result

The Agent discovered the machine-readable specification:

```text
https://dojo.upexgalaxy.com/api/swagger.json
```

It reported the following contract evidence:

```text
HTTP method
→ POST

Path
→ /api/tasks

Required request fields
→ title

Allowed priority values
→ low
→ medium
→ high

Success response
→ 201 Created

Validation response
→ 400 Bad Request

Authentication
→ bearerAuth
→ HTTP Bearer JWT
```

It separately reported that the repository's task schema and constants matched the OpenAPI contract.

This validated that Copilot Agent could use MCP-provided provider-contract context independently from repository evidence.

---

# OpenAPI MCP-Assisted Test Proposal Prompt

The next POC combined:

```text
repository context
+
Golden Template
+
OpenAPI contract
```

using the following prompt:

```text
Before proposing code, read and follow:

- .github/copilot-instructions.md
- AGENTS.md
- docs/ARCHITECTURE.md
- docs/TESTING_STANDARDS.md
- relevant ADRs

Also use the configured OpenAPI MCP server as an authoritative API contract source.

Scenario:

"Task creation is rejected when priority is outside the supported values: low, medium, high."

Requirements:

1. Inspect the existing create-task API tests and identify the Golden Template.
2. Use the OpenAPI MCP tools to inspect the task-creation contract.
3. Clearly separate:
   - OpenAPI contract evidence
   - repository evidence
4. Determine whether the scenario is already covered.
5. Propose the smallest architecturally complete test change.
6. Do not weaken TaskPriority or shared factory types.
7. Keep any runtime-invalid value explicit and local to the negative test.
8. Do not invent field-level error messages or validation payload details unless the OpenAPI contract explicitly defines them.
9. Follow the selected Golden Template behaviorally, architecturally, structurally, and stylistically where applicable.
10. Do not modify files yet.
11. Do not call the real API.

Report:

- Golden Template selected
- OpenAPI contract evidence
- repository evidence
- whether coverage already exists
- exact proposed diff
- any remaining uncertainty
```

---

# Validated OpenAPI MCP Test Proposal

The Agent selected the existing missing-field validation tests in `create-task.spec.ts` as the Golden Template.

It identified the relevant framework pattern:

```text
api project
authenticatedTestUser
createTaskPayload / createTask
TaskApiClient.createTask
HTTP_STATUS
API_ERRORS
negative response assertions in the spec
no successful-response schema validation for negative responses
```

## OpenAPI Contract Evidence

The Agent reported:

```text
POST /api/tasks

required field
→ title

priority
→ low | medium | high

success
→ 201 Created

validation
→ 400 Bad Request

authentication
→ bearerAuth
```

## Repository Evidence

The Agent independently inspected:

```text
task.ts
TaskRequestSchema.ts
taskFactory.ts
TaskApiClient.ts
test-fixtures.ts
create-task.spec.ts
```

It also used the repository engineering guidance and relevant ADRs.

## Evidence Boundary

The AI receives structured failure evidence rather than unrestricted repository or environment state.

Evidence is sanitized before being sent to the model.

The capability is designed to avoid exposing credentials or other sensitive runtime information through failure analysis.

The current AI-visible failure evidence includes:

- test title and full title path;
- test file and Playwright project;
- execution environment and retry number;
- sanitized failure message and stack;
- available failure artifact types;
- sanitized failure artifact paths.

Failure artifacts such as screenshots, Playwright traces, and videos may be recorded in the structured failure evidence by artifact type and sanitized path.

Their binary, visual, or internal contents are not currently sent to the OpenAI API.

Therefore:

```text
artifact exists
→ AI may know that additional diagnostic evidence is available

artifact contents
→ AI has not inspected them
→ AI must not treat their contents as observed evidence
```

For example, when the failure evidence contains:

```text
screenshot
trace
```

the model may recommend that a human engineer inspect those artifacts, but it must not claim that the screenshot or trace confirms a particular application state unless that state is independently present in the supplied structured evidence.

The current AI-visible evidence does not include:

- screenshot pixels;
- Playwright trace contents;
- video contents.

Multimodal screenshot analysis or deterministic extraction of selected trace evidence may be introduced later as separate capabilities.

Such capabilities would require explicit review of their privacy, sanitization, cost, and evidence-trust boundaries before becoming part of the validated failure-analysis workflow.

## Proposed Implementation

The Agent independently arrived at the same implementation pattern that had previously passed human review:

```ts
test("rejects task with unsupported priority", async ({
  taskApi,
  authenticatedTestUser,
}) => {
  const user = authenticatedTestUser;
  const taskData = {
    ...createTask(),
    priority: "critical" as TaskRequest["priority"],
  };

  const response = await taskApi.createTask(taskData, user.accessToken);
  expect(response.status()).toBe(HTTP_STATUS.BAD_REQUEST);

  const body = await response.json();

  expect(body.error).toBe(API_ERRORS.VALIDATION_FAILED);
});
```

The POC did not apply this change because the test had already been implemented and validated previously.

The purpose of this execution was to validate the additional OpenAPI MCP evidence source.

---

# OpenAPI MCP POC Conclusion

The validated workflow is:

```text
API Test Scenario
        ↓
Repository Instructions
+ Architecture
+ Testing Standards
+ Golden Template
        +
OpenAPI MCP
        ↓
Contract Evidence
+ Repository Evidence
        ↓
Copilot Agent
        ↓
Evidence-Grounded Test Proposal
        ↓
Human Review
```

The important improvement over repository-only reasoning is that provider-contract facts can now be grounded independently.

For example:

```text
priority values
→ OpenAPI contract evidence

400 validation response
→ OpenAPI contract evidence

framework test structure
→ repository / Golden Template evidence

TaskPriority representation
→ repository evidence

exact field-level error message
→ not established
→ not asserted
```

This separation prevents repository assumptions from being incorrectly treated as provider-contract facts.

---

# Playwright MCP-Assisted UI Engineering

## Purpose

Playwright MCP provides runtime browser evidence for AI-assisted UI engineering.

Repository evidence describes how the framework is architected and how UI tests should be implemented.

Playwright MCP provides a complementary evidence source:

```text
Repository Context
+ Golden Templates
+ Playwright MCP Browser Evidence
        ↓
Copilot Agent
```

The responsibility boundary is:

```text
Playwright MCP
→ observe the real running application
→ discover current browser behavior
→ identify accessible roles, names, fields, actions, and runtime uncertainty

Repository
→ define framework architecture
→ define Page Object / Component Object ownership
→ define fixtures, factories, test placement, and validation rules
```

Browser evidence does not override repository architecture.

---

## Validated Browser Exploration

The first Playwright MCP POC explored the UPEX task-creation UI at:

```text
https://dojo.upexgalaxy.com
```

The initial exploration intentionally performed no repository modification and did not generate test code.

### Initial Exploration Prompt

```text
Use the configured Playwright MCP server.

Explore the UPEX application at:

https://dojo.upexgalaxy.com

Goal:

Inspect the task-creation UI and collect browser evidence that could later support generation of a Playwright UI test.

Use Playwright MCP to inspect the real running application.

Report only:

- how the task-creation flow is reached
- relevant accessible roles and names
- relevant form fields
- available priority options
- submit action
- observable successful task-creation behavior
- any UI behavior or element that cannot be determined confidently

Requirements:

- Use Playwright MCP browser tools for the exploration.
- Clearly distinguish browser evidence from assumptions.
- Do not modify repository files.
- Do not generate test code yet.
- Do not commit or push anything.
- Do not perform destructive actions beyond creating one test task if creation is necessary to observe the successful flow.

At the end, report the browser evidence collected and any remaining uncertainty.
```

The initial exploration reached the authenticated task dashboard and identified the `New Task` action.

However, the task-creation form was not reliably represented in the initial accessibility snapshot after the action was triggered.

Instead of inventing the missing UI structure, the Agent reported the uncertainty.

This triggered a second targeted investigation.

---

## Targeted Browser Investigation Prompt

```text
Use Playwright MCP to investigate why the "New Task" action does not expose the task-creation UI.

Do not modify repository files.
Do not generate test code.
Do not create data unless required.

Investigate:
- whether the click actually fires;
- whether the URL changes;
- whether a dialog, portal, drawer, popover, or hidden region appears;
- whether the button is disabled or blocked;
- whether there are relevant browser console errors;
- whether there are relevant network requests after the click;
- whether the current task limit or application state prevents creation.

Report only observed browser evidence and remaining uncertainty.
```

## Browser Evidence Collected

The targeted investigation established:

```text
authenticated page
→ /dashboard

New Task button
→ visible
→ enabled
→ click fires

URL after click
→ remains /dashboard

task creation request
→ no POST occurs merely from opening the dialog

dialog
→ visible
→ role: dialog
→ heading: Create New Task
```

The form contained:

```text
Title
→ textbox
→ placeholder: Enter task title

Description (optional)
→ textbox
→ placeholder: Enter task description

Priority
→ combobox
→ default: Medium
→ options:
   - Low
   - Medium
   - High

actions
→ Cancel
→ Create Task
→ Close
```

The browser investigation also established the behavior used for the first MCP-assisted UI scenario:

```text
empty Title
→ Create Task disabled

Title contains a value
→ Create Task enabled
```

No task submission was required to observe this behavior.

No task was created during this investigation.

---

## Accessibility-Tree Observation

The exploration also exposed an important runtime uncertainty.

The task-creation dialog was visibly rendered in the browser, but its representation in the accessibility tree was initially inconsistent.

Observed behavior included an `aria-hidden` state affecting the dialog/background representation.

A console warning was also observed related to missing dialog description metadata.

The exact product-level cause was not established during this POC.

Therefore:

```text
observed accessibility-tree inconsistency
→ recorded as runtime evidence

exact root cause
→ unknown

speculative framework workaround
→ not introduced
```

The later Playwright test successfully located and interacted with the required elements through the selected role-based locators.

Therefore the observed uncertainty did not justify changing the framework locator strategy during this POC.

---

# Playwright MCP-Assisted Test Proposal

The first selected scenario was:

```text
The Create Task button remains disabled until a task title is entered.
```

This scenario was selected because it was:

- directly supported by browser evidence;
- non-destructive;
- observable without submitting the form;
- suitable for validating MCP browser evidence together with repository architecture.

## Proposal Prompt

```text
Before proposing code, read and follow:

- .github/copilot-instructions.md
- AGENTS.md
- docs/ARCHITECTURE.md
- docs/TESTING_STANDARDS.md
- relevant ADRs

Use existing validated implementations as Golden Templates.

Also use the configured Playwright MCP server as an authoritative source of browser evidence for the running UPEX application.

Scenario:

"The Create Task button remains disabled until a task title is entered."

Requirements:

1. Inspect the existing UI tests for task creation and identify the most relevant Golden Template.
2. Inspect the existing TasksDashboardPage, relevant components, fixtures, factories, and authenticated browser setup.
3. Use Playwright MCP to confirm the real current UI behavior and accessible element names for:
   - opening the New Task dialog;
   - locating the Title field;
   - locating the Create Task button;
   - confirming the button is disabled with an empty title;
   - confirming the button becomes enabled after entering a title.
4. Clearly separate:
   - Playwright MCP browser evidence
   - repository evidence
5. Determine whether this scenario is already covered.
6. Propose the smallest architecturally complete test change.
7. Reuse existing Page Objects and Component Objects where they already own the relevant interaction.
8. Do not place reusable UI interaction directly in the spec if the existing architecture assigns that responsibility to a Page Object or Component Object.
9. Treat the selected validated tests and their owning framework components as the Golden Template.
10. Follow the Golden Template not only behaviorally and architecturally, but also structurally and stylistically where applicable, including:
    - test organization and placement
    - Page Object / Component Object ownership
    - fixture usage
    - factory usage
    - naming conventions
    - Arrange / Act / Assert structure
    - interaction patterns
    - assertion placement and style
    - locator ownership
    - constants and shared utilities
    - formatting and code style
11. Do not introduce a different test structure or interaction pattern when an equivalent validated pattern already exists.
12. Do not introduce selectors, test IDs, helpers, fixtures, or abstractions unless the existing implementation cannot express the behavior cleanly.
13. Do not create task data or submit the form.
14. Do not modify files yet.
15. Do not commit or push anything.

Report:

- Golden Template selected
- Playwright MCP browser evidence
- repository evidence
- whether coverage already exists
- exact files that would need to change
- exact proposed diff
- explanation of how the proposal follows the Golden Template behaviorally, architecturally, structurally, and stylistically
- any remaining uncertainty

Wait for human review before applying any changes.
```

---

# Human Review of the MCP-Assisted Proposal

Copilot correctly identified:

```text
TasksDashboardPage
→ owning Page Object

task-dashboard.spec.ts
→ owning UI spec

authenticated UI fixtures
→ existing setup

existing UI implementation
→ Golden Template
```

The initial proposal was functionally reasonable but contained:

```ts
await tasksDashboardPage.taskTitleInput.fill("UI validation task");
```

directly in the spec.

Human review compared this proposal with the existing repository implementations.

Existing canonical examples such as:

```text
LoginPage.login()
RegisterPage.register()
NavigationBar.openUserMenu()
```

keep reusable page-level interaction inside the owning Page Object or Component Object.

The spec primarily orchestrates the scenario and owns assertions.

Therefore the proposal was refined to:

```text
interaction
→ Page Object / Component Object

assertion target
→ locator exposed by Page Object / Component Object

assertion
→ spec
```

The resulting Page Object action became:

```ts
async fillTaskTitle(title: string): Promise<void> {
  await this.taskTitleInput.fill(title);
}
```

while the spec retained:

```ts
await expect(tasksDashboardPage.createTaskButton).toBeDisabled();

await tasksDashboardPage.fillTaskTitle("UI validation task");

await expect(tasksDashboardPage.createTaskButton).toBeEnabled();
```

---

# Golden Template Structural Compliance

This POC established an additional requirement for AI-assisted engineering.

Golden Template compliance does not mean only producing equivalent behavior.

The AI must follow the selected Golden Template:

```text
behaviorally
+
architecturally
+
structurally
+
stylistically
```

where the same responsibility already has an established repository pattern.

The reusable prompt requirement is:

```text
Treat the selected validated tests and their owning framework components as the Golden Template.

Follow the Golden Template not only behaviorally and architecturally,
but also structurally and stylistically where applicable, including:

- test organization and placement
- Page Object / Component Object ownership
- fixture usage
- factory usage
- naming conventions
- Arrange / Act / Assert structure
- interaction patterns
- assertion placement and style
- locator ownership
- constants and shared utilities
- formatting and code style

Do not introduce a different test structure or interaction pattern when
an equivalent validated pattern already exists.
```

This requirement is important because AI-generated code can be technically correct while still drifting from the framework's established implementation pattern.

Human review must detect this form of architectural and structural drift.

---

# Validated Playwright MCP Implementation

The final implementation extended `TasksDashboardPage` with ownership of the task-creation interaction:

```ts
readonly newTaskButton: Locator;
readonly taskTitleInput: Locator;
readonly createTaskButton: Locator;
```

and:

```ts
async openNewTaskDialog(): Promise<void> {
  await this.newTaskButton.click();
}

async fillTaskTitle(title: string): Promise<void> {
  await this.taskTitleInput.fill(title);
}
```

The UI spec expressed the scenario at the intent/assertion level:

```ts
test("keeps Create Task disabled until a title is entered", async ({
  tasksDashboardPage,
}) => {
  await tasksDashboardPage.goto();
  await tasksDashboardPage.openNewTaskDialog();

  await expect(tasksDashboardPage.createTaskButton).toBeDisabled();

  await tasksDashboardPage.fillTaskTitle("UI validation task");

  await expect(tasksDashboardPage.createTaskButton).toBeEnabled();
});
```

No task was submitted by the test.

No new fixture, factory, helper, test ID, or abstraction was introduced.

---

# Playwright MCP Validation Evidence

The implementation passed:

```text
Prettier
→ PASS

TypeScript typecheck
→ PASS

task-dashboard.spec.ts / Chromium
→ 3 passed
```

The targeted scenario passed together with the existing task-dashboard UI tests.

The validated flow is therefore:

```text
Playwright MCP Browser Exploration
        ↓
runtime browser evidence
+ explicit uncertainty
        ↓
Repository Context
+ Golden Template
        ↓
Copilot Agent Proposal
        ↓
Human Architecture Review
        ↓
Golden Template Structural Refinement
        ↓
Implementation
        ↓
Prettier
+ TypeScript
+ Chromium UI execution
        ↓
PASS
```

Playwright MCP-assisted UI engineering is now a validated capability of the AI-assisted QA workflow.

---

# Human Review and Validation Gates

AI-assisted implementation follows explicit review gates.

## Proposal Gate

Before implementation:

```text
scenario
→ evidence discovery
→ Golden Template discovery
→ proposed change
→ human review
```

The reviewer checks:

- correct responsibility;
- correct test layer;
- correct execution project;
- correct Golden Template;
- behavioral Golden Template consistency;
- architectural Golden Template consistency;
- structural and stylistic Golden Template consistency;
- appropriate evidence;
- existing component reuse;
- domain type preservation;
- absence of unnecessary abstractions;
- absence of invented behavior;
- smallest architecturally complete change.

## Implementation Gate

Only after proposal review should the AI apply the approved change.

The implementation scope should remain bounded to the reviewed task.

Unrelated cleanup should not be introduced.

## Validation Gate

At minimum:

```text
format
↓
typecheck
↓
targeted test execution
```

Broader affected regression should run when the change affects shared behavior.

Repository-specific validation rules in `docs/TESTING_STANDARDS.md` remain authoritative.

## Commit Gate

AI-generated code should not be considered complete merely because generation succeeded.

The expected sequence is:

```text
AI implementation
→ human review
→ deterministic validation
→ approval
→ commit
→ push
```

---

# Prompt Engineering Principles Established So Far

The validated workflows have demonstrated several reusable prompt-engineering principles.

## Provide Explicit Context Sources

Prefer:

```text
Read:
- repository instructions
- architecture
- testing standards
- relevant ADRs
```

rather than assuming the assistant will discover every relevant source automatically.

## Require Golden Template Discovery

Ask the assistant to identify the analogous validated implementation before proposing new code.

This grounds generation in actual framework patterns.

## Require Structural Golden Template Compliance

Identifying a Golden Template is not sufficient.

The prompt should explicitly require the AI to follow the selected reference:

```text
behaviorally
architecturally
structurally
stylistically
```

where applicable.

This includes responsibility ownership, interaction patterns, assertion placement, test organization, fixture and factory usage, naming, and code style.

A generated implementation can be functionally correct while still violating the framework's established pattern.

## Separate Evidence Sources

When multiple evidence sources exist, require explicit separation.

For example:

```text
OpenAPI contract evidence
vs
repository evidence
```

or:

```text
Playwright MCP browser evidence
vs
repository evidence
```

This makes unsupported assumptions easier to detect.

## Require Uncertainty Reporting

Prompts should explicitly permit:

```text
unknown
insufficient evidence
remaining uncertainty
```

This is preferable to forcing a confident answer.

## Use Review-First Generation

Prefer:

```text
analyze
→ propose
→ human review
→ apply
```

over immediately granting modification authority.

## Bound Agent Authority

State explicitly when the Agent must not:

- modify files;
- call a real API;
- create unnecessary application data;
- commit;
- push;
- introduce unrelated cleanup.

## Prefer Evidence-Grounded Negative Testing

Negative scenarios are particularly prone to invented:

- status codes;
- error fields;
- error messages;
- validation semantics.

Require authoritative evidence before asserting these details.

## Separate Runtime Evidence from Framework Architecture

MCP browser evidence can establish what the running application currently does.

It does not determine how framework code should be structured.

The responsibility split remains:

```text
Playwright MCP
→ runtime browser evidence

repository standards + Golden Templates
→ implementation architecture
```

---

# Current Validated Capability Status

```text
Framework-Owned AI

AI Failure Analysis
→ IMPLEMENTED
→ LOCAL LIVE VALIDATION COMPLETE

AI Test Scenario Generation
→ IMPLEMENTED
→ LOCAL LIVE VALIDATION COMPLETE


AI-Assisted Engineering

Repository AI Instructions
→ VALIDATED

Semantic Repository Context
→ VALIDATED

Golden Template Discovery
→ VALIDATED

Golden Template Structural Compliance
→ VALIDATED

Copilot-Assisted Test Generation
→ VALIDATED

Human Feedback / Refinement Loop
→ VALIDATED

Copilot Agent Engineering Validation
→ VALIDATED

Copilot Agent Deterministic Validation
→ VALIDATED

OpenAPI MCP Contract Discovery
→ VALIDATED

OpenAPI MCP + Repository Evidence Separation
→ VALIDATED

OpenAPI MCP-Assisted Test Proposal
→ VALIDATED

Playwright MCP Browser Exploration
→ VALIDATED

Playwright MCP + Repository Evidence Separation
→ VALIDATED

Playwright MCP-Assisted UI Test Generation
→ VALIDATED
```

---

# Not Yet Validated

The following capability is intentionally not described as an established Golden Template yet:

```text
Cursor-Assisted Engineering
→ NOT YET VALIDATED
```

It should be added to the validated workflow only after a real POC has been executed, reviewed, and validated.

Additional hardening work also remains for the AI Failure Analysis CI workflow.

---

# Target AI-Assisted QA Workflow

The intended integrated workflow is:

```text
Requirement / User Story / Acceptance Criteria
        ↓
AI Test Scenario Generator
        ↓
structured TestDesign
├── scenarios
├── risks
├── recommended test layer
└── missing context
        ↓
Human Review
        ↓
approved scenario
        ↓
Repository Context
├── .github/copilot-instructions.md
├── AGENTS.md
├── ARCHITECTURE.md
├── TESTING_STANDARDS.md
├── ADRs
└── Golden Templates
        +
Authoritative External Context
├── API → OpenAPI MCP
└── UI  → Playwright MCP
        ↓
Copilot / Agent
        ↓
evidence-grounded test proposal
        ↓
Human Review
        ↓
implementation
        ↓
format
+ typecheck
+ targeted execution
+ affected regression
        ↓
Human Approval
        ↓
CI
```

The complementary failure workflow is:

```text
Test Execution
        ↓
Failure
        ↓
FailureEvidenceReporter
        ↓
structured + sanitized evidence
        ↓
AI Failure Analysis
        ↓
classification
+ hypotheses
+ uncertainty
        ↓
Human Review
        ↓
engineering decision
```

Together these capabilities establish the current direction of the framework:

```text
AI assists with
design
+ context discovery
+ implementation
+ validation
+ failure analysis

while

humans retain
engineering judgment
+ architecture ownership
+ approval authority

and

deterministic tooling retains
validation authority
```

This is the canonical AI-assisted QA workflow until additional capabilities are implemented and validated.
