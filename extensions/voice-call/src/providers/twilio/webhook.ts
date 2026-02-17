import type { WebhookContext, WebhookVerificationResult } from "../../types.js";
import { verifyTwilioWebhook } from "../../webhook-security.js";

import type { TwilioProviderOptions } from "../twilio.js";

/** Strip newlines and control characters from external strings before logging. */
const sanitizeLogStr = (s: string) => s.replace(/[\x00-\x1f\x7f]/g, " ").slice(0, 500);

export function verifyTwilioProviderWebhook(params: {
  ctx: WebhookContext;
  authToken: string;
  currentPublicUrl?: string | null;
  options: TwilioProviderOptions;
}): WebhookVerificationResult {
  const result = verifyTwilioWebhook(params.ctx, params.authToken, {
    publicUrl: params.currentPublicUrl || undefined,
    allowNgrokFreeTierLoopbackBypass:
      params.options.allowNgrokFreeTierLoopbackBypass ?? false,
    skipVerification: params.options.skipVerification,
    allowedHosts: params.options.webhookSecurity?.allowedHosts,
    trustForwardingHeaders: params.options.webhookSecurity?.trustForwardingHeaders,
    trustedProxyIPs: params.options.webhookSecurity?.trustedProxyIPs,
    remoteIP: params.ctx.remoteAddress,
  });

  if (!result.ok) {
    console.warn(`[twilio] Webhook verification failed: ${sanitizeLogStr(result.reason ?? "unknown")}`);
    if (result.verificationUrl) {
      console.warn(`[twilio] Verification URL: ${sanitizeLogStr(result.verificationUrl)}`);
    }
  }

  return {
    ok: result.ok,
    reason: result.reason,
  };
}
