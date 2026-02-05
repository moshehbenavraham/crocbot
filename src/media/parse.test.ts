import { describe, expect, it } from "vitest";

import { sanitizeMediaPath, splitMediaFromOutput } from "./parse.js";

describe("sanitizeMediaPath", () => {
  it("strips trailing crocodile emoji from path", () => {
    expect(sanitizeMediaPath("/tmp/photo.png🐊")).toBe("/tmp/photo.png");
  });

  it("strips trailing camera emoji from path", () => {
    expect(sanitizeMediaPath("/tmp/photo.png📸")).toBe("/tmp/photo.png");
  });

  it("strips multiple trailing emojis", () => {
    expect(sanitizeMediaPath("/tmp/photo.png🐊✨🎉")).toBe("/tmp/photo.png");
  });

  it("strips trailing emoji with space before it", () => {
    expect(sanitizeMediaPath("/tmp/photo.png 🐊")).toBe("/tmp/photo.png");
  });

  it("strips trailing whitespace", () => {
    expect(sanitizeMediaPath("/tmp/photo.png  \t")).toBe("/tmp/photo.png");
  });

  it("strips leading whitespace", () => {
    expect(sanitizeMediaPath("  /tmp/photo.png")).toBe("/tmp/photo.png");
  });

  it("preserves valid paths unchanged", () => {
    expect(sanitizeMediaPath("/tmp/photo.png")).toBe("/tmp/photo.png");
  });

  it("preserves URLs unchanged", () => {
    expect(sanitizeMediaPath("https://example.com/img.jpg")).toBe("https://example.com/img.jpg");
  });

  it("strips emoji from URL end", () => {
    expect(sanitizeMediaPath("https://example.com/img.jpg🐊")).toBe("https://example.com/img.jpg");
  });

  it("strips skin-tone modified emojis", () => {
    expect(sanitizeMediaPath("/tmp/photo.png👍🏽")).toBe("/tmp/photo.png");
  });

  it("handles empty string", () => {
    expect(sanitizeMediaPath("")).toBe("");
  });

  it("handles tilde paths with trailing emoji", () => {
    expect(sanitizeMediaPath("~/photos/pic.jpg🐊")).toBe("~/photos/pic.jpg");
  });
});

describe("splitMediaFromOutput", () => {
  it("detects audio_as_voice tag and strips it", () => {
    const result = splitMediaFromOutput("Hello [[audio_as_voice]] world");
    expect(result.audioAsVoice).toBe(true);
    expect(result.text).toBe("Hello world");
  });

  it("captures media paths with spaces", () => {
    const result = splitMediaFromOutput("MEDIA:/Users/pete/My File.png");
    expect(result.mediaUrls).toEqual(["/Users/pete/My File.png"]);
    expect(result.text).toBe("");
  });

  it("captures quoted media paths with spaces", () => {
    const result = splitMediaFromOutput('MEDIA:"/Users/pete/My File.png"');
    expect(result.mediaUrls).toEqual(["/Users/pete/My File.png"]);
    expect(result.text).toBe("");
  });

  it("captures tilde media paths with spaces", () => {
    const result = splitMediaFromOutput("MEDIA:~/Pictures/My File.png");
    expect(result.mediaUrls).toEqual(["~/Pictures/My File.png"]);
    expect(result.text).toBe("");
  });

  it("keeps audio_as_voice detection stable across calls", () => {
    const input = "Hello [[audio_as_voice]]";
    const first = splitMediaFromOutput(input);
    const second = splitMediaFromOutput(input);
    expect(first.audioAsVoice).toBe(true);
    expect(second.audioAsVoice).toBe(true);
  });

  it("keeps MEDIA mentions in prose", () => {
    const input = "The MEDIA: tag fails to deliver";
    const result = splitMediaFromOutput(input);
    expect(result.mediaUrls).toBeUndefined();
    expect(result.text).toBe(input);
  });

  it("parses MEDIA tags with leading whitespace", () => {
    const result = splitMediaFromOutput("  MEDIA:/tmp/screenshot.png");
    expect(result.mediaUrls).toEqual(["/tmp/screenshot.png"]);
    expect(result.text).toBe("");
  });

  it("strips trailing emoji from MEDIA path", () => {
    const result = splitMediaFromOutput("MEDIA:/tmp/photo.png🐊");
    expect(result.mediaUrls).toEqual(["/tmp/photo.png"]);
    expect(result.text).toBe("");
  });

  it("strips trailing emoji from MEDIA URL", () => {
    const result = splitMediaFromOutput("MEDIA:https://example.com/photo.jpg🐊");
    expect(result.mediaUrls).toEqual(["https://example.com/photo.jpg"]);
    expect(result.text).toBe("");
  });

  it("strips trailing emoji with space from MEDIA path", () => {
    const result = splitMediaFromOutput("MEDIA:/tmp/photo.png 🐊");
    expect(result.mediaUrls).toEqual(["/tmp/photo.png"]);
    expect(result.text).toBe("");
  });

  it("strips multiple trailing emojis from MEDIA path", () => {
    const result = splitMediaFromOutput("MEDIA:/tmp/photo.png✨🎉");
    expect(result.mediaUrls).toEqual(["/tmp/photo.png"]);
    expect(result.text).toBe("");
  });
});
