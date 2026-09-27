import type { FailureEvidence } from "../schemas/FailureEvidenceSchema";
import type { FailureAnalysis } from "../schemas/FailureAnalysisSchema";

export interface FailureAnalyzer {
  analyze(evidence: FailureEvidence): Promise<FailureAnalysis>;
}
