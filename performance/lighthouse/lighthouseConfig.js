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
          thresholds.performanceScore.severity,
          { minScore: thresholds.performanceScore.value },
        ],
        "cumulative-layout-shift": [
          thresholds.cls.severity,
          { maxNumericValue: thresholds.cls.value },
        ],
        "total-blocking-time": [
          thresholds.tbtMs.severity,
          { maxNumericValue: thresholds.tbtMs.value },
        ],
        "largest-contentful-paint": [
          thresholds.lcpMs.severity,
          { maxNumericValue: thresholds.lcpMs.value },
        ],
      },
    },

    upload: {
      target: "filesystem",
      outputDir: "./performance-results/lighthouse",
    },
  },
};
