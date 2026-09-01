import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    // PostgreSQL integration suites intentionally exercise SERIALIZABLE/GiST
    // concurrency internally; running separate fixture files in parallel adds
    // unrelated index-page deadlocks and makes the suite nondeterministic.
    fileParallelism: false,
    coverage: { reporter: ["text", "json", "html"] },
  },
});
