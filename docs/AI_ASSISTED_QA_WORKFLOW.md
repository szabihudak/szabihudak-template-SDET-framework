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

AI-assisted engineering uses external development assistants such as GitHub Copilot together with repository context, Golden Templates, and authoritative external context such as OpenAPI.

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
runtime evidence
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

For future UI work, browser context may come from:

```text
Playwright MCP
```

Playwright MCP is not yet validated as part of this workflow.

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
- job-summary Markdown injection hardening.

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
- formatting;
- code organization.

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
2. Identify the existing validated tests that should act as the Golden Template.
3. Reuse the existing architecture and patterns rather than introducing new abstractions.

Treat the selected validated tests as the Golden Template.

The proposed test must follow the Golden Template not only architecturally and behaviorally, but also structurally and stylistically where applicable, including:

- test organization and placement
- fixture usage
- factory usage
- naming conventions
- Arrange / Act / Assert structure
- client usage
- schema validation pattern
- assertion style
- constants and shared utilities
- formatting and code style

Do not introduce a different test structure or coding pattern when an equivalent validated pattern already exists.

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
5. An explanation of how the proposed code follows the Golden Template.
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

Task:

Review the implementation for:

{{IMPLEMENTATION_OR_SCENARIO}}

Treat this as an engineering validation task, not just a code-generation task.

Independently:

1. Inspect the relevant constants, schemas, factories, clients, fixtures, tests, and other owning framework layers.
2. Verify that the implementation follows the repository architecture, testing standards, and existing Golden Template.
3. Check for unnecessary type weakening, duplicated abstractions, invented behavior, or inconsistent structure.
4. Determine the appropriate repository validation commands for this change.
5. Run the relevant formatting, type-checking, and targeted test validation.
6. If you identify a justified code issue, make the smallest architecturally complete correction and validate it.
7. Do not change code merely for stylistic preference when the existing implementation already follows repository standards.
8. Do not commit or push anything.

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
9. Do not modify files yet.
10. Do not call the real API.

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

The Agent explicitly identified that the OpenAPI contract does not define an exact field-level error payload for an unsupported priority.

Therefore the proposal intentionally did not invent:

- a field name in the error response;
- an exact enum-validation message;
- additional undocumented response structure.

The proposal remained limited to behavior supported by available evidence.

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

## Separate Evidence Sources

When multiple evidence sources exist, require explicit separation.

For example:

```text
OpenAPI contract evidence
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
```

---

# Not Yet Validated

The following capabilities are intentionally not described as established Golden Templates yet:

```text
Playwright MCP-Assisted UI Engineering
→ NOT YET VALIDATED

Cursor-Assisted Engineering
→ NOT YET VALIDATED
```

They should be added to the validated workflow only after a real POC has been executed, reviewed, and validated.

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
└── UI  → Playwright MCP [not yet validated]
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
