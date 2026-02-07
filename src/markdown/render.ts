import type { MarkdownIR, MarkdownLinkSpan, MarkdownStyle, MarkdownStyleSpan } from "./ir.js";

export type RenderStyleMarker = {
  open: string;
  close: string;
};

export type RenderStyleMap = Partial<Record<MarkdownStyle, RenderStyleMarker>>;

export type RenderLink = {
  start: number;
  end: number;
  open: string;
  close: string;
};

export type RenderOptions = {
  styleMarkers: RenderStyleMap;
  escapeText: (text: string) => string;
  buildLink?: (link: MarkdownLinkSpan, text: string) => RenderLink | null;
};

const STYLE_ORDER: MarkdownStyle[] = [
  "blockquote",
  "code_block",
  "code",
  "bold",
  "italic",
  "strikethrough",
  "spoiler",
];

const STYLE_RANK = new Map<MarkdownStyle, number>(
  STYLE_ORDER.map((style, index) => [style, index]),
);

function sortStyleSpans(spans: MarkdownStyleSpan[]): MarkdownStyleSpan[] {
  return [...spans].toSorted((a, b) => {
    if (a.start !== b.start) {
      return a.start - b.start;
    }
    if (a.end !== b.end) {
      return b.end - a.end;
    }
    return (STYLE_RANK.get(a.style) ?? 0) - (STYLE_RANK.get(b.style) ?? 0);
  });
}

/**
 * Split style spans and link spans at each other's boundaries so they nest
 * cleanly.  Without this, a bold [5,20) overlapping a link [10,30) would
 * produce `<b>...<a>...</b>...</a>` — invalid HTML.  After normalisation
 * the bold becomes [5,10)+[10,20) and the link becomes [10,20)+[20,30),
 * giving `<b>...</b><a><b>...</b>...</a>`.
 */
function normalizeSpans(ir: MarkdownIR, options: RenderOptions): MarkdownIR {
  const linkSpans: MarkdownLinkSpan[] = [];
  if (options.buildLink) {
    for (const link of ir.links) {
      const rendered = options.buildLink(link, ir.text);
      if (rendered) {
        linkSpans.push(link);
      }
    }
  }

  if (linkSpans.length === 0) {
    return ir;
  }

  // Collect all boundary points from links
  const linkBoundaries = new Set<number>();
  for (const link of linkSpans) {
    linkBoundaries.add(link.start);
    linkBoundaries.add(link.end);
  }

  // Collect all boundary points from styles
  const styleBoundaries = new Set<number>();
  for (const style of ir.styles) {
    styleBoundaries.add(style.start);
    styleBoundaries.add(style.end);
  }

  // Split style spans at link boundaries
  const newStyles: MarkdownStyleSpan[] = [];
  for (const span of ir.styles) {
    const cuts = [span.start, span.end];
    for (const b of linkBoundaries) {
      if (b > span.start && b < span.end) {
        cuts.push(b);
      }
    }
    cuts.sort((a, b) => a - b);
    for (let i = 0; i < cuts.length - 1; i++) {
      const s = cuts[i];
      const e = cuts[i + 1];
      if (e > s) {
        newStyles.push({ start: s, end: e, style: span.style });
      }
    }
  }

  // Split link spans at style boundaries
  const newLinks: MarkdownLinkSpan[] = [];
  for (const link of ir.links) {
    const cuts = [link.start, link.end];
    for (const b of styleBoundaries) {
      if (b > link.start && b < link.end) {
        cuts.push(b);
      }
    }
    cuts.sort((a, b) => a - b);
    for (let i = 0; i < cuts.length - 1; i++) {
      const s = cuts[i];
      const e = cuts[i + 1];
      if (e > s) {
        newLinks.push({ start: s, end: e, href: link.href });
      }
    }
  }

  return { text: ir.text, styles: newStyles, links: newLinks };
}

export function renderMarkdownWithMarkers(ir: MarkdownIR, options: RenderOptions): string {
  const text = ir.text ?? "";
  if (!text) {
    return "";
  }

  const normalized = normalizeSpans(ir, options);

  const styleMarkers = options.styleMarkers;
  const styled = sortStyleSpans(
    normalized.styles.filter((span) => Boolean(styleMarkers[span.style])),
  );

  const boundaries = new Set<number>();
  boundaries.add(0);
  boundaries.add(text.length);

  const startsAt = new Map<number, MarkdownStyleSpan[]>();
  for (const span of styled) {
    if (span.start === span.end) {
      continue;
    }
    boundaries.add(span.start);
    boundaries.add(span.end);
    const bucket = startsAt.get(span.start);
    if (bucket) {
      bucket.push(span);
    } else {
      startsAt.set(span.start, [span]);
    }
  }
  for (const spans of startsAt.values()) {
    spans.sort((a, b) => {
      if (a.end !== b.end) {
        return b.end - a.end;
      }
      return (STYLE_RANK.get(a.style) ?? 0) - (STYLE_RANK.get(b.style) ?? 0);
    });
  }

  const linkStarts = new Map<number, RenderLink[]>();
  const linkEnds = new Map<number, RenderLink[]>();
  if (options.buildLink) {
    for (const link of normalized.links) {
      if (link.start === link.end) {
        continue;
      }
      const rendered = options.buildLink(link, text);
      if (!rendered) {
        continue;
      }
      boundaries.add(rendered.start);
      boundaries.add(rendered.end);
      const openBucket = linkStarts.get(rendered.start);
      if (openBucket) {
        openBucket.push(rendered);
      } else {
        linkStarts.set(rendered.start, [rendered]);
      }
      const closeBucket = linkEnds.get(rendered.end);
      if (closeBucket) {
        closeBucket.push(rendered);
      } else {
        linkEnds.set(rendered.end, [rendered]);
      }
    }
  }

  const points = [...boundaries].toSorted((a, b) => a - b);
  const stack: MarkdownStyleSpan[] = [];
  let out = "";

  for (let i = 0; i < points.length; i += 1) {
    const pos = points[i];

    while (stack.length && stack[stack.length - 1]?.end === pos) {
      const span = stack.pop();
      if (!span) {
        break;
      }
      const marker = styleMarkers[span.style];
      if (marker) {
        out += marker.close;
      }
    }

    const closingLinks = linkEnds.get(pos);
    if (closingLinks && closingLinks.length > 0) {
      for (const link of closingLinks) {
        out += link.close;
      }
    }

    const openingLinks = linkStarts.get(pos);
    if (openingLinks && openingLinks.length > 0) {
      for (const link of openingLinks) {
        out += link.open;
      }
    }

    const openingStyles = startsAt.get(pos);
    if (openingStyles) {
      for (const span of openingStyles) {
        const marker = styleMarkers[span.style];
        if (!marker) {
          continue;
        }
        stack.push(span);
        out += marker.open;
      }
    }

    const next = points[i + 1];
    if (next === undefined) {
      break;
    }
    if (next > pos) {
      out += options.escapeText(text.slice(pos, next));
    }
  }

  return out;
}
