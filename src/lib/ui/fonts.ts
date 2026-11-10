import { Geist, Plus_Jakarta_Sans } from "next/font/google";

/**
 * The front-end kit's two faces (JetlineConsol design-spec-v1 §1.1 and the
 * 2026-08-27 grid amendment): Plus Jakarta Sans 400-800 for chrome, headings,
 * forms and navigation; Geist for data grids. Imported only by FrontScope, so
 * the files download only on routes that render a front-end surface.
 */
export const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

export const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
