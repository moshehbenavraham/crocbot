import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { listChannelPluginCatalogEntries } from "./catalog.js";

describe("channel plugin catalog", () => {
  it("includes external catalog entries", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "crocbot-catalog-"));
    const catalogPath = path.join(dir, "catalog.json");
    fs.writeFileSync(
      catalogPath,
      JSON.stringify({
        entries: [
          {
            name: "@crocbot/demo-channel",
            crocbot: {
              channel: {
                id: "demo-channel",
                label: "Demo Channel",
                selectionLabel: "Demo Channel",
                docsPath: "/channels/demo-channel",
                blurb: "Demo entry",
                order: 999,
              },
              install: {
                npmSpec: "@crocbot/demo-channel",
              },
            },
          },
        ],
      }),
    );

    const ids = listChannelPluginCatalogEntries({ catalogPaths: [catalogPath] }).map(
      (entry) => entry.id,
    );
    expect(ids).toContain("demo-channel");
  });
});
