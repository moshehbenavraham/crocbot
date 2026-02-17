export type ExtractMode = "markdown" | "text";

function decodeEntities(value: string): string {
  // Decode &lt;/&gt;/&amp;/&quot;/&#39; and numeric entities in a single pass
  // to avoid double-decoding (e.g. &amp;lt; → & + lt; vs. &amp;lt; → &lt; → <).
  return value.replace(
    /&(?:nbsp|amp|quot|lt|gt|#39|#x([0-9a-f]+)|#(\d+));/gi,
    (match, hex, dec) => {
      const lower = match.toLowerCase();
      if (lower === "&nbsp;") {
        return " ";
      }
      if (lower === "&amp;") {
        return "&";
      }
      if (lower === "&quot;") {
        return '"';
      }
      if (lower === "&#39;") {
        return "'";
      }
      if (lower === "&lt;") {
        return "<";
      }
      if (lower === "&gt;") {
        return ">";
      }
      if (hex !== undefined) {
        return String.fromCharCode(Number.parseInt(hex, 16));
      }
      if (dec !== undefined) {
        return String.fromCharCode(Number.parseInt(dec, 10));
      }
      return match;
    },
  );
}

function stripTags(value: string): string {
  // Loop until no more tags remain — a single pass of /<[^>]+>/g can leave
  // residual tags when nested or intentionally crafted (e.g. "<<b>b>").
  let result = value;
  let prev: string;
  do {
    prev = result;
    result = result.replace(/<[^>]+>/g, "");
  } while (result !== prev);
  return decodeEntities(result);
}

function normalizeWhitespace(value: string): string {
  return value
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function htmlToMarkdown(html: string): { text: string; title?: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? normalizeWhitespace(stripTags(titleMatch[1])) : undefined;
  // Strip script/style/noscript blocks — loop until stable to handle
  // nested or intentionally crafted bypass patterns like <<script>script>.
  let text = html;
  let prevText: string;
  do {
    prevText = text;
    text = text
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, "");
  } while (text !== prevText);
  text = text.replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, body) => {
    const label = normalizeWhitespace(stripTags(body));
    if (!label) {
      return href;
    }
    return `[${label}](${href})`;
  });
  text = text.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level, body) => {
    const prefix = "#".repeat(Math.max(1, Math.min(6, Number.parseInt(level, 10))));
    const label = normalizeWhitespace(stripTags(body));
    return `\n${prefix} ${label}\n`;
  });
  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, body) => {
    const label = normalizeWhitespace(stripTags(body));
    return label ? `\n- ${label}` : "";
  });
  text = text
    .replace(/<(br|hr)\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|header|footer|table|tr|ul|ol)>/gi, "\n");
  text = stripTags(text);
  text = normalizeWhitespace(text);
  return { text, title };
}

export function markdownToText(markdown: string): string {
  let text = markdown;
  text = text.replace(/!\[[^\]]*]\([^)]+\)/g, "");
  text = text.replace(/\[([^\]]+)]\([^)]+\)/g, "$1");
  text = text.replace(/```[\s\S]*?```/g, (block) =>
    block.replace(/```[^\n]*\n?/g, "").replace(/```/g, ""),
  );
  text = text.replace(/`([^`]+)`/g, "$1");
  text = text.replace(/^#{1,6}\s+/gm, "");
  text = text.replace(/^\s*[-*+]\s+/gm, "");
  text = text.replace(/^\s*\d+\.\s+/gm, "");
  return normalizeWhitespace(text);
}

export function truncateText(
  value: string,
  maxChars: number,
): { text: string; truncated: boolean } {
  if (value.length <= maxChars) {
    return { text: value, truncated: false };
  }
  return { text: value.slice(0, maxChars), truncated: true };
}

export async function extractReadableContent(params: {
  html: string;
  url: string;
  extractMode: ExtractMode;
}): Promise<{ text: string; title?: string } | null> {
  const fallback = (): { text: string; title?: string } => {
    const rendered = htmlToMarkdown(params.html);
    if (params.extractMode === "text") {
      const text = markdownToText(rendered.text) || normalizeWhitespace(stripTags(params.html));
      return { text, title: rendered.title };
    }
    return rendered;
  };
  try {
    const [{ Readability }, { parseHTML }] = await Promise.all([
      import("@mozilla/readability"),
      import("linkedom"),
    ]);
    const { document } = parseHTML(params.html);
    try {
      (document as { baseURI?: string }).baseURI = params.url;
    } catch {
      // Best-effort base URI for relative links.
    }
    const reader = new Readability(document, { charThreshold: 0 });
    const parsed = reader.parse();
    if (!parsed?.content) {
      return fallback();
    }
    const title = parsed.title || undefined;
    if (params.extractMode === "text") {
      const text = normalizeWhitespace(parsed.textContent ?? "");
      return text ? { text, title } : fallback();
    }
    const rendered = htmlToMarkdown(parsed.content);
    return { text: rendered.text, title: title ?? rendered.title };
  } catch {
    return fallback();
  }
}
