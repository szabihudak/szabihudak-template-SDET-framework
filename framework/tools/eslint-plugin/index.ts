import apiFieldCoverage from "./rules/api-field-coverage.ts";
import apiTestsAssertBusinessFields from "./rules/api-tests-assert-business-fields.ts";
import negativeResponseFields from "./rules/negative-response-fields.ts";
import noBooleanWrappedAssertions from "./rules/no-boolean-wrapped-assertions.ts";
import noInlinePayloadToApiClient from "./rules/no-inline-payload-to-api-client.ts";
import noPartialSuccessComparison from "./rules/no-partial-success-comparison.ts";
import noSkippedTests from "./rules/no-skipped-tests.ts";
import noSuccessSchemaOnNegativeResponse from "./rules/no-success-schema-on-negative-response.ts";
import planCaseSteps from "./rules/plan-case-steps.ts";
import planCaseTechnique from "./rules/plan-case-technique.ts";
import planCoverage from "./rules/plan-coverage.ts";
import planRiskPriority from "./rules/plan-risk-priority.ts";
import parameterizedSql from "./rules/parameterized-sql.ts";
import roleCredentialsInLoginSpecs from "./rules/role-credentials-in-login-specs.ts";
import schemasRejectUnknownFields from "./rules/schemas-reject-unknown-fields.ts";
import sharedVisualOptions from "./rules/shared-visual-options.ts";
import similarTestsAsScenarios from "./rules/similar-tests-as-scenarios.ts";
import successResponseOrder from "./rules/success-response-order.ts";
import uiTestsAssertThePage from "./rules/ui-tests-assert-the-page.ts";

// The project's own rules: the shapes of the golden templates and the layer
// rules that the standard plugins cannot express, and the test plan format
// (plan-*, on the Markdown syntax tree of test-plans/*.md). One file and one test per
// rule; the id is the one the documentation and messages use.
export default {
  meta: { name: "architecture" },
  rules: {
    "api-field-coverage": apiFieldCoverage,
    "api-tests-assert-business-fields": apiTestsAssertBusinessFields,
    "negative-response-fields": negativeResponseFields,
    "no-boolean-wrapped-assertions": noBooleanWrappedAssertions,
    "no-inline-payload-to-api-client": noInlinePayloadToApiClient,
    "no-partial-success-comparison": noPartialSuccessComparison,
    "no-skipped-tests": noSkippedTests,
    "no-success-schema-on-negative-response": noSuccessSchemaOnNegativeResponse,
    "parameterized-sql": parameterizedSql,
    "plan-case-steps": planCaseSteps,
    "plan-case-technique": planCaseTechnique,
    "plan-coverage": planCoverage,
    "plan-risk-priority": planRiskPriority,
    "role-credentials-in-login-specs": roleCredentialsInLoginSpecs,
    "schemas-reject-unknown-fields": schemasRejectUnknownFields,
    "shared-visual-options": sharedVisualOptions,
    "similar-tests-as-scenarios": similarTestsAsScenarios,
    "success-response-order": successResponseOrder,
    "ui-tests-assert-the-page": uiTestsAssertThePage,
  },
};
