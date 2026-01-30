---
name: boot-md
description: "Run BOOT.md on gateway startup"
homepage: https://docs.github.com/moshehbenavraham/crocbot/hooks#boot-md
metadata:
  {
    "crocbot":
      {
        "emoji": "🚀",
        "events": ["gateway:startup"],
        "requires": { "config": ["workspace.dir"] },
        "install": [{ "id": "bundled", "kind": "bundled", "label": "Bundled with crocbot" }],
      },
  }
---

# Boot Checklist Hook

Runs `BOOT.md` every time the gateway starts, if the file exists in the workspace.
