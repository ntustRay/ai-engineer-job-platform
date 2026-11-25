import type { NextConfig } from "next";
const config: NextConfig = {
  transpilePackages: ["@job/domain"],
  poweredByHeader: false,
  serverExternalPackages: ["pg"],
};
export default config;
