import lighthouseThresholds from "./lighthouseThresholds.json";

import type { LighthouseMetrics } from "./LighthouseRunner";

export type LighthousePolicySeverity = "error" | "warn";

export type LighthousePolicyViolation = {
  metric: string;
  actual: number;
  threshold: number;
  severity: LighthousePolicySeverity;
  message: string;
};

export type LighthousePolicyResult = {
  errors: LighthousePolicyViolation[];
  warnings: LighthousePolicyViolation[];
};

function toSeverity(value: string): LighthousePolicySeverity {
  if (value !== "error" && value !== "warn") {
    throw new Error(`Unsupported Lighthouse policy severity: ${value}`);
  }

  return value;
}

function createViolation(
  metric: string,
  actual: number,
  threshold: number,
  severity: string,
  message: string,
): LighthousePolicyViolation {
  return {
    metric,
    actual,
    threshold,
    severity: toSeverity(severity),
    message,
  };
}

export function evaluateLighthousePolicy(
  metrics: LighthouseMetrics,
): LighthousePolicyResult {
  const violations: LighthousePolicyViolation[] = [];

  if (metrics.performanceScore < lighthouseThresholds.performanceScore.value) {
    violations.push(
      createViolation(
        "performanceScore",
        metrics.performanceScore,
        lighthouseThresholds.performanceScore.value,
        lighthouseThresholds.performanceScore.severity,
        `Performance score ${Math.round(
          metrics.performanceScore * 100,
        )} is below threshold ${Math.round(
          lighthouseThresholds.performanceScore.value * 100,
        )}`,
      ),
    );
  }

  if (metrics.cls > lighthouseThresholds.cls.value) {
    violations.push(
      createViolation(
        "cls",
        metrics.cls,
        lighthouseThresholds.cls.value,
        lighthouseThresholds.cls.severity,
        `CLS ${metrics.cls} exceeds threshold ${lighthouseThresholds.cls.value}`,
      ),
    );
  }

  if (metrics.tbt > lighthouseThresholds.tbtMs.value) {
    violations.push(
      createViolation(
        "tbtMs",
        metrics.tbt,
        lighthouseThresholds.tbtMs.value,
        lighthouseThresholds.tbtMs.severity,
        `TBT ${Math.round(
          metrics.tbt,
        )}ms exceeds threshold ${lighthouseThresholds.tbtMs.value}ms`,
      ),
    );
  }

  if (metrics.lcp > lighthouseThresholds.lcpMs.value) {
    violations.push(
      createViolation(
        "lcpMs",
        metrics.lcp,
        lighthouseThresholds.lcpMs.value,
        lighthouseThresholds.lcpMs.severity,
        `LCP ${Math.round(
          metrics.lcp,
        )}ms exceeds threshold ${lighthouseThresholds.lcpMs.value}ms`,
      ),
    );
  }

  return {
    errors: violations.filter((violation) => violation.severity === "error"),
    warnings: violations.filter((violation) => violation.severity === "warn"),
  };
}
