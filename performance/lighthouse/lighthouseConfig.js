const environments = require("../../config/environments/environments.json");
const thresholds = require("./lighthouseThresholds.json");

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
        "categories:performance": [
          "error",
          { minScore: thresholds.performanceScore },
        ],
        "cumulative-layout-shift": [
          "error",
          { maxNumericValue: thresholds.cls },
        ],
        "total-blocking-time": ["error", { maxNumericValue: thresholds.tbtMs }],
        "largest-contentful-paint": [
          "warn",
          { maxNumericValue: thresholds.lcpMs },
        ],
      },
    },

    upload: {
      target: "filesystem",
      outputDir: "./performance-results/lighthouse",
    },
  },
};
