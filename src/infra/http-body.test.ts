import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import {
  RequestBodyLimitError,
  isRequestBodyLimitError,
  readJsonBodyWithLimit,
  readRequestBodyWithLimit,
  requestBodyErrorToText,
} from "./http-body.js";
import type { IncomingMessage } from "node:http";

function createMockRequest(opts?: {
  contentLength?: number;
}): PassThrough & { headers: Record<string, string>; destroyed: boolean; destroy: () => void } {
  const stream = new PassThrough() as PassThrough & {
    headers: Record<string, string>;
    destroyed: boolean;
    destroy: () => void;
  };
  stream.headers = {};
  if (opts?.contentLength !== undefined) {
    stream.headers["content-length"] = String(opts.contentLength);
  }
  stream.destroyed = false;
  const originalDestroy = stream.destroy.bind(stream);
  stream.destroy = () => {
    stream.destroyed = true;
    originalDestroy();
    return stream;
  };
  return stream;
}

describe("readRequestBodyWithLimit", () => {
  it("reads body within limit", async () => {
    const req = createMockRequest();
    const promise = readRequestBodyWithLimit(req as unknown as IncomingMessage, {
      maxBytes: 1024,
    });
    req.write("hello");
    req.end();
    const result = await promise;
    expect(result).toBe("hello");
  });

  it("rejects body exceeding limit via content-length header", async () => {
    const req = createMockRequest({ contentLength: 2000 });
    await expect(
      readRequestBodyWithLimit(req as unknown as IncomingMessage, { maxBytes: 1024 }),
    ).rejects.toThrow(RequestBodyLimitError);
  });

  it("rejects body exceeding limit during streaming", async () => {
    const req = createMockRequest();
    const promise = readRequestBodyWithLimit(req as unknown as IncomingMessage, {
      maxBytes: 10,
    });
    req.write("this is longer than ten bytes");
    await expect(promise).rejects.toThrow(RequestBodyLimitError);
  });

  it("handles timeout", async () => {
    const req = createMockRequest();
    await expect(
      readRequestBodyWithLimit(req as unknown as IncomingMessage, {
        maxBytes: 1024,
        timeoutMs: 50,
      }),
    ).rejects.toThrow(RequestBodyLimitError);
  });

  it("reads empty body", async () => {
    const req = createMockRequest();
    const promise = readRequestBodyWithLimit(req as unknown as IncomingMessage, {
      maxBytes: 1024,
    });
    req.end();
    const result = await promise;
    expect(result).toBe("");
  });
});

describe("readJsonBodyWithLimit", () => {
  it("parses valid JSON", async () => {
    const req = createMockRequest();
    const promise = readJsonBodyWithLimit(req as unknown as IncomingMessage, {
      maxBytes: 1024,
    });
    req.write(JSON.stringify({ key: "value" }));
    req.end();
    const result = await promise;
    expect(result).toEqual({ ok: true, value: { key: "value" } });
  });

  it("returns empty object for empty body by default", async () => {
    const req = createMockRequest();
    const promise = readJsonBodyWithLimit(req as unknown as IncomingMessage, {
      maxBytes: 1024,
    });
    req.end();
    const result = await promise;
    expect(result).toEqual({ ok: true, value: {} });
  });

  it("rejects empty body when emptyObjectOnEmpty is false", async () => {
    const req = createMockRequest();
    const promise = readJsonBodyWithLimit(req as unknown as IncomingMessage, {
      maxBytes: 1024,
      emptyObjectOnEmpty: false,
    });
    req.end();
    const result = await promise;
    expect(result.ok).toBe(false);
  });

  it("returns error for invalid JSON", async () => {
    const req = createMockRequest();
    const promise = readJsonBodyWithLimit(req as unknown as IncomingMessage, {
      maxBytes: 1024,
    });
    req.write("not json");
    req.end();
    const result = await promise;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INVALID_JSON");
    }
  });
});

describe("RequestBodyLimitError", () => {
  it("has correct code and statusCode for PAYLOAD_TOO_LARGE", () => {
    const err = new RequestBodyLimitError({ code: "PAYLOAD_TOO_LARGE" });
    expect(err.code).toBe("PAYLOAD_TOO_LARGE");
    expect(err.statusCode).toBe(413);
    expect(err.name).toBe("RequestBodyLimitError");
  });

  it("has correct code and statusCode for REQUEST_BODY_TIMEOUT", () => {
    const err = new RequestBodyLimitError({ code: "REQUEST_BODY_TIMEOUT" });
    expect(err.code).toBe("REQUEST_BODY_TIMEOUT");
    expect(err.statusCode).toBe(408);
  });
});

describe("isRequestBodyLimitError", () => {
  it("returns true for RequestBodyLimitError", () => {
    const err = new RequestBodyLimitError({ code: "PAYLOAD_TOO_LARGE" });
    expect(isRequestBodyLimitError(err)).toBe(true);
  });

  it("returns true with matching code", () => {
    const err = new RequestBodyLimitError({ code: "PAYLOAD_TOO_LARGE" });
    expect(isRequestBodyLimitError(err, "PAYLOAD_TOO_LARGE")).toBe(true);
  });

  it("returns false with non-matching code", () => {
    const err = new RequestBodyLimitError({ code: "PAYLOAD_TOO_LARGE" });
    expect(isRequestBodyLimitError(err, "REQUEST_BODY_TIMEOUT")).toBe(false);
  });

  it("returns false for plain Error", () => {
    expect(isRequestBodyLimitError(new Error("nope"))).toBe(false);
  });
});

describe("requestBodyErrorToText", () => {
  it("returns human-readable text", () => {
    expect(requestBodyErrorToText("PAYLOAD_TOO_LARGE")).toBe("Payload too large");
    expect(requestBodyErrorToText("REQUEST_BODY_TIMEOUT")).toBe("Request body timeout");
    expect(requestBodyErrorToText("CONNECTION_CLOSED")).toBe("Connection closed");
  });
});
