import path from "node:path";
import { pathToFileURL } from "node:url";
import { AST_NODE_TYPES as T } from "@typescript-eslint/utils";
import type { TSESTree } from "@typescript-eslint/utils";
import { require as tsxRequire } from "tsx/cjs/api";

// The schemas a spec validates against, loaded as the running TypeBox objects
// so their fields and formats are exactly what validateSchema() checks.

// Aliases from tsconfig.json.
const ALIASES: Record<string, string> = {
  "@framework/": "framework/core/",
  "@app/": "src/",
};

export type SchemaLike = {
  format?: string;
  properties?: Record<string, SchemaLike>;
};

// Names a file imports, mapped to the absolute module path they come from.
export function importedNames(
  program: TSESTree.Program,
  filename: string,
  cwd: string,
): Map<string, string> {
  const names = new Map<string, string>();

  for (const statement of program.body) {
    if (statement.type !== T.ImportDeclaration) continue;
    const specifier = statement.source.value;
    const alias = Object.keys(ALIASES).find((prefix) =>
      specifier.startsWith(prefix),
    );
    const target = alias
      ? path.join(cwd, ALIASES[alias], specifier.slice(alias.length))
      : specifier.startsWith(".")
        ? path.join(path.dirname(filename), specifier)
        : undefined;
    if (!target) continue;

    for (const imported of statement.specifiers) {
      names.set(imported.local.name, target);
    }
  }
  return names;
}

const cache = new Map<string, Record<string, unknown> | undefined>();

// The module's exports, loaded through tsx so its aliases resolve as in a test
// run; undefined when it cannot be loaded.
export function loadModule(
  file: string,
  cwd: string,
): Record<string, unknown> | undefined {
  if (!cache.has(file)) {
    try {
      cache.set(file, tsxRequire(file, pathToFileURL(`${cwd}/`).href));
    } catch {
      cache.set(file, undefined);
    }
  }
  return cache.get(file);
}

export function loadSchema(
  file: string,
  name: string,
  cwd: string,
): SchemaLike | undefined {
  const schema = loadModule(file, cwd)?.[name] as SchemaLike | undefined;

  return schema?.properties ? schema : undefined;
}

// Leaf fields of a schema by path ("user.id"); nested objects are walked.
export function schemaFields(
  schema: SchemaLike,
  prefix = "",
): { path: string; format?: string }[] {
  return Object.entries(schema.properties ?? {}).flatMap(
    ([name, definition]) =>
      definition.properties
        ? schemaFields(definition, `${prefix}${name}.`)
        : [{ path: `${prefix}${name}`, format: definition.format }],
  );
}

// "user.id" → ["", "user"]: the body itself and each enclosing object.
export function ancestors(field: string): string[] {
  const parts = field.split(".");

  return parts.map((_, index) => parts.slice(0, index).join("."));
}
