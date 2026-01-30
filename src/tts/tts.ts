// TTS module removed - stubs for compatibility

import type { crocbotConfig } from "../config/config.js";

export const TTS_PROVIDERS = ["edge", "openai", "elevenlabs"] as const;
export type TtsProvider = (typeof TTS_PROVIDERS)[number];

export const TTS_PROVIDER_LABELS: Record<TtsProvider, string> = {
  edge: "Microsoft Edge (disabled)",
  openai: "OpenAI (disabled)",
  elevenlabs: "ElevenLabs (disabled)",
};

export type TtsConfig = {
  enabled: boolean;
  provider: TtsProvider;
  maxLength?: number;
  summarization?: boolean;
  autoMode?: string;
  apiKey?: string;
  mode?: string;
};

export type TtsStatus = {
  enabled: false;
  provider: TtsProvider;
  available: false;
};

export type TtsResult = {
  success: boolean;
  audioPath?: string;
  error?: string;
  provider?: TtsProvider;
  latencyMs?: number;
  voiceCompatible?: boolean;
};

export type TtsAttempt = {
  timestamp: number;
  success: boolean;
  textLength: number;
  summarized: boolean;
  provider?: TtsProvider;
  latencyMs?: number;
  error?: string;
};

let _lastAttempt: TtsAttempt | null = null;

export function getTtsStatus(): TtsStatus {
  return { enabled: false, provider: "edge", available: false };
}

export function setTtsEnabled(_prefsPath: string, _enabled: boolean): void {}

export function setTtsProvider(_prefsPath: string, _provider: TtsProvider): void {}

export async function convertTts(_text: string): Promise<Buffer | null> {
  return null;
}

export function buildTtsSystemPromptHint(_config?: unknown): string {
  return "";
}

export async function textToSpeech(_opts: {
  text: string;
  cfg: crocbotConfig;
  channel?: string;
  prefsPath?: string;
}): Promise<TtsResult> {
  return { success: false, error: "TTS functionality has been removed" };
}

export async function textToSpeechTelephony(
  _text: string,
  _opts?: unknown,
): Promise<Buffer | null> {
  return null;
}

export function getLastTtsAttempt(): TtsAttempt | null {
  return _lastAttempt;
}

export function setLastTtsAttempt(attempt: TtsAttempt): void {
  _lastAttempt = attempt;
}

export function getTtsMaxLength(_prefsPath: string): number {
  return 1500;
}

export function setTtsMaxLength(_prefsPath: string, _length: number): void {}

export function getTtsProvider(_config: TtsConfig, _prefsPath: string): TtsProvider {
  return "edge";
}

export function isTtsEnabled(_config: TtsConfig, _prefsPath: string): boolean {
  return false;
}

export function isTtsProviderConfigured(_config: TtsConfig, _provider?: TtsProvider): boolean {
  return false;
}

export function isSummarizationEnabled(_prefsPath: string): boolean {
  return false;
}

export function setSummarizationEnabled(_prefsPath: string, _enabled: boolean): void {}

export function resolveTtsApiKey(_config: TtsConfig, _provider?: TtsProvider): string | null {
  return null;
}

export function resolveTtsConfig(_cfg: crocbotConfig): TtsConfig {
  return { enabled: false, provider: "edge" };
}

export function resolveTtsPrefsPath(_config: TtsConfig): string {
  return "";
}

export function resolveTtsAutoMode(_opts: {
  config: TtsConfig;
  prefsPath: string;
  sessionAuto?: string;
}): string {
  return "off";
}

export function normalizeTtsAutoMode(_mode: unknown): string {
  return "off";
}

// Returns the payload as-is (TTS disabled), but the type includes optional TTS properties
// so callers can check for them after the call
export async function maybeApplyTtsToPayload<T extends { text?: string }>(opts: {
  payload: T;
  cfg: crocbotConfig;
  channel?: string;
  kind?: string;
  inboundAudio?: boolean;
  ttsAuto?: string;
}): Promise<T & { mediaUrl?: string; audioAsVoice?: boolean }> {
  return opts.payload as T & { mediaUrl?: string; audioAsVoice?: boolean };
}
