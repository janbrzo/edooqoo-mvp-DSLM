import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

const ASSET_TAG_RE = /<(?:script|link)\b[^>]*(?:src|href)="\/assets\/[^"]+"[^>]*>(?:\s*<\/script>)?\s*/gi;

/** Extract the entry asset tags Vite injected into the freshly built index.html. */
export function extractEntryTags(indexHtml: string): string[] {
  const head = indexHtml.split(/<\/head>/i)[0] ?? "";
  return head.match(ASSET_TAG_RE)?.map((t) => t.trim()) ?? [];
}

/** Replace stale /assets/ tags in a prerendered snapshot with the current entry tags. */
export function rewriteSnapshot(html: string, entryTags: string[]): string {
  if (!/\/assets\/index-[^"]+\.(?:js|css)"/.test(html)) return html;
  const stripped = html.replace(ASSET_TAG_RE, "");
  return stripped.replace(/<\/head>/i, `${entryTags.join("\n")}\n</head>`);
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".html")) out.push(full);
  }
  return out;
}

/**
 * Prerendered SPA snapshots in public/ carry hashed asset URLs from the build
 * they were captured in. Vite copies public/ verbatim, so after every rebuild
 * those URLs 404 and the pages render unstyled. Re-point them at this build.
 */
export function syncSnapshotAssets(): Plugin {
  let outDir = "dist";
  return {
    name: "edooqoo-sync-snapshot-assets",
    apply: "build",
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const indexPath = path.join(outDir, "index.html");
      if (!fs.existsSync(indexPath)) return;
      const entryTags = extractEntryTags(fs.readFileSync(indexPath, "utf8"));
      if (!entryTags.length) return;
      for (const file of walk(outDir)) {
        if (file === indexPath) continue;
        const html = fs.readFileSync(file, "utf8");
        const next = rewriteSnapshot(html, entryTags);
        if (next !== html) fs.writeFileSync(file, next);
      }
    },
  };
}
