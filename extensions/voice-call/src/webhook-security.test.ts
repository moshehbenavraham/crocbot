import crypto from "node:crypto";

import { describe, expect, it } from "vitest";

import { verifyTwilioWebhook } from "./webhook-security.js";

function twilioSignature(params: {
  authToken: string;
  url: string;
  postBody: string;
}): string {
  let dataToSign = params.url;
  const sortedParams = Array.from(
    new URLSearchParams(params.postBody).entries(),
  ).sort((a, b) => a[0].localeCompare(b[0]));

  for (const [key, value] of sortedParams) {
    dataToSign += key + value;
  }

  return crypto
    .createHmac("sha1", params.authToken)
    .update(dataToSign)
    .digest("base64");
}

describe("verifyTwilioWebhook", () => {
  it("uses request query when publicUrl omits it", () => {
    const authToken = "test-auth-token";
    const publicUrl = "https://example.com/voice/webhook";
    const urlWithQuery = `${publicUrl}?callId=abc`;
    const postBody = "CallSid=CS123&CallStatus=completed&From=%2B15550000000";

    const signature = twilioSignature({
      authToken,
      url: urlWithQuery,
      postBody,
    });

    const result = verifyTwilioWebhook(
      {
        headers: {
          host: "example.com",
          "x-forwarded-proto": "https",
          "x-twilio-signature": signature,
        },
        rawBody: postBody,
        url: "http://local/voice/webhook?callId=abc",
        method: "POST",
        query: { callId: "abc" },
      },
      authToken,
      { publicUrl },
    );

    expect(result.ok).toBe(true);
  });

  it("rejects invalid signatures from non-loopback even with ngrok bypass enabled", () => {
    const authToken = "test-auth-token";
    const postBody = "CallSid=CS123&CallStatus=completed&From=%2B15550000000";

    const result = verifyTwilioWebhook(
      {
        headers: {
          host: "127.0.0.1:3334",
          "x-forwarded-proto": "https",
          "x-forwarded-host": "attacker.ngrok-free.app",
          "x-twilio-signature": "invalid",
        },
        rawBody: postBody,
        url: "http://127.0.0.1:3334/voice/webhook",
        method: "POST",
        remoteAddress: "203.0.113.10",
      },
      authToken,
      { allowNgrokFreeTierLoopbackBypass: true },
    );

    // Non-loopback IP: forwarding headers are NOT trusted, so ngrok domain is not detected
    expect(result.ok).toBe(false);
    expect(result.isNgrokFreeTier).toBe(false);
    expect(result.reason).toMatch(/Invalid signature/);
  });

  it("allows invalid signatures for ngrok free tier only on loopback", () => {
    const authToken = "test-auth-token";
    const postBody = "CallSid=CS123&CallStatus=completed&From=%2B15550000000";

    const result = verifyTwilioWebhook(
      {
        headers: {
          host: "127.0.0.1:3334",
          "x-forwarded-proto": "https",
          "x-forwarded-host": "local.ngrok-free.app",
          "x-twilio-signature": "invalid",
        },
        rawBody: postBody,
        url: "http://127.0.0.1:3334/voice/webhook",
        method: "POST",
        remoteAddress: "127.0.0.1",
      },
      authToken,
      { allowNgrokFreeTierLoopbackBypass: true },
    );

    expect(result.ok).toBe(true);
    expect(result.isNgrokFreeTier).toBe(true);
    expect(result.reason).toMatch(/compatibility mode/);
  });
});
