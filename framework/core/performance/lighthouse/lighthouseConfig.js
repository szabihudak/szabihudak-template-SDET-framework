const environments = require("../../../../config/environments/environments.json");
const thresholds = require("./lighthouseThresholds.json");

const environment = process.env.TEST_ENV;
const config = environments[environment];

if (!config) {
  throw new Error(`Unknown or missing TEST_ENV: ${environment}`);
}

if (!config.allow.performance) {
  throw new Error(
    `Lighthouse measurement is not allowed in the ${environment} environment.`,
  );
}

if (!config.webBaseUrl) {
  throw new Error(
    `${environment} has no webBaseUrl in config/environments/environments.json.`,
  );
}

module.exports = {
  ci: {
    collect: {
      url: [config.webBaseUrl],
      numberOfRuns: 3,
      settings: {
        onlyCategories: ["performance"],
        chromeFlags: "--no-sandbox",
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
