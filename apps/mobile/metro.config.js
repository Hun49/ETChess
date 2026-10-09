const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch all files within the monorepo for workspace packages
config.watchFolders = [monorepoRoot];

// Let Metro know where to resolve packages in pnpm monorepo
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

const existingBlockList = config.resolver.blockList || [];
config.resolver.blockList = [
  ...(Array.isArray(existingBlockList) ? existingBlockList : [existingBlockList]),
  /.*\/node_modules\/@types\/.*/,
];

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  react: path.resolve(projectRoot, "node_modules/react"),
  "react-native": path.resolve(projectRoot, "node_modules/react-native"),
};

module.exports = config;
