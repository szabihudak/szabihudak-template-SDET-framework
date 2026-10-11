import frameworkConfig from "../../../config/framework.config";
import { validateSchema } from "../api/SchemaValidator";
import {
  frameworkConfigSchema,
  type FrameworkConfig,
} from "./frameworkConfigSchema";

export function getFrameworkConfig(): FrameworkConfig {
  const config: unknown = frameworkConfig;
  validateSchema(frameworkConfigSchema, config);

  return config;
}
