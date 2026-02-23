import net from "node:net";
import { runCommandWithTimeout } from "../process/exec.js";
import { resolveLsofCommand } from "./ports-lsof.js";
import { buildPortHints } from "./ports-format.js";
import type { PortListener, PortUsage, PortUsageStatus } from "./ports-types.js";

type CommandResult = {
  stdout: string;
  stderr: string;
  code: number;
  error?: string;
};

function isErrno(err: unknown): err is NodeJS.ErrnoException {
  return Boolean(err && typeof err === "object" && "code" in err);
}

async function runCommandSafe(argv: string[], timeoutMs = 5_000): Promise<CommandResult> {
  try {
    const res = await runCommandWithTimeout(argv, { timeoutMs });
    return {
      stdout: res.stdout,
      stderr: res.stderr,
      code: res.code ?? 1,
    };
  } catch (err) {
    return {
      stdout: "",
      stderr: "",
      code: 1,
      error: String(err),
    };
  }
}

function parseLsofFieldOutput(output: string): PortListener[] {
  const lines = output.split(/\r?\n/).filter(Boolean);
  const listeners: PortListener[] = [];
  let current: PortListener = {};
  for (const line of lines) {
    if (line.startsWith("p")) {
      if (current.pid || current.command) {
        listeners.push(current);
      }
      const pid = Number.parseInt(line.slice(1), 10);
      current = Number.isFinite(pid) ? { pid } : {};
    } else if (line.startsWith("c")) {
      current.command = line.slice(1);
    } else if (line.startsWith("n")) {
      // TCP 127.0.0.1:18789 (LISTEN)
      // TCP *:18789 (LISTEN)
      if (!current.address) {
        current.address = line.slice(1);
      }
    }
  }
  if (current.pid || current.command) {
    listeners.push(current);
  }
  return listeners;
}

async function resolveUnixCommandLine(pid: number): Promise<string | undefined> {
  const res = await runCommandSafe(["ps", "-p", String(pid), "-o", "command="]);
  if (res.code !== 0) {
    return undefined;
  }
  const line = res.stdout.trim();
  return line || undefined;
}

async function resolveUnixUser(pid: number): Promise<string | undefined> {
  const res = await runCommandSafe(["ps", "-p", String(pid), "-o", "user="]);
  if (res.code !== 0) {
    return undefined;
  }
  const line = res.stdout.trim();
  return line || undefined;
}

async function readUnixListeners(
  port: number,
): Promise<{ listeners: PortListener[]; detail?: string; errors: string[] }> {
  const errors: string[] = [];
  const safePort = Math.trunc(port);
  if (!Number.isFinite(safePort) || safePort < 0 || safePort > 65535) {
    return { listeners: [], errors: ["invalid port number"] };
  }
  const lsof = await resolveLsofCommand();
  const res = await runCommandSafe([lsof, "-nP", `-iTCP:${safePort}`, "-sTCP:LISTEN", "-FpFcn"]);
  if (res.code === 0) {
    const listeners = parseLsofFieldOutput(res.stdout);
    await Promise.all(
      listeners.map(async (listener) => {
        if (!listener.pid) {
          return;
        }
        const [commandLine, user] = await Promise.all([
          resolveUnixCommandLine(listener.pid),
          resolveUnixUser(listener.pid),
        ]);
        if (commandLine) {
          listener.commandLine = commandLine;
        }
        if (user) {
          listener.user = user;
        }
      }),
    );
    return { listeners, detail: res.stdout.trim() || undefined, errors };
  }
  const stderr = res.stderr.trim();
  if (res.code === 1 && !res.error && !stderr) {
    return { listeners: [], detail: undefined, errors };
  }
  if (res.error) {
    errors.push(res.error);
  }
  const detail = [stderr, res.stdout.trim()].filter(Boolean).join("\n");
  if (detail) {
    errors.push(detail);
  }
  return { listeners: [], detail: undefined, errors };
}

async function tryListenOnHost(port: number, host: string): Promise<PortUsageStatus | "skip"> {
  try {
    await new Promise<void>((resolve, reject) => {
      const tester = net
        .createServer()
        .once("error", (err) => reject(err))
        .once("listening", () => {
          tester.close(() => resolve());
        })
        .listen({ port, host, exclusive: true });
    });
    return "free";
  } catch (err) {
    if (isErrno(err) && err.code === "EADDRINUSE") {
      return "busy";
    }
    if (isErrno(err) && (err.code === "EADDRNOTAVAIL" || err.code === "EAFNOSUPPORT")) {
      return "skip";
    }
    return "unknown";
  }
}

async function checkPortInUse(port: number): Promise<PortUsageStatus> {
  const hosts = ["127.0.0.1", "0.0.0.0", "::1", "::"];
  let sawUnknown = false;
  for (const host of hosts) {
    const result = await tryListenOnHost(port, host);
    if (result === "busy") {
      return "busy";
    }
    if (result === "unknown") {
      sawUnknown = true;
    }
  }
  return sawUnknown ? "unknown" : "free";
}

export async function inspectPortUsage(port: number): Promise<PortUsage> {
  const errors: string[] = [];
  const result = await readUnixListeners(port);
  errors.push(...result.errors);
  let listeners = result.listeners;
  let status: PortUsageStatus = listeners.length > 0 ? "busy" : "unknown";
  if (listeners.length === 0) {
    status = await checkPortInUse(port);
  }
  if (status !== "busy") {
    listeners = [];
  }
  const hints = buildPortHints(listeners, port);
  if (status === "busy" && listeners.length === 0) {
    hints.push(
      "Port is in use but process details are unavailable (install lsof or run as an admin user).",
    );
  }
  return {
    port,
    status,
    listeners,
    hints,
    detail: result.detail,
    errors: errors.length > 0 ? errors : undefined,
  };
}
