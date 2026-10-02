import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./db/schema";
import type { Env } from "./types";

export function createAuth(env: Env) {
  const db = drizzle(env.DB, { schema });
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema,
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL || "http://localhost:8787",
    emailAndPassword: {
      enabled: true,
    },
    user: {
      additionalFields: {
        role: {
          type: "string",
          defaultValue: "user",
        },
        isBanned: {
          type: "boolean",
          defaultValue: false,
        },
        banExpiresAt: {
          type: "date",
          required: false,
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
