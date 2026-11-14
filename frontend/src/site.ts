import { useEffect, useState } from "react";
import { api } from "./api";
import type { Review } from "./types";

export interface SiteInfo {
  images: Record<string, string>;
  stats: { creators: number; cities: number; completed: number; rating: number; reviews: number };
  showcase: { id: number; image_url: string; title: string; creator_id: number; creator_name: string }[];
  testimonials: Review[];
}

let cache: SiteInfo | null = null;
let pending: Promise<SiteInfo> | null = null;

export function loadSite(): Promise<SiteInfo> {
  if (cache) return Promise.resolve(cache);
  pending ??= api.get<SiteInfo>("/site").then((d) => (cache = d)).finally(() => { pending = null; });
  return pending;
}

export function useSite() {
  const [site, setSite] = useState<SiteInfo | null>(cache);
  useEffect(() => { if (!cache) loadSite().then(setSite).catch(() => {}); }, []);
  return site;
}
