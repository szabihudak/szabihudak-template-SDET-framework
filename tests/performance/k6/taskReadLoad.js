import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

export { handleSummary } from "../../../template-fw/framework/performance/k6/k6SummaryReporter.js";

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

  const taskResponse = http.post(
    `${baseUrl}/tasks`,
    JSON.stringify({
      title: `Performance Task ${Date.now()}`,
    }),
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginBody.access_token}`,
      },
      tags: {
        name: "setup_create_task",
      },
    },
  );

  const taskCreated = check(taskResponse, {
    "performance task creation succeeds": (response) =>
      response.status >= 200 && response.status < 300,
  });

  if (!taskCreated) {
    throw new Error(
      `Performance task creation failed with status ${taskResponse.status}`,
    );
  }

  const taskBody = taskResponse.json();

  if (!taskBody.id) {
    throw new Error("Task creation response did not contain id");
  }

  return {
    accessToken: loginBody.access_token,
    taskId: taskBody.id,
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

export function teardown(data) {
  if (!data?.accessToken || !data?.taskId) {
    throw new Error("Performance teardown did not receive required setup data");
  }

  const deleteResponse = http.del(`${baseUrl}/tasks/${data.taskId}`, null, {
    headers: {
      Authorization: `Bearer ${data.accessToken}`,
    },
    tags: {
      name: "teardown_delete_task",
    },
  });

  const taskDeleted = check(deleteResponse, {
    "performance task cleanup succeeds": (response) =>
      response.status >= 200 && response.status < 300,
  });

  if (!taskDeleted) {
    throw new Error(
      `Performance task cleanup failed with status ${deleteResponse.status}`,
    );
  }
}
