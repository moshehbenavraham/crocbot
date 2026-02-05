import { type IncomingMessage, type ServerResponse } from "node:http";
import { describe, expect, it } from "vitest";

import { handleSetupHttpRequest } from "./setup-http.js";
import type { ResolvedGatewayAuth } from "./auth.js";

function createMockReq(overrides: Partial<IncomingMessage> = {}): IncomingMessage {
  return {
    method: "GET",
    url: "/setup/export",
    headers: { host: "localhost:8080", authorization: "Bearer test-token" },
    socket: { remoteAddress: "127.0.0.1" },
    ...overrides,
  } as unknown as IncomingMessage;
}

function createMockRes(): ServerResponse & {
  _body: string;
  _status: number;
  _headers: Record<string, string>;
} {
  const res = {
    _body: "",
    _status: 0,
    _headers: {} as Record<string, string>,
    statusCode: 0,
    setHeader(name: string, value: string) {
      res._headers[name.toLowerCase()] = value;
    },
    end(body?: string) {
      if (body) {
        res._body = body;
      }
      res._status = res.statusCode;
    },
  } as unknown as ServerResponse & {
    _body: string;
    _status: number;
    _headers: Record<string, string>;
  };
  return res;
}

const AUTH: ResolvedGatewayAuth = {
  mode: "token",
  token: "test-token",
  allowTailscale: false,
};

describe("handleSetupHttpRequest", () => {
  it("returns false for non-matching paths", async () => {
    const req = createMockReq({ url: "/health" });
    const res = createMockRes();
    const handled = await handleSetupHttpRequest(req, res, { auth: AUTH });
    expect(handled).toBe(false);
  });

  it("returns 405 for non-GET methods", async () => {
    const req = createMockReq({ method: "POST" });
    const res = createMockRes();
    const handled = await handleSetupHttpRequest(req, res, { auth: AUTH });
    expect(handled).toBe(true);
    expect(res._status).toBe(405);
  });

  it("returns 401 without authorization", async () => {
    const req = createMockReq({ headers: { host: "localhost:8080" } });
    const res = createMockRes();
    const handled = await handleSetupHttpRequest(req, res, { auth: AUTH });
    expect(handled).toBe(true);
    expect(res._status).toBe(401);
  });

  it("returns 401 with wrong token", async () => {
    const req = createMockReq({
      headers: { host: "localhost:8080", authorization: "Bearer wrong-token" },
    });
    const res = createMockRes();
    const handled = await handleSetupHttpRequest(req, res, { auth: AUTH });
    expect(handled).toBe(true);
    expect(res._status).toBe(401);
  });

  it("returns 200 with valid auth and includes exportedAt", async () => {
    const req = createMockReq();
    const res = createMockRes();
    const handled = await handleSetupHttpRequest(req, res, { auth: AUTH });

    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    expect(res._headers["content-type"]).toBe("application/json; charset=utf-8");

    const body = JSON.parse(res._body);
    expect(body).toHaveProperty("path");
    expect(body).toHaveProperty("exists");
    expect(body).toHaveProperty("valid");
    expect(body).toHaveProperty("exportedAt");
    expect(typeof body.exportedAt).toBe("string");
    // exportedAt should be a valid ISO date
    expect(new Date(body.exportedAt).toISOString()).toBe(body.exportedAt);
  });

  it("does not leak raw config text", async () => {
    const req = createMockReq();
    const res = createMockRes();
    await handleSetupHttpRequest(req, res, { auth: AUTH });

    const body = JSON.parse(res._body);
    // raw should not be present in the export response
    expect(body.raw).toBeUndefined();
    // parsed should not be present
    expect(body.parsed).toBeUndefined();
    // issues/warnings should not be present
    expect(body.issues).toBeUndefined();
    expect(body.warnings).toBeUndefined();
  });
});
