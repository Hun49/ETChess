# ET Chess

A modern, full-featured chess platform across Web, Mobile (iOS/Android), and Admin surfaces.

## Surfaces
- **Web App** (`apps/web`): React + TanStack Router + Tailwind CSS + `react-chessboard`
- **Admin Dashboard** (`apps/admin`): React + Cloudflare Pages + TanStack Router + Tailwind CSS
- **Mobile App** (`apps/mobile`): React Native + Expo + NativeWind + `@shopify/react-native-skia`
- **Backend API** (`services/api`): Hono on Cloudflare Workers + Durable Objects + D1 SQLite + Drizzle ORM

## Shared Packages
- `packages/chess-core`: Rules engine & pure clock logic wrapping `chess.js`
- `packages/rating`: Pure Glicko-2 engine
- `packages/bot-engine`: Stockfish wrapper (web WASM worker & mobile native)
- `packages/realtime-protocol`: Shared Zod schemas for WebSockets
- `packages/types`: Shared TypeScript types & game constants
- `packages/assets`: Canonical piece SVGs and sprite generation scripts
- `packages/config`: Shared Biome, TypeScript, and styling configs

## Documentation
See the full specification in [docs/SRS.md](docs/SRS.md).
