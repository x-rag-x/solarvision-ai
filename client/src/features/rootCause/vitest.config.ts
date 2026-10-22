import { defineConfig } from "vitest/config";
import path from "path";

const root = path.resolve(__dirname, "../../../..");

export default defineConfig({
  root,
  resolve: {
    alias: {
      "@": path.resolve(root, "client", "src"),
      "@shared": path.resolve(root, "shared"),
    },
  },
  test: {
    environment: "node",
    include: ["client/src/features/rootCause/**/__tests__/**/*.test.ts"],
  },
});
