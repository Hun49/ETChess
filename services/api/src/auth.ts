import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./db/schema";
import { getAllowedOrigins } from "./lib/cors";
import { getAuthSecret } from "./lib/secrets";
import type { Env } from "./types";

export function createAuth(env: Env) {
  const db = drizzle(env.DB, { schema });
  const secret = getAuthSecret(env);
  const trustedOrigins = getAllowedOrigins(env);

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema,
    }),
    secret,
    baseURL: env.BETTER_AUTH_URL || "http://localhost:3000",
    trustedOrigins,
    onAPIError: {
      throw: false,
    },
    advanced: {
      useSecureCookies: env.ENVIRONMENT === "production",
    },
    rateLimit: {
      window: 60,
      max: 30,
    },
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ["google", "github"],
      },
      skipStateCookieCheck: true,
    },
    // Social OAuth (automatic verified accounts upon sign-in)
    socialProviders: {
      ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
            },
          }
        : {}),
      ...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
        ? {
            github: {
              clientId: env.GITHUB_CLIENT_ID,
              clientSecret: env.GITHUB_CLIENT_SECRET,
            },
          }
        : {}),
    },
    plugins: [],
    user: {
      additionalFields: {
        role: {
          type: "string",
          defaultValue: "user",
          input: false,
        },
        isBanned: {
          type: "boolean",
          defaultValue: false,
          input: false,
        },
        banExpiresAt: {
          type: "date",
          required: false,
          input: false,
        },
        experienceLevel: {
          type: "string",
          required: false,
          input: false,
        },
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            // Defense-in-depth: enforce server-only fields unconditionally on registration
            return {
              data: {
                ...user,
                role: "user",
                isBanned: false,
                banExpiresAt: null,
                experienceLevel: null, // User selects skill level during first onboarding
              },
            };
          },
          after: async (createdUser) => {
            // Initialize rating record with baseline 1000 (updated upon skill onboarding)
            await db
              .insert(schema.ratings)
              .values({
                userId: createdUser.id,
                bulletRating: 1000,
                bulletRd: 350,
                bulletVol: 0.06,
                blitzRating: 1000,
                blitzRd: 350,
                blitzVol: 0.06,
                rapidRating: 1000,
                rapidRd: 350,
                rapidVol: 0.06,
                classicalRating: 1000,
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
