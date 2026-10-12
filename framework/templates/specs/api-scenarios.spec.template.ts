// @template api-scenario-spec: API behavior with table-driven boundary, validation and authorization scenarios.
// @template Canonical source: tests/api/update-task.spec.ts. Rules: framework/docs/TESTING_STANDARDS.md#negative-api-test-standard
// @template Replace the tokens described in framework/templates/index.json. Fields, locators and test data are illustrative.
import { randomUUID } from "node:crypto";
import { test, expect } from "@app/fixtures/test-fixtures";
import { API_ERRORS } from "@app/api/constants/apiErrors";
import { HTTP_STATUS } from "@framework/api/httpStatuses";
import type { __Domain__UpdateRequest } from "@app/api/schemas/__Domain__UpdateRequestSchema";
import { __domain__ResponseSchema } from "@app/api/schemas/__Domain__ResponseSchema";
import { validateSchema } from "@framework/api/SchemaValidator";
import { create__Domain__ } from "@app/data/__domain__Factory";

const validTitleBoundaryScenarios = [
  {
    name: "accepts a 1-character title",
    title: "T",
  },
  {
    name: "accepts a 200-character title",
    title: "T".repeat(200),
  },
] satisfies { name: string; title: string }[];

type InvalidUpdateScenario = {
  name: string;
  update: __Domain__UpdateRequest;
};

const invalidUpdateScenarios = [
  {
    name: "rejects an empty title",
    update: { title: "" },
  },
  {
    name: "rejects a title longer than 200 characters",
    update: { title: "T".repeat(201) },
  },
  {
    name: "rejects a description longer than 2000 characters",
    update: { description: "D".repeat(2001) },
  },
  {
    name: "rejects an unsupported priority",
    update: { priority: "critical" as __Domain__UpdateRequest["priority"] },
  },
  {
    name: "rejects an unsupported status",
    update: { status: "blocked" as __Domain__UpdateRequest["status"] },
  },
  {
    name: "rejects a negative position",
    update: { position: -1 },
  },
  {
    name: "rejects a non-integer position",
    update: { position: 1.5 },
  },
] satisfies InvalidUpdateScenario[];

const unauthenticatedScenarios = [
  {
    name: "rejects an update without an authentication token",
    accessToken: "",
  },
  {
    name: "rejects an update with an invalid authentication token",
    accessToken: "Invalid-Token_123",
  },
] satisfies { name: string; accessToken: string }[];

const __domain__IdScenarios = [
  {
    name: "returns not found for a nonexistent __domain__ ID",
    __domain__Id: randomUUID(),
    expectedStatus: HTTP_STATUS.NOT_FOUND,
  },
  {
    name: "returns method not allowed when the __domain__ ID is missing",
    __domain__Id: "",
    expectedStatus: HTTP_STATUS.METHOD_NOT_ALLOWED,
  },
] satisfies { name: string; __domain__Id: string; expectedStatus: number }[];

test.describe("Update a __Domain__ API", () => {
  test("updates every supported __domain__ field", async ({
    __domain__Api,
    authenticatedTestUser,
    created__Domain__,
  }) => {
    const user = authenticatedTestUser;
    const updated__Domain__ = create__Domain__({
      title: `Updated ${created__Domain__.request.title}`,
      description: `Updated ${created__Domain__.request.description}`,
      priority: "high",
      status: "in_progress",
    });
    const position = 0;

    const response = await __domain__Api.update__Domain__(
      created__Domain__.response.id,
      { ...updated__Domain__, position },
      user.accessToken,
    );
    expect(response.status()).toBe(HTTP_STATUS.OK);

    const body = await response.json();
    validateSchema(__domain__ResponseSchema, body);

    expect(body.id).toBe(created__Domain__.response.id);
    expect(body.title).toBe(updated__Domain__.title);
    expect(body.description).toBe(updated__Domain__.description);
    expect(body.priority).toBe(updated__Domain__.priority);
    expect(body.status).toBe(updated__Domain__.status);
    expect(body.position).toBe(position);
  });

  test("accepts an update when other optional fields are omitted", async ({
    __domain__Api,
    authenticatedTestUser,
    created__Domain__,
  }) => {
    const user = authenticatedTestUser;
    const response = await __domain__Api.update__Domain__(
      created__Domain__.response.id,
      { priority: "high" },
      user.accessToken,
    );
    expect(response.status()).toBe(HTTP_STATUS.OK);

    const body = await response.json();
    validateSchema(__domain__ResponseSchema, body);

    expect(body.id).toBe(created__Domain__.response.id);
    expect(body.priority).toBe("high");
  });

  for (const scenario of validTitleBoundaryScenarios) {
    test(
      scenario.name,
      async ({ __domain__Api, authenticatedTestUser, created__Domain__ }) => {
        const user = authenticatedTestUser;
        const response = await __domain__Api.update__Domain__(
          created__Domain__.response.id,
          { title: scenario.title },
          user.accessToken,
        );
        expect(response.status()).toBe(HTTP_STATUS.OK);

        const body = await response.json();
        validateSchema(__domain__ResponseSchema, body);

        expect(body.title).toBe(scenario.title);
      },
    );
  }

  test("accepts a description at the 2000-character limit", async ({
    __domain__Api,
    authenticatedTestUser,
    created__Domain__,
  }) => {
    const user = authenticatedTestUser;
    const description = "D".repeat(2000);

    const response = await __domain__Api.update__Domain__(
      created__Domain__.response.id,
      { description },
      user.accessToken,
    );
    expect(response.status()).toBe(HTTP_STATUS.OK);

    const body = await response.json();
    validateSchema(__domain__ResponseSchema, body);

    expect(body.description).toBe(description);
  });

  for (const scenario of invalidUpdateScenarios) {
    test(
      scenario.name,
      async ({ __domain__Api, authenticatedTestUser, created__Domain__ }) => {
        const user = authenticatedTestUser;
        const response = await __domain__Api.update__Domain__(
          created__Domain__.response.id,
          scenario.update,
          user.accessToken,
        );
        expect(response.status()).toBe(HTTP_STATUS.BAD_REQUEST);

        const body = await response.json();
        expect(body.error).toBe(API_ERRORS.VALIDATION_FAILED);
      },
    );
  }

  for (const scenario of unauthenticatedScenarios) {
    test(scenario.name, async ({ __domain__Api, created__Domain__ }) => {
      const response = await __domain__Api.update__Domain__(
        created__Domain__.response.id,
        { priority: "high" },
        scenario.accessToken,
      );
      expect(response.status()).toBe(HTTP_STATUS.UNAUTHORIZED);

      const body = await response.json();
      expect(body.error).toBe(API_ERRORS.UNAUTHORIZED);
    });
  }

  for (const scenario of __domain__IdScenarios) {
    test(scenario.name, async ({ __domain__Api, authenticatedTestUser }) => {
      const user = authenticatedTestUser;
      const response = await __domain__Api.update__Domain__(
        scenario.__domain__Id,
        { priority: "high" },
        user.accessToken,
      );

      expect(response.status()).toBe(scenario.expectedStatus);
    });
  }
});
