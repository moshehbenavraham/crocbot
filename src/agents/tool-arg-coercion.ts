/**
 * Schema-driven coercion of string tool arguments.
 *
 * pi >= 0.74 validates tool arguments with TypeBox 1.x. Its `Value.Convert`
 * does not recognise schemas built with `@sinclair/typebox` 0.34, which is
 * what crocbot's tools still use. As a result, models that send `"3"` or
 * `"true"` for number/boolean params fail with `Validation failed for tool`.
 * Older pi versions coerced these. This restores that behaviour through the
 * `prepareArguments` hook, which pi runs before validation.
 *
 * Only strings are converted, and only when the schema at that position does
 * not accept a string. Everything else is returned unchanged.
 */

type JsonSchema = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function schemaTypes(schema: JsonSchema): string[] {
  const t = schema.type;
  if (typeof t === "string") {
    return [t];
  }
  if (Array.isArray(t)) {
    return t.filter((entry): entry is string => typeof entry === "string");
  }
  return [];
}

function branches(schema: JsonSchema): JsonSchema[] | undefined {
  const list = schema.anyOf ?? schema.oneOf;
  return Array.isArray(list) ? list.filter(isRecord) : undefined;
}

function acceptsString(schema: JsonSchema, value: string): boolean {
  const sub = branches(schema);
  if (sub) {
    return sub.some((branch) => acceptsString(branch, value));
  }
  if (schema.const !== undefined) {
    return schema.const === value;
  }
  if (Array.isArray(schema.enum)) {
    return schema.enum.includes(value);
  }
  const types = schemaTypes(schema);
  // No type information: be conservative and leave the value alone.
  return types.length === 0 || types.includes("string");
}

function coerceScalarString(value: string, types: string[]): unknown {
  const trimmed = value.trim();
  if (types.includes("integer") || types.includes("number")) {
    if (trimmed !== "" && /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(trimmed)) {
      const num = Number(trimmed);
      if (Number.isFinite(num) && (types.includes("number") || Number.isInteger(num))) {
        return num;
      }
    }
  }
  if (types.includes("boolean")) {
    const lower = trimmed.toLowerCase();
    if (lower === "true") {
      return true;
    }
    if (lower === "false") {
      return false;
    }
  }
  return value;
}

export function coerceToolArgsWithSchema(value: unknown, schema: unknown): unknown {
  if (!isRecord(schema)) {
    return value;
  }
  const sub = branches(schema);
  if (sub) {
    if (typeof value === "string") {
      if (acceptsString(schema, value)) {
        return value;
      }
      for (const branch of sub) {
        const coerced = coerceToolArgsWithSchema(value, branch);
        if (coerced !== value) {
          return coerced;
        }
      }
      return value;
    }
    if (isRecord(value)) {
      const objectBranch = sub.find((branch) => schemaTypes(branch).includes("object"));
      return objectBranch ? coerceToolArgsWithSchema(value, objectBranch) : value;
    }
    if (Array.isArray(value)) {
      const arrayBranch = sub.find((branch) => schemaTypes(branch).includes("array"));
      return arrayBranch ? coerceToolArgsWithSchema(value, arrayBranch) : value;
    }
    return value;
  }

  if (typeof value === "string") {
    if (acceptsString(schema, value)) {
      return value;
    }
    return coerceScalarString(value, schemaTypes(schema));
  }

  if (isRecord(value)) {
    const properties = isRecord(schema.properties) ? schema.properties : undefined;
    const additional = isRecord(schema.additionalProperties)
      ? schema.additionalProperties
      : undefined;
    if (!properties && !additional) {
      return value;
    }
    let out: Record<string, unknown> | undefined;
    for (const [key, entry] of Object.entries(value)) {
      const propSchema = properties && key in properties ? properties[key] : additional;
      if (propSchema === undefined) {
        continue;
      }
      const coerced = coerceToolArgsWithSchema(entry, propSchema);
      if (coerced !== entry) {
        out ??= { ...value };
        out[key] = coerced;
      }
    }
    return out ?? value;
  }

  if (Array.isArray(value)) {
    const items = schema.items;
    if (!isRecord(items)) {
      return value;
    }
    let changed = false;
    const next = value.map((entry) => {
      const coerced = coerceToolArgsWithSchema(entry, items);
      if (coerced !== entry) {
        changed = true;
      }
      return coerced;
    });
    return changed ? next : value;
  }

  return value;
}

/**
 * Build a `prepareArguments` hook that runs the tool's own hook (if any) and
 * then coerces string args to the types its schema expects.
 */
export function withArgCoercion(
  schema: unknown,
  inner?: (args: unknown) => unknown,
): (args: unknown) => unknown {
  return (args: unknown) => {
    const prepared = inner ? inner(args) : args;
    return coerceToolArgsWithSchema(prepared, schema);
  };
}
