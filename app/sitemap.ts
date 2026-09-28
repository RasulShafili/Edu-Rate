import type { MetadataRoute } from "next";

const publicRoutes = ["", "/events", "/community", "/teachers", "/mentors", "/support", "/feed", "/clubs", "/privacy", "/terms", "/cookies", "/community-guidelines"];

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://edu-rate-nu.vercel.app").replace(/\/$/, "");
  return publicRoutes.map((route, index) => ({
    url: `${origin}${route || "/"}`,
    lastModified: new Date("2026-09-28T00:00:00+04:00"),
    changeFrequency: index === 0 ? "daily" : "weekly",
    priority: index === 0 ? 1 : 0.7,
  }));
}
