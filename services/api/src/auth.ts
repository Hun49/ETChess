import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { emailOTP } from "better-auth/plugins";
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
    trustedOrigins: [
      "http://localhost:3000",
      "http://localhost:8787",
      ...(env.BETTER_AUTH_URL ? [env.BETTER_AUTH_URL] : []),
    ],
    emailAndPassword: {
      enabled: true,
    },
    // Google Social OAuth (automatic email verification upon sign-in/sign-up)
    socialProviders: {
      ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
            },
          }
        : {}),
    },
    // Progressive Email OTP Verification (Option A: Resend API with local dev fallback)
    plugins: [
      emailOTP({
        async sendVerificationOTP({ email, otp, type }) {
          if (env.RESEND_API_KEY) {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${env.RESEND_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: "ET Chess <auth@etchess.io>",
                to: [email],
                subject: "Your ET Chess Verification Code",
                html: `
                  <div style="background-color:#081214;color:#ffffff;padding:32px;border-radius:16px;font-family:sans-serif;max-width:480px;margin:0 auto;border:1px solid #14282c;">
                    <h2 style="color:#00e699;margin-bottom:8px;font-size:24px;">ET Chess Verification</h2>
                    <p style="color:#8ba3a8;font-size:14px;line-height:1.5;">Enter the following 6-digit code in ET Chess to verify your account and claim your Verified Player badge:</p>
                    <div style="background-color:#0e1e22;border:1px solid #162e33;border-radius:12px;padding:20px;text-align:center;margin:24px 0;">
                      <span style="font-family:monospace;font-size:36px;font-weight:900;letter-spacing:8px;color:#00e699;">${otp}</span>
                    </div>
                    <p style="color:#587277;font-size:12px;margin:0;">This verification code will expire in 5 minutes. If you did not request this, you can safely ignore this email.</p>
                  </div>
                `,
              }),
            });
          } else {
            console.log(`[ETChess Dev Auth] Verification OTP for ${email}: ${otp} (Type: ${type})`);
          }
        },
      }),
    ],
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
