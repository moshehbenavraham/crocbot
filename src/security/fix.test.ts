import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { fixSecurityFootguns } from "./fix.js";

const expectPerms = (actual: number, expected: number) => {
  expect(actual).toBe(expected);
};

describe("security fix", () => {
  it("tightens groupPolicy + filesystem perms", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "crocbot-security-fix-"));
    const stateDir = path.join(tmp, "state");
    await fs.mkdir(stateDir, { recursive: true });
    await fs.chmod(stateDir, 0o755);

    const configPath = path.join(stateDir, "crocbot.json");
    await fs.writeFile(
      configPath,
      `${JSON.stringify(
        {
          channels: {
            telegram: { groupPolicy: "open" },
          },
          logging: { redactSensitive: "off" },
        },
        null,
        2,
      )}\n`,
      "utf-8",
    );
    await fs.chmod(configPath, 0o644);

    const env = {
      ...process.env,
      CROCBOT_STATE_DIR: stateDir,
      CROCBOT_CONFIG_PATH: "",
    };

    const res = await fixSecurityFootguns({ env });
    expect(res.ok).toBe(true);
    expect(res.configWritten).toBe(true);
    expect(res.changes).toEqual(
      expect.arrayContaining([
        "channels.telegram.groupPolicy=open -> allowlist",
        'logging.redactSensitive=off -> "tools"',
      ]),
    );

    const parsed = JSON.parse(await fs.readFile(configPath, "utf-8")) as Record<string, unknown>;
    const channels = parsed.channels as Record<string, Record<string, unknown>>;
    expect(channels.telegram.groupPolicy).toBe("allowlist");

    const stateMode = (await fs.stat(stateDir)).mode & 0o777;
    expectPerms(stateMode, 0o700);

    const configMode = (await fs.stat(configPath)).mode & 0o777;
    expectPerms(configMode, 0o600);
  });

  it("returns ok=false for invalid config but still tightens perms", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "crocbot-security-fix-"));
    const stateDir = path.join(tmp, "state");
    await fs.mkdir(stateDir, { recursive: true });
    await fs.chmod(stateDir, 0o755);

    const configPath = path.join(stateDir, "crocbot.json");
    await fs.writeFile(configPath, "{ this is not json }\n", "utf-8");
    await fs.chmod(configPath, 0o644);

    const env = {
      ...process.env,
      CROCBOT_STATE_DIR: stateDir,
      CROCBOT_CONFIG_PATH: "",
    };

    const res = await fixSecurityFootguns({ env });
    expect(res.ok).toBe(false);

    const stateMode = (await fs.stat(stateDir)).mode & 0o777;
    expectPerms(stateMode, 0o700);

    const configMode = (await fs.stat(configPath)).mode & 0o777;
    expectPerms(configMode, 0o600);
  });

  it("tightens perms for credentials + agent auth/sessions files", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "crocbot-security-fix-"));
    const stateDir = path.join(tmp, "state");
    await fs.mkdir(stateDir, { recursive: true });

    const configPath = path.join(stateDir, "crocbot.json");
    await fs.writeFile(
      configPath,
      `${JSON.stringify({ channels: { telegram: { groupPolicy: "open" } } }, null, 2)}\n`,
      "utf-8",
    );
    await fs.chmod(configPath, 0o644);

    const credsDir = path.join(stateDir, "credentials");
    await fs.mkdir(credsDir, { recursive: true });
    await fs.chmod(credsDir, 0o755);
    const credentialFile = path.join(credsDir, "token.json");
    await fs.writeFile(credentialFile, '{"secret": "value"}\n', "utf-8");
    await fs.chmod(credentialFile, 0o644);

    const agentDir = path.join(stateDir, "agents", "main", "agent");
    await fs.mkdir(agentDir, { recursive: true });
    const authProfilesPath = path.join(agentDir, "auth-profiles.json");
    await fs.writeFile(authProfilesPath, "{}\n", "utf-8");
    await fs.chmod(authProfilesPath, 0o644);

    const sessionsDir = path.join(stateDir, "agents", "main", "sessions");
    await fs.mkdir(sessionsDir, { recursive: true });
    const sessionsStorePath = path.join(sessionsDir, "sessions.json");
    await fs.writeFile(sessionsStorePath, "{}\n", "utf-8");
    await fs.chmod(sessionsStorePath, 0o644);

    const env = {
      ...process.env,
      CROCBOT_STATE_DIR: stateDir,
      CROCBOT_CONFIG_PATH: "",
    };

    const res = await fixSecurityFootguns({ env });
    expect(res.ok).toBe(true);

    expectPerms((await fs.stat(credsDir)).mode & 0o777, 0o700);
    expectPerms((await fs.stat(credentialFile)).mode & 0o777, 0o600);
    expectPerms((await fs.stat(authProfilesPath)).mode & 0o777, 0o600);
    expectPerms((await fs.stat(sessionsStorePath)).mode & 0o777, 0o600);
  });
});
