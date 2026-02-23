import { describe, expect, it } from "vitest";

import { extractLinksFromMessage } from "./detect.js";

describe("extractLinksFromMessage", () => {
  it("extracts bare http/https URLs in order", () => {
    const links = extractLinksFromMessage("see https://a.example and http://b.test");
    expect(links).toEqual(["https://a.example", "http://b.test"]);
  });

  it("dedupes links and enforces maxLinks", () => {
    const links = extractLinksFromMessage("https://a.example https://a.example https://b.test", {
      maxLinks: 1,
    });
    expect(links).toEqual(["https://a.example"]);
  });

  it("ignores markdown links", () => {
    const links = extractLinksFromMessage("[doc](https://docs.example) https://bare.example");
    expect(links).toEqual(["https://bare.example"]);
  });

  it("blocks 127.0.0.1", () => {
    const links = extractLinksFromMessage("http://127.0.0.1/test https://ok.test");
    expect(links).toEqual(["https://ok.test"]);
  });

  it("blocks private IP 10.x.x.x", () => {
    const links = extractLinksFromMessage("http://10.0.0.1/api https://ok.test");
    expect(links).toEqual(["https://ok.test"]);
  });

  it("blocks private IP 192.168.x.x", () => {
    const links = extractLinksFromMessage("http://192.168.1.1/admin https://ok.test");
    expect(links).toEqual(["https://ok.test"]);
  });

  it("blocks private IP 172.16.x.x", () => {
    const links = extractLinksFromMessage("http://172.16.0.1/ https://ok.test");
    expect(links).toEqual(["https://ok.test"]);
  });

  it("blocks loopback ::1", () => {
    const links = extractLinksFromMessage("http://[::1]/test https://ok.test");
    expect(links).toEqual(["https://ok.test"]);
  });

  it("blocks cloud metadata IP 169.254.169.254", () => {
    const links = extractLinksFromMessage(
      "http://169.254.169.254/latest/meta-data https://ok.test",
    );
    expect(links).toEqual(["https://ok.test"]);
  });

  it("blocks localhost hostname", () => {
    const links = extractLinksFromMessage("http://localhost:8080/api https://ok.test");
    expect(links).toEqual(["https://ok.test"]);
  });

  it("blocks .internal hostname", () => {
    const links = extractLinksFromMessage("http://api.internal/secret https://ok.test");
    expect(links).toEqual(["https://ok.test"]);
  });

  it("blocks metadata.google.internal", () => {
    const links = extractLinksFromMessage(
      "http://metadata.google.internal/computeMetadata https://ok.test",
    );
    expect(links).toEqual(["https://ok.test"]);
  });

  it("allows public URLs", () => {
    const links = extractLinksFromMessage("https://example.com/page");
    expect(links).toEqual(["https://example.com/page"]);
  });
});
