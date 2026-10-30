import { convertMessages } from "@earendil-works/pi-ai/dist/providers/google-shared.js";
import type { Context, Model } from "@earendil-works/pi-ai/dist/types.js";
import { describe, expect, it } from "vitest";

const asRecord = (value: unknown): Record<string, unknown> => {
  expect(value).toBeTruthy();
  expect(typeof value).toBe("object");
  expect(Array.isArray(value)).toBe(false);
  return value as Record<string, unknown>;
};

const makeModel = (id: string): Model<"google-generative-ai"> =>
  ({
    id,
    name: id,
    api: "google-generative-ai",
    provider: "google",
    baseUrl: "https://example.invalid",
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 1,
    maxTokens: 1,
  }) as Model<"google-generative-ai">;

const makeGeminiCliModel = (id: string): Model<"google-gemini-cli"> =>
  ({
    id,
    name: id,
    api: "google-gemini-cli",
    provider: "google-gemini-cli",
    baseUrl: "https://example.invalid",
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 1,
    maxTokens: 1,
  }) as Model<"google-gemini-cli">;

describe("google-shared convertTools", () => {
  it("ensures function call comes after user turn, not after model turn", () => {
    const model = makeModel("gemini-1.5-pro");
    const context = {
      messages: [
        {
          role: "user",
          content: "Hello",
        },
        {
          role: "assistant",
          content: [{ type: "text", text: "Hi!" }],
          api: "google-generative-ai",
          provider: "google",
          model: "gemini-1.5-pro",
          usage: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 0,
            cost: {
              input: 0,
              output: 0,
              cacheRead: 0,
              cacheWrite: 0,
              total: 0,
            },
          },
          stopReason: "stop",
          timestamp: 0,
        },
        {
          role: "assistant",
          content: [
            {
              type: "toolCall",
              id: "call_1",
              name: "myTool",
              arguments: {},
            },
          ],
          api: "google-generative-ai",
          provider: "google",
          model: "gemini-1.5-pro",
          usage: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 0,
            cost: {
              input: 0,
              output: 0,
              cacheRead: 0,
              cacheWrite: 0,
              total: 0,
            },
          },
          stopReason: "stop",
          timestamp: 0,
        },
      ],
    } as unknown as Context;

    const contents = convertMessages(model, context);
    // pi-ai >= 0.74 (transformMessages) also closes a *trailing* orphaned tool call with a
    // synthetic error tool result ("No result provided"). pi-ai 0.52 only did this when a
    // later user/assistant message followed. So there is now a 4th content: a user turn
    // carrying the functionResponse, which keeps the function call paired for Gemini.
    expect(contents).toHaveLength(4);
    expect(contents.map((content) => content.role)).toEqual(["user", "model", "model", "user"]);
    const callIndex = contents.findIndex((content) =>
      content.parts?.some(
        (part) => typeof part === "object" && part !== null && "functionCall" in part,
      ),
    );
    expect(callIndex).toBe(2);
    const toolCallPart = contents[callIndex].parts?.find(
      (part) => typeof part === "object" && part !== null && "functionCall" in part,
    );
    const toolCall = asRecord(toolCallPart);
    expect(toolCall.functionCall).toBeTruthy();
    // The conversation (and therefore the function call) is preceded by a user turn.
    expect(contents.slice(0, callIndex).some((content) => content.role === "user")).toBe(true);
    expect(contents[0].role).toBe("user");
    // ...and the function call is immediately answered by a user functionResponse turn.
    const responsePart = asRecord(
      contents[callIndex + 1].parts?.find(
        (part) => typeof part === "object" && part !== null && "functionResponse" in part,
      ),
    );
    const functionResponse = asRecord(responsePart.functionResponse);
    expect(functionResponse.name).toBe("myTool");
    expect(functionResponse.response).toEqual({ error: "No result provided" });
  });

  it("strips tool call and response ids for google-gemini-cli", () => {
    const model = makeGeminiCliModel("gemini-3-flash");
    const context = {
      messages: [
        {
          role: "user",
          content: "Use a tool",
        },
        {
          role: "assistant",
          content: [
            {
              type: "toolCall",
              id: "call_1",
              name: "myTool",
              arguments: { arg: "value" },
              thoughtSignature: "dGVzdA==",
            },
          ],
          api: "google-gemini-cli",
          provider: "google-gemini-cli",
          model: "gemini-3-flash",
          usage: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 0,
            cost: {
              input: 0,
              output: 0,
              cacheRead: 0,
              cacheWrite: 0,
              total: 0,
            },
          },
          stopReason: "stop",
          timestamp: 0,
        },
        {
          role: "toolResult",
          toolCallId: "call_1",
          toolName: "myTool",
          content: [{ type: "text", text: "Tool result" }],
          isError: false,
          timestamp: 0,
        },
      ],
    } as unknown as Context;

    const contents = convertMessages(model, context);
    const parts = contents.flatMap((content) => content.parts ?? []);
    const toolCallPart = parts.find(
      (part) => typeof part === "object" && part !== null && "functionCall" in part,
    );
    const toolResponsePart = parts.find(
      (part) => typeof part === "object" && part !== null && "functionResponse" in part,
    );

    const toolCall = asRecord(toolCallPart);
    const toolResponse = asRecord(toolResponsePart);

    expect(asRecord(toolCall.functionCall).id).toBeUndefined();
    expect(asRecord(toolResponse.functionResponse).id).toBeUndefined();
  });
});
