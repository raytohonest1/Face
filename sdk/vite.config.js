import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/index.js",
      name: "FaceLiveness",
      fileName: (format) => `face-liveness.${format}.js`,
      formats: ["es", "umd"],
    },
    rollupOptions: {
      external: [],
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
  },
});
