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

describe("cron protocol conformance", () => {
  it("schema exposes cron channel providers", () => {
    const channels = extractCronChannels(CronPayloadSchema as SchemaLike);
    expect(channels.length).toBeGreaterThan(0);
  });
});
