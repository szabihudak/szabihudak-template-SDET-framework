# ADR-001: Use RealWorld as the Target Application

## Status

Superseded by ADR-004

## Context

The portfolio framework requires a realistic application that supports more than simple UI interactions.

The target application should allow the framework to demonstrate:

- UI automation
- API automation
- authentication
- CRUD workflows
- multiple user states
- network interactions
- test data management
- accessibility testing
- visual regression
- performance testing

Simple demo applications such as basic login or shopping examples provide insufficient complexity for an enterprise-style portfolio project.

## Decision

Use a RealWorld-compatible application as the primary system under test.

RealWorld provides functionality such as:

- registration and login
- token-based authentication
- user profiles
- article creation, editing, and deletion
- comments
- favorites
- feeds
- REST API interactions

This allows both UI and API automation to be demonstrated against the same domain.

## Alternatives Considered

### SauceDemo

Advantages:

- stable
- simple to automate
- commonly used for Playwright examples

Disadvantages:

- limited API coverage
- limited domain complexity
- heavily used in tutorial portfolios

### Simple Playwright Demo Applications

Advantages:

- reliable
- easy to configure

Disadvantages:

- insufficient functionality for demonstrating enterprise framework architecture

## Consequences

### Positive

- realistic workflows
- UI and API tests can share domain concepts
- authentication strategies can be demonstrated
- richer portfolio scenarios
- suitable for advanced testing topics later in the roadmap

### Negative

- the selected implementation may require local setup or maintenance;
- individual RealWorld implementations may differ in stability;
- test data cleanup will require more deliberate design.

## Follow-Up Decisions

Future ADRs should define:

- selected RealWorld implementation
- framework architecture
- Page Object / domain abstraction strategy
- environment configuration strategy
- test data strategy
- authentication strategy
