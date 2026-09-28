import type { TestDesign } from "../schemas/TestDesignSchema";
import type { TestDesignInput } from "../schemas/TestDesignInputSchema";

export interface TestScenarioGenerator {
  generate(input: TestDesignInput): Promise<TestDesign>;
}
