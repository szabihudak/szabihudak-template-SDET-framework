/**
 * Axe rule tags used for the framework's automated WCAG 2.2 Level AA policy.
 *
 * WCAG 2.2 AA conformance includes applicable Level A and Level AA
 * requirements from earlier WCAG versions.
 */
export const WCAG_AA_TAGS = [
  "wcag2a", // WCAG 2.0 Level A
  "wcag2aa", // WCAG 2.0 Level AA
  "wcag21a", // WCAG 2.1 Level A additions
  "wcag21aa", // WCAG 2.1 Level AA additions
  "wcag22aa", // WCAG 2.2 Level AA additions
] as const;
