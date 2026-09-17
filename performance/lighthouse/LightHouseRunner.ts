import fs from "node:fs";
import path from "node:path";

import { chromium, type BrowserContext } from "@playwright/test";
import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";

type StorageState = Awaited<ReturnType<BrowserContext["storageState"]>>;

export type LighthouseMetrics = {
  performanceScore: number;
  lcp: number;
  cls: number;
  tbt: number;
  speedIndex: number;
};

export type LighthouseAuditResult = {
  metrics: LighthouseMetrics;
  htmlReportPath: string;
  jsonReportPath: string;
};

type LighthouseAuditOptions = {
  url: string;
  storageState: StorageState;
  reportName: string;
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

export class LighthouseRunner {
  async audit({
    url,
    storageState,
    reportName,
  }: LighthouseAuditOptions): Promise<LighthouseAuditResult> {
    const chrome = await chromeLauncher.launch({
      chromeFlags: ["--headless"],
    });

    try {
      const browser = await chromium.connectOverCDP(
        `http://127.0.0.1:${chrome.port}`,
      );

      const context = browser.contexts()[0];

      await context.addCookies(storageState.cookies);

      await browser.close();

      const result = await lighthouse(url, {
        port: chrome.port,
        logLevel: "info",
        output: ["html", "json"],
        onlyCategories: ["performance"],
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
        `${reportName}.report.html`,
      );

      const jsonReportPath = path.join(
        outputDirectory,
        `${reportName}.report.json`,
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
