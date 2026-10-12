import { defineFrameworkConfig } from "../template-fw/framework/config/frameworkConfigSchema";

export default defineFrameworkConfig({
  modules: {
    api: true,
    ui: true,
    smoke: true,
    database: true,
    accessibility: true,
    visual: true,
    performance: true,
    ai: true,
  },

  browsers: ["chromium", "firefox", "webkit"],

  execution: {
    ciRetries: 2,
    ciWorkers: 1,
  },

  auth: {
    browser: {
      strategy: "nextAuth",
      csrfPath: "/api/auth/csrf",
      callbackPath: "/api/auth/callback/credentials",
      landingPath: "/dashboard",
      usernameField: "email",
      passwordField: "password",
    },
    api: {
      strategy: "bearer",
      loginPath: "/auth/login",
      usernameField: "email",
      passwordField: "password",
      tokenField: "access_token",
    },
  },

  roles: {},
});
