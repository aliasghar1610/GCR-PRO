// Copies pdf-parse's browser worker into public/ so the client-side parser can
// load it from our own origin.
//
// Served from public/ rather than imported, deliberately: bundling pdfjs's
// worker is what produced "Setting up fake worker failed" before (see the
// serverExternalPackages note in next.config.ts). A plain static file at a
// known URL sidesteps bundler resolution entirely, and same-origin keeps it
// inside the CSP's script-src 'self'.
import { copyFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules/pdf-parse/dist/pdf-parse/web/pdf.worker.mjs");
const dest = join(root, "public/pdf.worker.mjs");

if (!existsSync(src)) {
  console.error(`[copy-pdf-worker] missing ${src} — is pdf-parse installed?`);
  process.exit(1);
}

mkdirSync(dirname(dest), { recursive: true });
copyFileSync(src, dest);
console.log(`[copy-pdf-worker] ${(statSync(dest).size / 1024).toFixed(0)}KB -> public/pdf.worker.mjs`);
