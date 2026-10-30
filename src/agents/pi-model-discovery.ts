import { AuthStorage, ModelRegistry } from "@earendil-works/pi-coding-agent";
import path from "node:path";

export { AuthStorage, ModelRegistry } from "@earendil-works/pi-coding-agent";

// Compatibility helpers for pi-coding-agent 0.50+ (discover* helpers removed).
export function discoverAuthStorage(agentDir: string): AuthStorage {
  return AuthStorage.create(path.join(agentDir, "auth.json"));
}

export function discoverModels(authStorage: AuthStorage, agentDir: string): ModelRegistry {
  return ModelRegistry.create(authStorage, path.join(agentDir, "models.json"));
}
