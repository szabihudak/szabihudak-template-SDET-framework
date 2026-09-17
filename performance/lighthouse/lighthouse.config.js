const environments = require("../../config/environments/environments.json");

const environment = process.env.TEST_ENV ?? "hosted";
const config = environments[environment];

if (!config) {
  throw new Error(`Unknown TEST_ENV: ${environment}`);
}

module.exports = {
  ci: {
    collect: {
      url: [config.webBaseUrl],
      numberOfRuns: 3,
      settings: {
        onlyCategories: ["performance"],
      },
    },

    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: 0.7 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
        "total-blocking-time": ["error", { maxNumericValue: 300 }],
        "largest-contentful-paint": ["warn", { maxNumericValue: 6000 }],
      },
    },

    upload: {
      target: "filesystem",
      outputDir: "./performance-results/lighthouse",
    },
  },
};
