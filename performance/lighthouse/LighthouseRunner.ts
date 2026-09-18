import fs from "node:fs";
import path from "node:path";

import { chromium, type Cookie } from "@playwright/test";
import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";

export type LighthouseMetrics = {
  performanceScore: number;
  lcp: number;
  cls: number;
  tbt: number;
  speedIndex: number;
};

export type LighthouseAuditRun = {
  metrics: LighthouseMetrics;
  htmlReportPath: string;
  jsonReportPath: string;
};

export type LighthouseAuditResult = {
  metrics: LighthouseMetrics;
  runs: LighthouseAuditRun[];
};

type LighthouseAuditOptions = {
  url: string;
  authCookies: Cookie[];
  reportName: string;
  numberOfRuns?: number;
};

function getNumericAuditValue(
  audits: Record<string, { numericValue?: number }>,
  auditId: string,
): number {
  const value = audits[auditId]?.numericValue;

  if (value === undefined) {
    throw new Error(
      `Lighthouse audit "${auditId}" did not return a numeric value`,
    );
  }

  return value;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
}

function aggregateMetrics(runs: LighthouseAuditRun[]): LighthouseMetrics {
  return {
    performanceScore: median(runs.map((run) => run.metrics.performanceScore)),
    lcp: median(runs.map((run) => run.metrics.lcp)),
    cls: median(runs.map((run) => run.metrics.cls)),
    tbt: median(runs.map((run) => run.metrics.tbt)),
    speedIndex: median(runs.map((run) => run.metrics.speedIndex)),
  };
}

export class LighthouseRunner {
  async audit({
    url,
    authCookies,
    reportName,
    numberOfRuns = 1,
  }: LighthouseAuditOptions): Promise<LighthouseAuditResult> {
    if (!Number.isInteger(numberOfRuns) || numberOfRuns < 1) {
      throw new Error("Lighthouse numberOfRuns must be a positive integer");
    }

    const runs: LighthouseAuditRun[] = [];

    for (let runNumber = 1; runNumber <= numberOfRuns; runNumber += 1) {
      runs.push(
        await this.runSingleAudit({
          url,
          authCookies,
          reportName,
          runNumber,
        }),
      );
    }

    return {
      metrics: aggregateMetrics(runs),
      runs,
    };
  }

  private async runSingleAudit({
    url,
    authCookies,
    reportName,
    runNumber,
  }: {
    url: string;
    authCookies: Cookie[];
    reportName: string;
    runNumber: number;
  }): Promise<LighthouseAuditRun> {
    const chrome = await chromeLauncher.launch({
      chromePath: chromium.executablePath(),
      chromeFlags: ["--headless"],
    });

    try {
      const browser = await chromium.connectOverCDP(
        `http://127.0.0.1:${chrome.port}`,
      );

      const context = browser.contexts()[0];

      await context.addCookies(authCookies);
      await browser.close();

      const result = await lighthouse(url, {
        port: chrome.port,
        logLevel: "info",
        output: ["html", "json"],
        onlyCategories: ["performance"],
        disableStorageReset: true,
      });

      if (!result) {
        throw new Error("Lighthouse did not return a result");
      }

      const reports = Array.isArray(result.report)
        ? result.report
        : [result.report];

      const [htmlReport, jsonReport] = reports;

      if (!htmlReport || !jsonReport) {
        throw new Error(
          "Lighthouse did not generate the expected HTML and JSON reports",
        );
      }

      const performanceScore = result.lhr.categories.performance.score;

      if (performanceScore === null) {
        throw new Error(
          "Lighthouse performance category did not return a score",
        );
      }

      const outputDirectory = path.resolve(
        process.cwd(),
        "performance-results/lighthouse",
      );

      fs.mkdirSync(outputDirectory, {
        recursive: true,
      });

      const htmlReportPath = path.join(
        outputDirectory,
        `${reportName}.run-${runNumber}.report.html`,
      );

      const jsonReportPath = path.join(
        outputDirectory,
        `${reportName}.run-${runNumber}.report.json`,
      );

      fs.writeFileSync(htmlReportPath, htmlReport);
      fs.writeFileSync(jsonReportPath, jsonReport);

      const audits = result.lhr.audits;

      return {
        metrics: {
          performanceScore,
          lcp: getNumericAuditValue(audits, "largest-contentful-paint"),
          cls: getNumericAuditValue(audits, "cumulative-layout-shift"),
          tbt: getNumericAuditValue(audits, "total-blocking-time"),
          speedIndex: getNumericAuditValue(audits, "speed-index"),
        },
        htmlReportPath,
        jsonReportPath,
      };
    } finally {
      await chrome.kill();
    }
  }
}
