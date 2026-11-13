/**
 * Environment-driven presentation flags.
 *
 * `IS_DEV_PREVIEW` controls development-only notices (missing business info,
 * unverified claims, mock data banners). It is `true` during `next dev` and
 * `false` in production builds unless `NEXT_PUBLIC_SHOW_DEV_NOTICES=true` is
 * set (e.g. on a Vercel preview deployment for client review).
 */
export const IS_DEV_PREVIEW =
  process.env.NODE_ENV !== "production" ||
  process.env.NEXT_PUBLIC_SHOW_DEV_NOTICES === "true";

/** Canonical site origin used for metadata, sitemap, and robots. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");
