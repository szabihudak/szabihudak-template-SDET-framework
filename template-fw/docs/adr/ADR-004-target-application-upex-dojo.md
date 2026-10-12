# ADR-004: Use UPEX DOJO as the Target Application

## Status

Accepted

## Context

ADR-001 selected a RealWorld-compatible application as the original target application.

ADR-002 subsequently selected `TonyMckes/conduit-realworld-example-app` as the concrete RealWorld implementation.

As the framework evolved, the active system under test changed to UPEX DOJO.

The current framework requires a target application that supports the implemented Quality Engineering capabilities, including:

- browser automation;
- REST API automation;
- user registration and authentication;
- authenticated browser sessions;
- task management workflows;
- API and UI composition;
- network interception and mocking;
- automated accessibility validation;
- deterministic visual regression scenarios;
- controlled API performance baseline testing.

The architectural value of the target application remains the same: it must provide enough realistic behavior to exercise the framework's quality-engineering boundaries without coupling the framework to a tutorial-only application.

## Decision

Use UPEX DOJO as the active target application.

Current hosted application:

```text
https://dojo.upexgalaxy.com
```

Current API documentation:

```text
https://dojo.upexgalaxy.com/api/docs
```

Source repository:

```text
upex-galaxy/upex-dojo
```

The framework must continue to treat the target application as an external provider.

Environment-specific URLs must remain configuration-driven rather than being hardcoded into tests or reusable framework layers.

## Consequences

### Positive

- the active target matches the framework's implemented API and browser workflows;
- the same application supports accessibility and visual regression scenarios;
- authenticated REST operations provide a suitable target for controlled performance baselines;
- API-driven setup can support deterministic browser scenarios;
- the target provides enough domain behavior for Senior QA / SDET portfolio scenarios.

### Trade-offs

- the hosted application remains an external dependency;
- hosted availability and behavior are not owned by the framework;
- shared hosted infrastructure limits the intensity of performance workloads;
- provider behavior must be modeled from observed runtime contracts rather than assumed.

## Supersedes

This ADR supersedes the active target-application decisions recorded in:

- ADR-001: Use RealWorld as the Target Application
- ADR-002: Select the RealWorld Implementation

Those ADRs remain in the repository as historical records of the earlier target-selection decisions.
