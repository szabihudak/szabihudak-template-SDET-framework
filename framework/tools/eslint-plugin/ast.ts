import { AST_NODE_TYPES as T, ESLintUtils } from "@typescript-eslint/utils";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

// Syntax-tree helpers shared by the project rules: test callbacks, assertions
// and the response bodies an API test reads.

export const createRule = ESLintUtils.RuleCreator.withoutDocs;

// "[<rule id>] <message> (<source>)": the id is what the self-test and readers
// search for, the source is the written rule (checked by architecture.ts).
export const say = (id: string, message: string, source: string) =>
  `[${id}] ${message} (${source})`;

type Context = Readonly<TSESLint.RuleContext<string, readonly unknown[]>>;
type Function = TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression;

// Every node below `root`, depth first, in source order.
export function descendants(root: TSESTree.Node): TSESTree.Node[] {
  const nodes: TSESTree.Node[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
    } else if (value && typeof (value as TSESTree.Node).type === "string") {
      const node = value as TSESTree.Node;
      nodes.push(node);
      for (const [key, child] of Object.entries(node)) {
        if (key !== "parent") visit(child);
      }
    }
  };

  for (const [key, child] of Object.entries(root)) {
    if (key !== "parent") visit(child);
  }
  return nodes;
}

const calls = (root: TSESTree.Node) =>
  descendants(root).filter(
    (node): node is TSESTree.CallExpression => node.type === T.CallExpression,
  );

// test("title", async (...) => { ... }); test.describe(), test.step() and the
// other test.* forms are not tests.
export function testCallback(
  node: TSESTree.CallExpression,
): Function | undefined {
  if (node.callee.type !== T.Identifier || node.callee.name !== "test") {
    return undefined;
  }
  const last = node.arguments[node.arguments.length - 1];

  return last?.type === T.ArrowFunctionExpression ||
    last?.type === T.FunctionExpression
    ? last
    : undefined;
}

export type Assertion = {
  call: TSESTree.CallExpression;
  subject: TSESTree.Node | undefined;
  matcher: string;
  negated: boolean;
};

// expect(subject)[.not|.soft|...].matcher(...), also expect.soft(subject).
export function assertion(
  node: TSESTree.CallExpression,
): Assertion | undefined {
  if (
    node.callee.type !== T.MemberExpression ||
    node.callee.property.type !== T.Identifier
  ) {
    return undefined;
  }
  const matcher = node.callee.property.name;
  let negated = false;
  let object = node.callee.object;

  while (
    object.type === T.MemberExpression &&
    object.property.type === T.Identifier
  ) {
    if (object.property.name === "not") negated = true;
    object = object.object;
  }
  if (object.type !== T.CallExpression) return undefined;

  const expect = object.callee;
  const isExpect =
    (expect.type === T.Identifier && expect.name === "expect") ||
    (expect.type === T.MemberExpression &&
      expect.object.type === T.Identifier &&
      expect.object.name === "expect");

  return isExpect
    ? { call: node, subject: object.arguments[0], matcher, negated }
    : undefined;
}

export const assertions = (root: TSESTree.Node) =>
  calls(root).flatMap((call) => assertion(call) ?? []);

// Source text without whitespace, for comparing expressions.
export const code = (context: Context, node: TSESTree.Node | undefined) =>
  node ? context.sourceCode.getText(node).replace(/\s+/g, "") : "";

export const isCallTo = (node: TSESTree.CallExpression, name: string) =>
  node.callee.type === T.Identifier && node.callee.name === name;

export const callsTo = (root: TSESTree.Node, name: string) =>
  calls(root).filter((call) => isCallTo(call, name));

// validateSchema(schema, variable) calls below `root`.
export function schemaValidations(root: TSESTree.Node) {
  return calls(root).flatMap((call) => {
    const [schema, variable] = call.arguments;

    return isCallTo(call, "validateSchema") &&
      schema?.type === T.Identifier &&
      variable?.type === T.Identifier
      ? [{ call, schema: schema.name, variable: variable.name }]
      : [];
  });
}

export const SUCCESS_STATUS = /^(?:HTTP_STATUS\.(?:OK|CREATED)|20[0-35-9])$/;
export const ERROR_STATUS = /^(?:HTTP_STATUS\.(?!OK\b|CREATED\b)\w+|[45]\d\d)$/;

export type ResponseBody = {
  variable: string;
  declaration: TSESTree.VariableDeclarator;
  status?: string;
  request?: TSESTree.CallExpression;
};

// Response bodies read in a test, `const body = await response.json()`, with
// the status the test asserts on `response` and the client call behind it.
export function responseBodies(
  context: Context,
  root: TSESTree.Node,
): ResponseBody[] {
  const nodes = descendants(root);
  const awaited = (
    declarator: TSESTree.VariableDeclarator,
  ): TSESTree.CallExpression | undefined =>
    declarator.init?.type === T.AwaitExpression &&
    declarator.init.argument.type === T.CallExpression
      ? declarator.init.argument
      : undefined;
  const declarators = nodes.filter(
    (node): node is TSESTree.VariableDeclarator =>
      node.type === T.VariableDeclarator && node.id.type === T.Identifier,
  );

  return declarators.flatMap((declaration) => {
    const read = awaited(declaration);
    if (
      read?.callee.type !== T.MemberExpression ||
      read.callee.property.type !== T.Identifier ||
      read.callee.property.name !== "json" ||
      read.callee.object.type !== T.Identifier
    ) {
      return [];
    }
    const response = read.callee.object.name;
    const status = assertions(root).find(
      ({ subject, matcher }) =>
        matcher === "toBe" && code(context, subject) === `${response}.status()`,
    );
    const request = declarators
      .filter(
        (candidate) => (candidate.id as TSESTree.Identifier).name === response,
      )
      .map(awaited)
      .find((call) => call?.callee.type === T.MemberExpression);

    return [
      {
        variable: (declaration.id as TSESTree.Identifier).name,
        declaration,
        status: status && code(context, status.call.arguments[0]),
        request,
      },
    ];
  });
}

// The nearest non-blank line above `node`.
export function previousLine(context: Context, node: TSESTree.Node): string {
  const lines = context.sourceCode.lines.slice(0, node.loc.start.line - 1);

  return [...lines].reverse().find((line) => line.trim()) ?? "";
}

// Tests of a file: every test("...", callback) call with its callback.
export function tests(program: TSESTree.Program) {
  return calls(program).flatMap((call) => {
    const callback = testCallback(call);
    return callback ? [{ call, callback }] : [];
  });
}
