/**
 * Is this the dev copy? Server-side only.
 *
 * True when the deployment says so itself (`JL_ENVIRONMENT=dev`, set on the
 * Vercel project `jetline-machines-dev`), and on anything that is not Vercel's
 * Production environment: a preview, a local run. Production
 * (fleet.jetline.co.za) is the one place it is false.
 *
 * It decides two things: the DEV mark on screen, and whether photos may be
 * added or deleted (docs/DEV-ENVIRONMENT.md).
 */
export function isDevCopy(): boolean {
  return process.env.JL_ENVIRONMENT === "dev" || process.env.VERCEL_ENV !== "production";
}

/** A Vercel deployment that is not production's: the dev copy or a preview. A local run is not one. */
export function isHostedDevCopy(): boolean {
  return !!process.env.VERCEL_ENV && isDevCopy();
}
