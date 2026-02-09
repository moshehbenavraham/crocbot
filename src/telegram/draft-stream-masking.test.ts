import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makePlaceholder } from "../infra/secrets/masker.js";
import { SecretsRegistry } from "../infra/secrets/registry.js";
import { createTelegramDraftStream } from "./draft-stream.js";

describe("Telegram draft stream masking", () => {
  beforeEach(() => {
    SecretsRegistry.reset();
  });

  afterEach(() => {
    SecretsRegistry.reset();
  });

  function createMockApi() {
    return {
      sendMessageDraft: vi.fn().mockResolvedValue(undefined),
    };
  }

  function createStream(api: ReturnType<typeof createMockApi>) {
    return createTelegramDraftStream({
      // oxlint-disable-next-line typescript/no-explicit-any -- mock api
      api: api as any,
      chatId: 123,
      draftId: 1,
      throttleMs: 50,
    });
  }

  // ---------------------------------------------------------------------------
  // Masking behavior
  // ---------------------------------------------------------------------------

  describe("masking", () => {
    it("masks secret in draft text before sendMessageDraft", async () => {
      const secret = "sk-test-abc123XYZ";
      const registry = SecretsRegistry.getInstance({ minLength: 4 });
      registry.register("api-key", secret);
      const placeholder = makePlaceholder(secret);

      const api = createMockApi();
      const stream = createStream(api);

      stream.update(`The key is ${secret}`);
      await stream.flush();

      expect(api.sendMessageDraft).toHaveBeenCalledOnce();
      const sentText = api.sendMessageDraft.mock.calls[0][2];
      expect(sentText).toBe(`The key is ${placeholder}`);
      expect(sentText).not.toContain(secret);

      stream.stop();
    });

    it("masks multiple secrets in draft text", async () => {
      const secret1 = "first-secret-value-abc";
      const secret2 = "second-secret-value-xyz";
      const registry = SecretsRegistry.getInstance({ minLength: 4 });
      registry.register("key1", secret1);
      registry.register("key2", secret2);

      const api = createMockApi();
      const stream = createStream(api);

      stream.update(`Keys: ${secret1} and ${secret2}`);
      await stream.flush();

      const sentText = api.sendMessageDraft.mock.calls[0][2];
      expect(sentText).not.toContain(secret1);
      expect(sentText).not.toContain(secret2);
      expect(sentText).toContain(makePlaceholder(secret1));
      expect(sentText).toContain(makePlaceholder(secret2));

      stream.stop();
    });
  });

  // ---------------------------------------------------------------------------
  // No-op when registry is empty
  // ---------------------------------------------------------------------------

  describe("no-op", () => {
    it("sends text unchanged when registry is empty", async () => {
      SecretsRegistry.getInstance();

      const api = createMockApi();
      const stream = createStream(api);

      stream.update("Hello world");
      await stream.flush();

      expect(api.sendMessageDraft).toHaveBeenCalledOnce();
      const sentText = api.sendMessageDraft.mock.calls[0][2];
      expect(sentText).toBe("Hello world");

      stream.stop();
    });
  });

  // ---------------------------------------------------------------------------
  // Deduplication uses masked text
  // ---------------------------------------------------------------------------

  describe("deduplication", () => {
    it("deduplicates based on masked text, not raw text", async () => {
      const secret = "unique-secret-for-dedup";
      const registry = SecretsRegistry.getInstance({ minLength: 4 });
      registry.register("key", secret);

      const api = createMockApi();
      const stream = createStream(api);

      // Send same text twice -- should deduplicate after masking
      stream.update(`Value: ${secret}`);
      await stream.flush();
      stream.update(`Value: ${secret}`);
      await stream.flush();

      // Only one call because masked text is identical
      expect(api.sendMessageDraft).toHaveBeenCalledOnce();

      stream.stop();
    });
  });
});
