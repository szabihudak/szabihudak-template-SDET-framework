// @template api-client: HTTP interaction with a domain endpoint: raw request methods plus fail-fast setup helpers.
// @template Canonical source: src/api/clients/TaskApiClient.ts. Rules: framework/docs/TESTING_STANDARDS.md#api-client-standard
// @template Replace the tokens described in framework/templates/index.json. Fields, locators and test data are illustrative.
import { type APIRequestContext, type APIResponse } from "@playwright/test";

import { requireUrl } from "@framework/utils/env";
import { logger } from "@framework/utils/logger";
import type { __Domain__Request } from "@app/api/schemas/__Domain__RequestSchema";
import type { __Domain__UpdateRequest } from "@app/api/schemas/__Domain__UpdateRequestSchema";
import {
  type __Domain__Response,
  __domain__ResponseSchema,
} from "@app/api/schemas/__Domain__ResponseSchema";
import { validateSchema } from "@framework/api/SchemaValidator";

export class __Domain__ApiClient {
  constructor(private readonly request: APIRequestContext) {}

  async create__Domain__(
    __domain__: Partial<__Domain__Request>,
    accessToken: string,
  ): Promise<APIResponse> {
    const apiBaseUrl = requireUrl("apiBaseUrl");

    return this.request.post(`${apiBaseUrl}/__domains__`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        ...__domain__,
      },
    });
  }

  async update__Domain__(
    __domain__Id: string,
    __domain__: __Domain__UpdateRequest,
    accessToken: string,
  ): Promise<APIResponse> {
    const apiBaseUrl = requireUrl("apiBaseUrl");

    return this.request.put(`${apiBaseUrl}/__domains__/${__domain__Id}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        ...__domain__,
      },
    });
  }

  async create__Domain__ForUser(
    __domain__: __Domain__Request,
    accessToken: string,
  ): Promise<__Domain__Response> {
    logger.info(`Creating a new __domain__: ${__domain__.title}`);

    const response = await this.create__Domain__(__domain__, accessToken);

    if (!response.ok()) {
      logger.error(`__Domain__ creation failed with status ${response.status()}`);
      throw new Error(
        `__Domain__ creation failed: ${response.status()} ${await response.text()}`,
      );
    }

    const created__Domain__ = await response.json();
    validateSchema(__domain__ResponseSchema, created__Domain__);

    logger.info(`__Domain__ created successfully: ${__domain__.title}`);

    return created__Domain__;
  }

  async delete__Domain__(__domain__Id: string, accessToken: string): Promise<APIResponse> {
    const apiBaseUrl = requireUrl("apiBaseUrl");

    return this.request.delete(`${apiBaseUrl}/__domains__/${__domain__Id}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  }

  async delete__Domain__ForUser(__domain__Id: string, accessToken: string): Promise<void> {
    logger.info(`Deleting __domain__: ${__domain__Id}`);

    const response = await this.delete__Domain__(__domain__Id, accessToken);

    if (!response.ok()) {
      logger.error(`__Domain__ deletion failed with status ${response.status()}`);

      throw new Error(
        `__Domain__ deletion failed: ${response.status()} ${await response.text()}`,
      );
    }

    logger.info(`__Domain__ deleted successfully: ${__domain__Id}`);
  }
}
