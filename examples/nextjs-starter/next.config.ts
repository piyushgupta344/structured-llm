import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // structured-llm uses ESM — this ensures Next.js transpiles it correctly
  transpilePackages: ["structured-llm"],
};

export default nextConfig;
