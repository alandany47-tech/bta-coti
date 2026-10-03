import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      "server-only": fileURLToPath(new URL("./lib/test/server-only-stub.ts", import.meta.url)),
    },
  },
  // tsconfig usa jsx "preserve" (Next); las plantillas de correo se renderizan en las pruebas, así que esbuild transforma JSX aquí.
  esbuild: { jsx: "automatic" },
  test: { environment: "node", include: ["lib/**/*.test.ts", "emails/**/*.test.tsx"] },
});
