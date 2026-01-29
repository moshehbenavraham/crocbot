import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CronPayloadSchema } from "../gateway/protocol/schema.js";

type SchemaLike = {
  anyOf?: Array<{ properties?: Record<string, unknown> }>;
  properties?: Record<string, unknown>;
  const?: unknown;
};

type ProviderSchema = {
  anyOf?: Array<{ const?: unknown }>;
};

function extractCronChannels(schema: SchemaLike): string[] {
  const union = schema.anyOf ?? [];
  const payloadWithChannel = union.find((entry) =>
    Boolean(entry?.properties && "channel" in entry.properties),
  );
  const channelSchema = payloadWithChannel?.properties
    ? (payloadWithChannel.properties.channel as ProviderSchema)
    : undefined;
  const channels = (channelSchema?.anyOf ?? [])
    .map((entry) => entry?.const)
    .filter((value): value is string => typeof value === "string");
  return channels;
}

const UI_FILES = ["ui/src/ui/types.ts", "ui/src/ui/ui-types.ts", "ui/src/ui/views/cron.ts"];

describe("cron protocol conformance", () => {
  it("ui includes all cron providers from gateway schema", async () => {
    const channels = extractCronChannels(CronPayloadSchema as SchemaLike);
    expect(channels.length).toBeGreaterThan(0);

    const cwd = process.cwd();
    for (const relPath of UI_FILES) {
      const content = await fs.readFile(path.join(cwd, relPath), "utf-8");
      for (const channel of channels) {
        expect(content.includes(`"${channel}"`), `${relPath} missing ${channel}`).toBe(true);
      }
    }
  });

  it("cron status shape matches gateway fields in UI", async () => {
    const cwd = process.cwd();
    const uiTypes = await fs.readFile(path.join(cwd, "ui/src/ui/types.ts"), "utf-8");
    expect(uiTypes.includes("export type CronStatus")).toBe(true);
    expect(uiTypes.includes("jobs:")).toBe(true);
    expect(uiTypes.includes("jobCount")).toBe(false);
  });
});
