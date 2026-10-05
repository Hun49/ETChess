import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
  },
  resolve: {
    alias: {
      "react-native": path.resolve(__dirname, "./test/mocks/react-native.ts"),
      "expo-secure-store": path.resolve(__dirname, "./test/mocks/expo-secure-store.ts"),
    },
  },
});
