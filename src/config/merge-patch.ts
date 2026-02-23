import { isPlainObject } from "../utils.js";

export type MergePatchOptions = {
  mergeObjectArraysById?: boolean;
};

function isObjectWithStringId(item: unknown): item is Record<string, unknown> & { id: string } {
  if (!isPlainObject(item)) {
    return false;
  }
  return typeof item.id === "string" && item.id !== "";
}

function mergeObjectArraysById(
  base: unknown[],
  patch: unknown[],
  options: MergePatchOptions,
): unknown[] {
  if (!base.every(isObjectWithStringId) || !patch.every(isObjectWithStringId)) {
    return patch;
  }

  const index = new Map<string, Record<string, unknown>>();
  const order: string[] = [];
  for (const item of base) {
    index.set(item.id, { ...item });
    order.push(item.id);
  }

  for (const item of patch) {
    if (item === null) {
      continue;
    }
    const existing = index.get(item.id);
    if (existing) {
      index.set(item.id, applyMergePatch(existing, item, options) as Record<string, unknown>);
    } else {
      index.set(item.id, { ...item });
      order.push(item.id);
    }
  }

  return order.filter((id) => index.has(id)).map((id) => index.get(id)!);
}

export function applyMergePatch(
  base: unknown,
  patch: unknown,
  options: MergePatchOptions = {},
): unknown {
  if (!isPlainObject(patch)) {
    return patch;
  }

  const result: Record<string, unknown> = isPlainObject(base) ? { ...base } : {};

  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      delete result[key];
      continue;
    }
    if (options.mergeObjectArraysById && Array.isArray(value) && Array.isArray(result[key])) {
      result[key] = mergeObjectArraysById(result[key] as unknown[], value, options);
      continue;
    }
    if (isPlainObject(value)) {
      const baseValue = result[key];
      result[key] = applyMergePatch(isPlainObject(baseValue) ? baseValue : {}, value, options);
      continue;
    }
    result[key] = value;
  }

  return result;
}
