// @template request-schema: Provider request contract for creating a resource.
// @template Canonical source: src/api/schemas/TaskRequestSchema.ts. Rules: framework/docs/TESTING_STANDARDS.md#schema-standard
// @template Replace the tokens described in framework/templates/index.json. Fields, locators and test data are illustrative.
import { Type, type Static } from "@sinclair/typebox";
import { __DOMAIN___PRIORITIES, __DOMAIN___STATUSES } from "@app/api/constants/__domain__";

export const __domain__RequestSchema = Type.Object(
  {
    title: Type.String(),
    description: Type.Optional(Type.String()),
    priority: Type.Optional(
      Type.Union(__DOMAIN___PRIORITIES.map((priority) => Type.Literal(priority))),
    ),
    status: Type.Optional(
      Type.Union(__DOMAIN___STATUSES.map((status) => Type.Literal(status))),
    ),
  },
  {
    additionalProperties: false,
  },
);

export type __Domain__Request = Static<typeof __domain__RequestSchema>;
