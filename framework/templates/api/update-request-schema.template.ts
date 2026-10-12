// @template update-request-schema: Provider request contract for partially updating a resource.
// @template Canonical source: src/api/schemas/TaskUpdateRequestSchema.ts. Rules: framework/docs/TESTING_STANDARDS.md#schema-standard
// @template Replace the tokens described in framework/templates/index.json. Fields, locators and test data are illustrative.
import { Type, type Static } from "@sinclair/typebox";
import { __DOMAIN___PRIORITIES, __DOMAIN___STATUSES } from "@app/api/constants/__domain__";

export const __domain__UpdateRequestSchema = Type.Object(
  {
    title: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
    description: Type.Optional(Type.String({ maxLength: 2000 })),
    priority: Type.Optional(
      Type.Union(__DOMAIN___PRIORITIES.map((priority) => Type.Literal(priority))),
    ),
    status: Type.Optional(
      Type.Union(__DOMAIN___STATUSES.map((status) => Type.Literal(status))),
    ),
    position: Type.Optional(Type.Integer({ minimum: 0 })),
  },
  {
    additionalProperties: false,
  },
);

export type __Domain__UpdateRequest = Static<typeof __domain__UpdateRequestSchema>;
