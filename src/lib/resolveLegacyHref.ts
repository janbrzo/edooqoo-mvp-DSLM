// v6.9.21 — Legacy .html href resolver.
// - Mapped → returns target URL, clickable
// - Unmapped + .html → returns "comingSoon" so callers can render a disabled tile
// - Anything else → passes through unchanged
import { LEGACY_LINK_MAP } from "@/data/legacyLinkMap";

export type ResolvedHref = { url: string; comingSoon: boolean };

export function resolveLegacyHref(href: string): ResolvedHref {
  if (href in LEGACY_LINK_MAP) return { url: LEGACY_LINK_MAP[href], comingSoon: false };
  if (href.endsWith(".html")) return { url: href, comingSoon: true };
  return { url: href, comingSoon: false };
}
