import type { AgentTool } from "@earendil-works/pi-agent-core";
import { validateToolArguments } from "@earendil-works/pi-ai";
import { Type } from "@sinclair/typebox";
import { describe, expect, it } from "vitest";

import { toToolDefinitions } from "./pi-tool-definition-adapter.js";
import { coerceToolArgsWithSchema } from "./tool-arg-coercion.js";

// Regression: pi >= 0.74 validates with TypeBox 1.x, which does not convert
// values for @sinclair/typebox 0.34 schemas. Tool calls with "3"/"true" args
// failed with `Validation failed for tool` until prepareArguments coerced them.
const schema = Type.Object({
  count: Type.Number(),
  limit: Type.Optional(Type.Integer()),
  enabled: Type.Boolean(),
  verbose: Type.Optional(Type.Boolean()),
  label: Type.String(),
  mode: Type.Optional(Type.Union([Type.Literal("fast"), Type.Number()])),
  nested: Type.Optional(Type.Object({ depth: Type.Number() })),
  ids: Type.Optional(Type.Array(Type.Integer())),
});

function makeTool(prepareArguments?: (args: unknown) => unknown) {
  return {
    name: "typed_tool",
    label: "Typed tool",
    description: "number + boolean params",
    parameters: schema,
    prepareArguments,
    execute: async (_id: string, params: unknown) => ({
      content: [{ type: "text" as const, text: JSON.stringify(params) }],
      details: params,
    }),
  } as unknown as AgentTool<typeof schema, unknown>;
}

// Mirrors pi-agent-core's prepareToolCall: prepareArguments, then validateToolArguments.
function prepareAndValidate(def: ReturnType<typeof toToolDefinitions>[number], args: unknown) {
  const prepared = def.prepareArguments ? def.prepareArguments(args) : args;
  return validateToolArguments(def as never, {
    type: "toolCall",
    id: "call1",
    name: def.name,
    arguments: prepared as Record<string, unknown>,
  });
}

describe("tool arg coercion (TypeBox 0.34 schemas on pi 0.74)", () => {
  const stringArgs = {
    count: "3",
    limit: "10",
    enabled: "true",
    verbose: "FALSE",
    label: "42",
    mode: "7",
    nested: { depth: "2.5" },
    ids: ["1", "2"],
  };

  it("documents the upstream regression: string args fail validation without coercion", () => {
    expect(() =>
      validateToolArguments({ name: "typed_tool", parameters: schema } as never, {
        type: "toolCall",
        id: "call0",
        name: "typed_tool",
        arguments: { count: "3", enabled: "true", label: "x" },
      }),
    ).toThrow(/Validation failed for tool/);
  });

  it("validates string number/boolean args and passes the coerced values", async () => {
    const [def] = toToolDefinitions([makeTool()]);
    const validated = prepareAndValidate(def, stringArgs);
    expect(validated).toEqual({
      count: 3,
      limit: 10,
      enabled: true,
      verbose: false,
      label: "42",
      mode: 7,
      nested: { depth: 2.5 },
      ids: [1, 2],
    });
    const result = await def.execute("call1", validated, undefined, undefined, undefined as never);
    expect(result.details).toEqual(validated);
  });

  it("runs the tool's own prepareArguments first", () => {
    const [def] = toToolDefinitions([
      makeTool((args) => ({ ...(args as object), count: "5", label: "from-hook" })),
    ]);
    expect(prepareAndValidate(def, { count: "1", enabled: "false", label: "x" })).toEqual({
      count: 5,
      enabled: false,
      label: "from-hook",
    });
  });

  it("leaves non-coercible and string-typed values alone", () => {
    expect(coerceToolArgsWithSchema({ count: "abc", label: "1", mode: "fast" }, schema)).toEqual({
      count: "abc",
      label: "1",
      mode: "fast",
    });
    expect(coerceToolArgsWithSchema({ limit: "1.5", enabled: "yes" }, schema)).toEqual({
      limit: "1.5",
      enabled: "yes",
    });
    const already = { count: 1, enabled: true, label: "x" };
    expect(coerceToolArgsWithSchema(already, schema)).toBe(already);
  });
});
