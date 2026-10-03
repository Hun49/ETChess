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
    databaseHooks: {
      user: {
        create: {
          after: async (createdUser) => {
            await db
              .insert(schema.ratings)
              .values({
                userId: createdUser.id,
                bulletRating: 1500,
                bulletRd: 350,
                bulletVol: 0.06,
                blitzRating: 1500,
                blitzRd: 350,
                blitzVol: 0.06,
                rapidRating: 1500,
                rapidRd: 350,
                rapidVol: 0.06,
                classicalRating: 1500,
                classicalRd: 350,
                classicalVol: 0.06,
                updatedAt: new Date(),
              })
              .onConflictDoNothing();
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
