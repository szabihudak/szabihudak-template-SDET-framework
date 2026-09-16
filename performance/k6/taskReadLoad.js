import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

export const options = {
  scenarios: {
    task_read_baseline: {
      executor: "constant-vus",
      vus: 2,
      duration: "30s",
    },
  },
  thresholds: {
    task_read_duration: ["p(95)<500"],
    task_read_failures: ["rate<0.01"],
  },
};

const baseUrl = __ENV.TARGET_BASE_URL;
const taskReadDuration = new Trend("task_read_duration", true);
const taskReadFailures = new Rate("task_read_failures");

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
      `Performance user registration failed: ${registrationResponse.status} ${registrationResponse.body}`,
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
      `Performance user login failed: ${loginResponse.status} ${loginResponse.body}`,
    );
  }

  const loginBody = loginResponse.json();

  if (!loginBody.access_token) {
    throw new Error("Login response did not contain access_token");
  }

  return {
    accessToken: loginBody.access_token,
  };
}

export default function (data) {
  const response = http.get(`${baseUrl}/tasks`, {
    headers: {
      Authorization: `Bearer ${data.accessToken}`,
    },
    tags: {
      name: "task_read",
    },
  });

  taskReadDuration.add(response.timings.duration);

  const taskReadSucceeded = check(response, {
    "task read succeeds": (result) => result.status === 200,
  });

  taskReadFailures.add(!taskReadSucceeded);

  sleep(1);
}
