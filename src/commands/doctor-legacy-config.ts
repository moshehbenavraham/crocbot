import type { crocbotConfig } from "../config/config.js";

// Legacy config normalization stub - WhatsApp migration removed
export function normalizeLegacyConfigValues(cfg: crocbotConfig): {
  config: crocbotConfig;
  changes: string[];
} {
  return { config: cfg, changes: [] };
}
