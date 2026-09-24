export type FailureArtifactType = "trace" | "screenshot" | "video";

export interface FailureArtifact {
  type: FailureArtifactType;
  path: string;
}

export interface FailureTestContext {
  title: string;
  file: string;
  project: string;
}

export interface FailureExecutionContext {
  environment: string;
  retry: number;
}

export interface FailureDetails {
  message: string;
  stack?: string;
}

export interface FailureEvidence {
  test: FailureTestContext;
  execution: FailureExecutionContext;
  failure: FailureDetails;
  artifacts: FailureArtifact[];
}
