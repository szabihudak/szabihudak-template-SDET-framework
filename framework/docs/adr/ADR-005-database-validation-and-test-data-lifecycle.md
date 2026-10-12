# ADR-005: Database Validation and Test Data Lifecycle

## Status

Accepted

Amended by ADR-007: the database guards check the environment permissions `allow.database` and `allow.destructive` in `config/environments/environments.json` instead of the environment name. In the reference configuration only `localDocker` grants them. The UPEX restore and baseline verification steps moved to `src/database/resetTestDatabase.ts`; the guards and schema reset remain in `framework/core/database/resetTestDatabase.ts`.

---

## Context

The framework originally validated application behavior through API and browser-visible boundaries.

As the Quality Engineering platform evolved, direct persistence validation became necessary to verify that supported application behavior produces the expected database state.

The framework requires database validation that:

- verifies persistence without replacing API or UI behavior testing;
- keeps SQL and database transport concerns outside test specifications;
- reuses existing application setup paths instead of creating database-owned business setup;
- remains safe against accidental execution on unsupported environments;
- preserves useful database state after failures for investigation;
- provides an explicit deterministic way to restore the dedicated test database;
- does not duplicate the target application's schema or seed ownership.

The target application uses PostgreSQL through a dedicated Neon test database.

The database is test-owned and disposable, but it is not recreated automatically for every test.

---

## Decision

Introduce a dedicated database validation capability with the following dependency model:

```text
Spec
  ↓
Fixture
  ↓
Domain Database Client
  ↓
DatabaseClient
  ↓
PostgreSQL / Neon
```

`DatabaseClient` owns PostgreSQL transport and connection lifecycle.

Domain database clients own domain-specific queries and persisted-record mapping.

Current domain clients include:

```text
UserDatabaseClient
TaskDatabaseClient
```

Database assertions remain in test specifications.

Application state should continue to be created through supported application boundaries such as API clients and existing fixtures.

The database layer validates resulting persistence rather than becoming an alternative application interaction layer.

---

## Database Test Execution

Database tests are owned by:

```text
tests/database/**
```

and execute through the dedicated Playwright project:

```text
--project=database
```

The database project is browser-independent and executes once rather than being multiplied across browser projects.

Database project retries are disabled:

```text
retries: 0
```

This is deliberate.

Database tests create persistent state. Automatic retries could create additional records and obscure the original failure state.

Preserving the first failing state provides clearer diagnostic evidence.

---

## Environment Safety Boundary

Direct database access is permitted only in the dedicated containerized test environment:

```text
TEST_ENV=localDocker
```

The database fixture validates this boundary before creating a connection.

The database connection string is provided at runtime through:

```text
DATABASE_URL
```

The connection string must not be stored in repository environment configuration or hardcoded into reusable framework code.

The framework must not log the full connection string.

This protects the database capability from accidental execution against the hosted application environment or another unsupported target.

---

## Database Client Responsibilities

### DatabaseClient

`DatabaseClient` owns:

- PostgreSQL connection pooling;
- parameterized query execution;
- connection lifecycle;
- connection shutdown.

It does not own:

- domain-specific SQL;
- business assertions;
- application setup;
- test-data generation.

### Domain Database Clients

Domain clients such as `UserDatabaseClient` and `TaskDatabaseClient` own:

- domain-specific SQL;
- parameter binding;
- database-record typing;
- focused persistence lookup operations.

They do not own test assertions.

The framework intentionally does not introduce a generic repository or service layer above these clients.

Additional abstraction should be introduced only when demonstrated reuse or complexity requires it.

---

## Test Data Ownership

Database tests reuse existing application setup capabilities.

Examples:

```text
user persistence validation
→ register user through UserApiClient / fixture
→ query persisted user through UserDatabaseClient
→ assert in spec

task persistence validation
→ create authenticated user
→ create task through TaskApiClient
→ query persisted task through TaskDatabaseClient
→ assert in spec
```

This preserves the distinction:

```text
application behavior
→ API / UI boundary

persistence verification
→ database boundary
```

Database tests must not create application state by directly inserting rows merely to simplify setup when a supported application path already exists.

---

## Cleanup Strategy

Normal database test execution does not automatically delete test-created data.

```text
normal execution
→ create unique test data
→ validate persistence
→ preserve resulting state
```

The reasons are:

- failed state remains available for investigation;
- cleanup failures cannot hide the original test result;
- automatic teardown does not create additional database behavior that the test must trust;
- generated unique data avoids dependency on a clean database between ordinary runs.

This means the dedicated test database is intentionally disposable rather than permanently pristine.

Per-test deletion should not be introduced merely to keep the database visually clean.

---

## Explicit Database Reset

When a clean baseline is required, the framework provides an explicit destructive reset command:

```text
npm run db:test:reset
```

The reset flow is:

```text
reset request
        ↓
validate TEST_ENV=localDocker
        ↓
validate DATABASE_URL
        ↓
require CONFIRM_DB_RESET=true
        ↓
validate PostgreSQL URL
        ↓
validate Docker availability
        ↓
DROP public schema
        ↓
CREATE public schema
        ↓
UPEX db:push
        ↓
UPEX db:seed
        ↓
verify baseline users and tasks
```

The reset operation is intentionally separate from normal test execution.

It must fail closed if the required safety conditions are not satisfied.

---

## Schema and Seed Ownership

The framework does not own the application database schema.

UPEX DOJO remains the source of truth for schema creation and baseline seed data.

Schema restoration is delegated to:

```text
bun run db:push
```

Baseline data restoration is delegated to:

```text
bun run db:seed
```

These commands execute through the UPEX application container defined by the framework's Docker Compose environment.

The framework orchestrates reset and verifies the expected baseline but does not duplicate application schema definitions or seed logic.

---

## Baseline Verification

A destructive reset is not considered complete merely because schema and seed commands return successfully.

The framework verifies the restored baseline.

Current verification checks include:

- expected seeded users exist;
- seeded users have baseline tasks.

This provides a post-condition for the reset operation and prevents a partially restored database from being treated as ready.

---

## Local PostgreSQL Decision

The current architecture does not introduce a local PostgreSQL container.

The execution model is:

```text
Playwright / UPEX containers
        ↓
dedicated Neon PostgreSQL test database
```

This keeps the application's current database technology and connection behavior representative while still isolating database validation from the shared hosted application.

A local PostgreSQL container may be introduced later only if a concrete requirement justifies changing the database execution boundary.

---

## Alternatives Considered

### Direct SQL in Test Specs

Rejected.

Advantages:

- minimal number of framework files;
- quick initial implementation.

Disadvantages:

- SQL ownership becomes scattered across tests;
- connection concerns leak into specs;
- reuse and typing become inconsistent;
- tests mix infrastructure mechanics with behavior verification.

---

### Generic Repository / Service Layer

Rejected for the current scope.

Advantages:

- could provide additional abstraction over persistence;
- may resemble application-layer architecture.

Disadvantages:

- no demonstrated requirement currently justifies another layer;
- would create abstraction primarily for structural symmetry;
- increases maintenance and indirection without current value.

The current transport-client plus domain-client boundary is sufficient.

---

### Automatic Per-Test Cleanup

Rejected.

Advantages:

- database remains visually cleaner;
- test-created records are removed automatically.

Disadvantages:

- failed state disappears before investigation;
- teardown failures can complicate diagnosis;
- retries and cleanup can produce additional database behavior;
- cleanup adds framework complexity without improving current isolation requirements.

Unique test data plus explicit full reset provides a clearer lifecycle for the dedicated disposable database.

---

### Reset Database Automatically Before CI Tests

Rejected.

Advantages:

- every CI database job could begin from a known baseline.

Disadvantages:

- destructive behavior becomes implicit;
- CI execution becomes coupled to database recreation;
- parallel functional jobs share the same database and may be affected by destructive reset;
- reset is not required for the current unique-data validation model.

Reset remains an explicit administrative operation.

---

## Consequences

### Positive

- persistence behavior can be validated directly;
- database transport and domain query responsibilities are explicit;
- application behavior continues to be exercised through supported application boundaries;
- tests remain readable and focused on expected persistence;
- database state remains available after failures;
- destructive operations are guarded;
- application schema and seed ownership remain with UPEX;
- the framework avoids unnecessary repository/service abstractions;
- database validation remains browser-independent and efficient.

### Trade-offs

- test-created records accumulate until an explicit reset;
- the dedicated Neon database is an external runtime dependency;
- developers must understand the distinction between normal test execution and destructive reset;
- database validation requires runtime database credentials;
- reset requires Docker because schema and seed restoration execute through the UPEX runtime.

These trade-offs are accepted because they provide clearer ownership, safer destructive operations, and better failure diagnostics.

---

## Implementation References

The decision is implemented through:

```text
framework/core/database/DatabaseClient.ts
src/database/clients/UserDatabaseClient.ts
src/database/clients/TaskDatabaseClient.ts
framework/core/database/resetTestDatabase.ts
src/fixtures/test-fixtures.ts
tests/database/**
playwright.config.ts
docker-compose.yml
docker-compose.local.yml
```

---

## Follow-Up

The separate local and CI application execution architecture, including Docker Compose topology and immutable Playwright/UPEX image ownership, is documented in ADR-006.
