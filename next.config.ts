import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse (via pdfjs-dist) tries to load a worker script at a path that
  // only resolves under Node's own module resolution — bundling it through
  // Turbopack/webpack breaks that path and pdfjs throws "Setting up fake
  // worker failed". Leaving it external avoids the bundler touching it.
  serverExternalPackages: ["pdf-parse"],
  images: {
    remotePatterns: [
      // Google account avatars and Classroom teacher profile photos.
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
