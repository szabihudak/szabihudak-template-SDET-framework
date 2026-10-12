// @template k6-workload: API workload performance with setup outside the measured operation and native thresholds.
// @template Canonical source: tests/performance/k6/taskReadLoad.js. Rules: framework/docs/TESTING_STANDARDS.md#api-performance-standard
// @template Replace the tokens described in framework/templates/index.json. Fields, locators and test data are illustrative.
import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

export { handleSummary } from "../../../framework/core/performance/k6/k6SummaryReporter.js";

export const options = {
  scenarios: {
    __domain___read_baseline: {
      executor: "constant-vus",
      vus: 2,
      duration: "30s",
    },
  },
  thresholds: {
    __domain___read_duration: ["p(95)<500"],
    __domain___read_failures: ["rate<0.01"],
  },
};

const baseUrl = __ENV.TARGET_BASE_URL;
const __domain__ReadDuration = new Trend("__domain___read_duration", true);
const __domain__ReadFailures = new Rate("__domain___read_failures");

function createPerformanceUser() {
  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    name: `Performance User ${uniqueId}`,
    email: `perf_${uniqueId}@example.com`,
    password: "TestPassword123!",
  };
}

export function setup() {
  if (!baseUrl) {
    throw new Error("TARGET_BASE_URL is required");
  }

  const user = createPerformanceUser();

  const registrationResponse = http.post(
    `${baseUrl}/auth/register`,
    JSON.stringify(user),
    {
      headers: {
        "Content-Type": "application/json",
      },
      tags: {
        name: "setup_register",
      },
    },
  );

  const registrationSucceeded = check(registrationResponse, {
    "performance user registration succeeds": (response) =>
      response.status >= 200 && response.status < 300,
  });

  if (!registrationSucceeded) {
    throw new Error(
      `Performance user registration failed with status ${registrationResponse.status}`,
    );
  }

  const loginResponse = http.post(
    `${baseUrl}/auth/login`,
    JSON.stringify({
      email: user.email,
      password: user.password,
    }),
    {
      headers: {
        "Content-Type": "application/json",
      },
      tags: {
        name: "setup_login",
      },
    },
  );

  const loginSucceeded = check(loginResponse, {
    "performance user login succeeds": (response) =>
      response.status >= 200 && response.status < 300,
  });

  if (!loginSucceeded) {
    throw new Error(
      `Performance user login failed with status ${loginResponse.status}`,
    );
  }

  const loginBody = loginResponse.json();

  if (!loginBody.access_token) {
    throw new Error("Login response did not contain access_token");
  }

  const __domain__Response = http.post(
    `${baseUrl}/__domains__`,
    JSON.stringify({
      title: `Performance __Domain__ ${Date.now()}`,
    }),
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginBody.access_token}`,
      },
      tags: {
        name: "setup_create___domain__",
      },
    },
  );

  const __domain__Created = check(__domain__Response, {
    "performance __domain__ creation succeeds": (response) =>
      response.status >= 200 && response.status < 300,
  });

  if (!__domain__Created) {
    throw new Error(
      `Performance __domain__ creation failed with status ${__domain__Response.status}`,
    );
  }

  const __domain__Body = __domain__Response.json();

  if (!__domain__Body.id) {
    throw new Error("__Domain__ creation response did not contain id");
  }

  return {
    accessToken: loginBody.access_token,
    __domain__Id: __domain__Body.id,
  };
}

export default function (data) {
  const response = http.get(`${baseUrl}/__domains__`, {
    headers: {
      Authorization: `Bearer ${data.accessToken}`,
    },
    tags: {
      name: "__domain___read",
    },
  });

  __domain__ReadDuration.add(response.timings.duration);

  const __domain__ReadSucceeded = check(response, {
    "__domain__ read succeeds": (result) => result.status === 200,
  });

  __domain__ReadFailures.add(!__domain__ReadSucceeded);

  sleep(1);
}

export function teardown(data) {
  if (!data?.accessToken || !data?.__domain__Id) {
    throw new Error("Performance teardown did not receive required setup data");
  }

  const deleteResponse = http.del(`${baseUrl}/__domains__/${data.__domain__Id}`, null, {
    headers: {
      Authorization: `Bearer ${data.accessToken}`,
    },
    tags: {
      name: "teardown_delete___domain__",
    },
  });

  const __domain__Deleted = check(deleteResponse, {
    "performance __domain__ cleanup succeeds": (response) =>
      response.status >= 200 && response.status < 300,
  });

  if (!__domain__Deleted) {
    throw new Error(
      `Performance __domain__ cleanup failed with status ${deleteResponse.status}`,
    );
  }
}
