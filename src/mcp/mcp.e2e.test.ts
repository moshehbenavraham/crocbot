import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterEach, describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Helpers: subprocess lifecycle for stdio MCP test server
// ---------------------------------------------------------------------------

const TEST_SERVER_PATH = path.resolve("test/fixtures/mcp-test-server.mjs");
const READY_SIGNAL = "MCP_TEST_SERVER_READY";
const READY_TIMEOUT_MS = 10_000;
const KILL_TIMEOUT_MS = 3_000;

/** Spawn the test MCP server and wait for the ready signal on stderr. */
function spawnTestServer(): {
  child: ChildProcess;
  ready: Promise<void>;
} {
  const child = spawn(process.execPath, [TEST_SERVER_PATH], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  const ready = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Test server did not emit ready signal in time"));
    }, READY_TIMEOUT_MS);

    let stderrBuf = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderrBuf += chunk.toString();
      if (stderrBuf.includes(READY_SIGNAL)) {
        clearTimeout(timer);
        resolve();
      }
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on("exit", (code) => {
      clearTimeout(timer);
      if (!stderrBuf.includes(READY_SIGNAL)) {
        reject(new Error(`Test server exited prematurely with code ${code}`));
      }
    });
  });

  return { child, ready };
}

/** Kill a child process with SIGTERM, then SIGKILL after timeout. */
async function killChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.killed) {
    return;
  }

  return new Promise<void>((resolve) => {
    const forceKill = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        // already dead
      }
    }, KILL_TIMEOUT_MS);

    child.on("exit", () => {
      clearTimeout(forceKill);
      resolve();
    });

    child.kill("SIGTERM");
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MCP client E2E (stdio transport)", () => {
  let child: ChildProcess | null = null;
  let client: Client | null = null;

  afterEach(async () => {
    if (client) {
      try {
        await client.close();
      } catch {
        // ignore
      }
      client = null;
    }
    if (child) {
      await killChild(child);
      child = null;
    }
  });

  it("connects to subprocess, lists tools, and calls echo tool", async () => {
    const server = spawnTestServer();
    child = server.child;
    await server.ready;

    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [TEST_SERVER_PATH],
    });

    client = new Client({ name: "e2e-test", version: "1.0.0" });
    await client.connect(transport);

    // List tools
    const toolsResult = await client.listTools();
    const toolNames = toolsResult.tools.map((t) => t.name).toSorted();
    expect(toolNames).toEqual(["add", "echo", "slow-response"]);

    // Call echo tool
    const echoResult = await client.callTool({
      name: "echo",
      arguments: { message: "hello from e2e" },
    });
    expect(echoResult.content).toEqual([{ type: "text", text: "hello from e2e" }]);

    // Call add tool
    const addResult = await client.callTool({
      name: "add",
      arguments: { a: 3, b: 7 },
    });
    expect(addResult.content).toEqual([{ type: "text", text: "10" }]);
  }, 30_000);

  it("reconnects after server restart: close client, spawn new server, call tool succeeds", async () => {
    // First connection
    const server1 = spawnTestServer();
    child = server1.child;
    await server1.ready;

    const transport1 = new StdioClientTransport({
      command: process.execPath,
      args: [TEST_SERVER_PATH],
    });

    client = new Client({ name: "e2e-test-reconnect", version: "1.0.0" });
    await client.connect(transport1);

    // Verify first connection works
    const echo1 = await client.callTool({
      name: "echo",
      arguments: { message: "before restart" },
    });
    expect(echo1.content).toEqual([{ type: "text", text: "before restart" }]);

    // Close client and kill first server
    await client.close();
    client = null;
    await killChild(child);
    child = null;

    // Spawn a fresh server and reconnect
    const server2 = spawnTestServer();
    child = server2.child;
    await server2.ready;

    const transport2 = new StdioClientTransport({
      command: process.execPath,
      args: [TEST_SERVER_PATH],
    });

    client = new Client({ name: "e2e-test-reconnect-2", version: "1.0.0" });
    await client.connect(transport2);

    // Verify second connection works
    const echo2 = await client.callTool({
      name: "echo",
      arguments: { message: "after restart" },
    });
    expect(echo2.content).toEqual([{ type: "text", text: "after restart" }]);

    // Also verify tool listing still works
    const toolsResult = await client.listTools();
    expect(toolsResult.tools).toHaveLength(3);
  }, 30_000);

  it("times out when calling slow tool with short timeout", async () => {
    const server = spawnTestServer();
    child = server.child;
    await server.ready;

    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [TEST_SERVER_PATH],
    });

    client = new Client({ name: "e2e-test-timeout", version: "1.0.0" });
    await client.connect(transport);

    // Call slow-response with 5s delay but 500ms timeout
    await expect(
      client.callTool({ name: "slow-response", arguments: { delay_ms: 5000 } }, undefined, {
        signal: AbortSignal.timeout(500),
      }),
    ).rejects.toThrow();
  }, 30_000);
});
