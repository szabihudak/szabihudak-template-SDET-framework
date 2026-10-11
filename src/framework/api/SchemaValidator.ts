import Ajv, { type ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import type { Static, TSchema } from "@sinclair/typebox";

const ajv = new Ajv({
  allErrors: true,
});

addFormats(ajv);

const validators = new WeakMap<TSchema, ValidateFunction>();

function getValidator(schema: TSchema): ValidateFunction {
  let validate = validators.get(schema);

  if (!validate) {
    validate = ajv.compile(schema);
    validators.set(schema, validate);
  }

  return validate;
}

export function validateSchema<T extends TSchema>(
  schema: T,
  data: unknown,
): asserts data is Static<T> {
  const validate = getValidator(schema);
  const isValid = validate(data);

  if (!isValid) {
    throw new Error(
      `Schema validation failed:\n${JSON.stringify(validate.errors, null, 2)}`,
    );
  }
}
