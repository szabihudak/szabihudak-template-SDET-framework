import rule from "../rules/no-swallowed-errors.ts";
import { run } from "./tester.ts";

run("no-swallowed-errors", rule, {
  valid: [
    "try { await run(); } catch (error) { throw new Error(`setup failed: ${error}`); }",
    "try { await run(); } finally { await cleanup(); }",
    "await promise.catch((error) => { log(error); throw error; });",
    "await promise.catch((error) => reportFailure(error));",
  ],
  invalid: [
    {
      code: "try { await run(); } catch {}",
      errors: [{ messageId: "swallowed" }],
    },
    {
      code: "try { await toast.waitFor(); return true; } catch { return false; }",
      errors: [{ messageId: "swallowed" }],
    },
    {
      code: "await page.goto(url).catch(() => {});",
      errors: [{ messageId: "swallowed" }],
    },
    {
      code: "await promise.catch(() => null);",
      errors: [{ messageId: "swallowed" }],
    },
    {
      code: "await promise.catch(function () { return undefined; });",
      errors: [{ messageId: "swallowed" }],
    },
  ],
});
