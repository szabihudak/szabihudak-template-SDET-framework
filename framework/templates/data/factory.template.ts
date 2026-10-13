// @template factory: Test data: complete valid object with overrides, plus partial request payloads.
// @template Canonical source: src/data/taskFactory.ts. Rules: framework/docs/TESTING_STANDARDS.md#factory-standard
// @template Replace the tokens described in framework/templates/index.json. Fields, locators and test data are illustrative.
import type { __Domain__Priority, __Domain__Status } from "@app/api/constants/__domain__";
import type { __Domain__Request } from "@app/api/schemas/__Domain__RequestSchema";

export type Complete__Domain__Request = Required<__Domain__Request>;

type Create__Domain__Options = {
  title?: string;
  description?: string;
  priority?: __Domain__Priority;
  status?: __Domain__Status;
};

type Create__Domain__PayloadOptions = Create__Domain__Options & {
  missingFields?: (keyof __Domain__Request)[];
};

export function create__Domain__(
  options: Create__Domain__Options = {},
): Complete__Domain__Request {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    title: options.title ?? `__domain__Title_${id}`,
    description: options.description ?? `__domain__Description_${id}`,
    priority: options.priority ?? "low",
    status: options.status ?? "done",
  };
}

export function create__Domain__Payload(
  options: Create__Domain__PayloadOptions = {},
): Partial<__Domain__Request> {
  const __domain__: Partial<__Domain__Request> = create__Domain__(options);

  for (const field of options.missingFields ?? []) {
    delete __domain__[field];
  }

  return __domain__;
}
