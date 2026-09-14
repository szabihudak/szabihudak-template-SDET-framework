import type { Result } from "axe-core";

export function formatAccessibilityViolations(violations: Result[]): string {
  if (violations.length === 0) {
    return "No accessibility violations found.";
  }

  const formattedViolations = violations.map((violation, index) => {
    const formattedNodes = violation.nodes
      .map((node) => {
        const targets = node.target.join(", ");

        return [
          `   Target: ${targets}`,
          `   Details: ${node.failureSummary ?? "No failure summary available."}`,
        ].join("\n");
      })
      .join("\n");

    return [
      `${index + 1}. ${violation.id} [${violation.impact ?? "unknown"}]`,
      `   ${violation.help}`,
      formattedNodes,
      `   Help: ${violation.helpUrl}`,
    ].join("\n");
  });

  return [
    `Accessibility violations found: ${violations.length}`,
    "",
    ...formattedViolations,
  ].join("\n");
}
