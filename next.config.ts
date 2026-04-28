import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Force Turbopack to treat this worktree as the project root.
  // Otherwise it walks upward and finds ~/package-lock.json, which causes
  // native-addon resolution (e.g. lightningcss) to fail because it looks in
  // the wrong node_modules tree.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
