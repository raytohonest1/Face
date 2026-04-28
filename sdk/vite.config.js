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
      external: ["@mediapipe/tasks-vision"],
      output: {
        globals: {
          "@mediapipe/tasks-vision": "TasksVision",
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
  },
});
