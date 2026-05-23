import { defineConfig } from "vite";
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      "@frontend": path.resolve(__dirname, "../frontend"),
      "lucide-react": path.resolve(
        __dirname,
        "../frontend/components/icon-bank/AnimatedIcons.tsx",
      ),
    },
  },
  plugins: [tailwindcss(), react()],
  build: {
    minify: process.env.NODE_ENV === "production",
    sourcemap: true,
    outDir: "dist",
    rollupOptions: {
      output: {
        manualChunks: {
          vendor_react: ["react", "react-dom"],
          vendor_motion: ["framer-motion"],
          vendor_markdown: ["react-markdown"],
        },
      },
    },
  },
  base: "/",
  server: {
    cors: true,
    port: 7778,
  },
  define: {
    "import.meta.env.BUILD_TIME": JSON.stringify(new Date().toISOString()),
  },
});
