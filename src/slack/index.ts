// Read-only Slack module — no write-path exports (send, actions, format).
// See docs/ongoing-projects/slack-read-only-channel.md for rationale.

export {
  listEnabledSlackAccounts,
  listSlackAccountIds,
  resolveDefaultSlackAccountId,
  resolveSlackAccount,
  resolveSlackReplyToMode,
  type ResolvedSlackAccount,
  type SlackTokenSource,
} from "./accounts.js";
export { monitorSlackProvider } from "./monitor.js";
export { probeSlack, type SlackProbe } from "./probe.js";
export { resolveSlackAppToken, resolveSlackBotToken } from "./token.js";
