import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../../");

function getSourceFiles(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === "node_modules" || file === ".turbo" || file === "dist" || file === ".wrangler") {
      continue;
    }
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      getSourceFiles(filePath, fileList);
    } else if (file.endsWith(".ts") || file.endsWith(".tsx")) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

describe("Gate 1: Architecture Invariants & Import Boundaries", () => {
  it("enforces chess.js is only imported inside packages/chess-core", () => {
    const allFiles = [
      ...getSourceFiles(path.join(REPO_ROOT, "services")),
      ...getSourceFiles(path.join(REPO_ROOT, "packages")),
      ...getSourceFiles(path.join(REPO_ROOT, "apps")),
    ];

    const violations: string[] = [];

    for (const file of allFiles) {
      if (file === __filename || file.includes("packages/chess-core/")) {
        continue;
      }
      const content = fs.readFileSync(file, "utf-8");
      if (
        content.includes('from "chess.js"') ||
        content.includes("from 'chess.js'") ||
        content.includes('require("chess.js")') ||
        content.includes("require('chess.js')")
      ) {
        violations.push(path.relative(REPO_ROOT, file));
      }
    }

    expect(
      violations,
      `chess.js was directly imported outside packages/chess-core in: ${violations.join(", ")}`,
    ).toEqual([]);
  });

  it("enforces zero unjustified @ts-ignore across backend source files", () => {
    const backendFiles = [
      ...getSourceFiles(path.join(REPO_ROOT, "services/api/src")),
      ...getSourceFiles(path.join(REPO_ROOT, "packages/chess-core/src")),
      ...getSourceFiles(path.join(REPO_ROOT, "packages/game-core/src")),
      ...getSourceFiles(path.join(REPO_ROOT, "packages/rating/src")),
      ...getSourceFiles(path.join(REPO_ROOT, "packages/realtime-protocol/src")),
      ...getSourceFiles(path.join(REPO_ROOT, "packages/types/src")),
      ...getSourceFiles(path.join(REPO_ROOT, "packages/bot-engine/src")),
    ];

    const violations: string[] = [];

    for (const file of backendFiles) {
      const content = fs.readFileSync(file, "utf-8");
      if (content.includes("@ts-ignore")) {
        violations.push(path.relative(REPO_ROOT, file));
      }
    }

    expect(
      violations,
      `Forbidden @ts-ignore found in backend files: ${violations.join(", ")}`,
    ).toEqual([]);
  });

  it("enforces zero 'any' type escape hatches in backend source files", () => {
    const backendFiles = [
      ...getSourceFiles(path.join(REPO_ROOT, "services/api/src")),
      ...getSourceFiles(path.join(REPO_ROOT, "packages/chess-core/src")),
      ...getSourceFiles(path.join(REPO_ROOT, "packages/game-core/src")),
      ...getSourceFiles(path.join(REPO_ROOT, "packages/rating/src")),
      ...getSourceFiles(path.join(REPO_ROOT, "packages/realtime-protocol/src")),
      ...getSourceFiles(path.join(REPO_ROOT, "packages/types/src")),
      ...getSourceFiles(path.join(REPO_ROOT, "packages/bot-engine/src")),
    ];

    const violations: string[] = [];

    for (const file of backendFiles) {
      const lines = fs.readFileSync(file, "utf-8").split("\n");
      lines.forEach((line, index) => {
        const trimmed = line.trim();
        // Ignore comments
        if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;

        if (/\bas\s+any\b/.test(trimmed) || /:\s*any\b/.test(trimmed) || /<any>/.test(trimmed)) {
          violations.push(`${path.relative(REPO_ROOT, file)}:${index + 1} -> ${trimmed}`);
        }
      });
    }

    expect(violations, `Forbidden 'any' usage detected in: \n${violations.join("\n")}`).toEqual([]);
  });

  it("enforces absence of obsolete GameRoomDO terminology across codebase", () => {
    const sourceFiles = [
      ...getSourceFiles(path.join(REPO_ROOT, "services")),
      ...getSourceFiles(path.join(REPO_ROOT, "packages")),
      ...getSourceFiles(path.join(REPO_ROOT, "apps")),
    ];

    const violations: string[] = [];

    for (const file of sourceFiles) {
      if (file === __filename) {
        continue;
      }
      const content = fs.readFileSync(file, "utf-8");
      if (content.includes("GameRoomDO")) {
        violations.push(path.relative(REPO_ROOT, file));
      }
    }

    expect(
      violations,
      `Obsolete GameRoomDO terminology found in: ${violations.join(", ")}`,
    ).toEqual([]);
  });

  it("enforces pure packages do not import server runtime or web frameworks", () => {
    const pureFiles = [
      ...getSourceFiles(path.join(REPO_ROOT, "packages/chess-core/src")),
      ...getSourceFiles(path.join(REPO_ROOT, "packages/rating/src")),
      ...getSourceFiles(path.join(REPO_ROOT, "packages/types/src")),
    ];

    const forbiddenImports = ["cloudflare:workers", "hono", "drizzle-orm", "react", "react-native"];
    const violations: string[] = [];

    for (const file of pureFiles) {
      const content = fs.readFileSync(file, "utf-8");
      for (const forbidden of forbiddenImports) {
        if (
          content.includes(`from "${forbidden}"`) ||
          content.includes(`from '${forbidden}'`) ||
          content.includes(`require("${forbidden}")`) ||
          content.includes(`require('${forbidden}')`)
        ) {
          violations.push(`${path.relative(REPO_ROOT, file)} imported ${forbidden}`);
        }
      }
    }

    expect(
      violations,
      `Forbidden server/UI imports found in pure packages: ${violations.join(", ")}`,
    ).toEqual([]);
  });
});
