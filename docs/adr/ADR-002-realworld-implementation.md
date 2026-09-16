# ADR-002: Select the RealWorld Implementation

## Status

Superseded by ADR-004

## Context

ADR-001 established that the framework will use a RealWorld-compatible application as the primary system under test.

A concrete implementation is now required so that the automation framework can target a stable UI and API while also supporting future local and containerized execution.

## Decision

Use the following implementation:

**TonyMckes/conduit-realworld-example-app**

Technology stack:

- React
- Vite
- Express.js
- Sequelize
- PostgreSQL
- REST API

The application implements the RealWorld specification and provides:

- user registration
- authentication
- user profiles
- article CRUD operations
- comments
- favorites
- pagination
- frontend UI
- REST API

## Test Environments

### Hosted Environment

The hosted demo will be used initially for framework development and smoke testing.

This allows us to begin automation work immediately without maintaining the application infrastructure.

### Local Environment

Later in the roadmap, the application may also be run locally.

Default local endpoints:

- Frontend: `http://localhost:3000`
- API: `http://localhost:3001/api`

Local execution will be useful for:

- deterministic test data
- API testing
- Docker integration
- performance testing
- CI experiments

## Why This Implementation

### Advantages

- realistic full-stack application
- UI and API available in the same domain
- authentication and CRUD workflows
- suitable for Playwright UI and API testing
- open source
- supports local execution
- sufficiently complex for an enterprise-style QA portfolio

### Trade-offs

- the public demo is an external dependency;
- hosted test data may change;
- availability of the hosted environment is outside our control;
- local execution introduces database and environment management.

## Mitigation

The framework architecture must not depend directly on a single hard-coded deployment.

Base URLs and credentials will be environment-driven.

This will allow tests to run against:

- hosted demo
- local development environment
- future CI environment

without modifying test code.

## Consequences

The next architecture decisions must include:

- environment configuration
- authentication strategy
- test data strategy
- UI abstraction strategy
- API client strategy

## Next Decision

ADR-003 will define the overall automation framework architecture.
