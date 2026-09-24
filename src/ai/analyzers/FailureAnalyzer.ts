import type { FailureEvidence } from "../models/FailureEvidence";
import type { FailureAnalysis } from "../schemas/FailureAnalysisSchema";

export interface FailureAnalyzer {
  analyze(evidence: FailureEvidence): Promise<FailureAnalysis>;
}