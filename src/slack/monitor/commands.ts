// Read-only mode: slash command configuration is disabled.

import type { SlackSlashCommandConfig } from "../../config/types.slack.js";

const DISABLED_SLASH_COMMAND_CONFIG: Required<SlackSlashCommandConfig> = {
  enabled: false,
  name: "crocbot",
  sessionPrefix: "slack:slash",
  ephemeral: true,
};

export function resolveSlackSlashCommandConfig(
  _config?: SlackSlashCommandConfig,
): Required<SlackSlashCommandConfig> {
  return DISABLED_SLASH_COMMAND_CONFIG;
}

export function buildSlackSlashCommandMatcher(): (_input: string) => false {
  return () => false;
}
