import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import * as schema from "../db/schema";
import { rateLimit } from "../middleware/rateLimit";
import type { HonoVariables } from "../middleware/session";
import type { Env } from "../types";

export const guestRoute = new Hono<{
  Bindings: Env;
  Variables: HonoVariables;
}>();

// Rate limit guest creation: max 5 accounts per minute per IP (H7)
guestRoute.use(
  "/",
  rateLimit({
    windowSeconds: 60,
    maxRequests: 5,
    keyPrefix: "guest",
    message: "Too many guest accounts created from this IP. Please wait before trying again.",
  }),
);

guestRoute.post("/", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const guestId = crypto.randomUUID();
  const guestNumber = Math.floor(1000 + Math.random() * 9000);
  const guestName = `Guest ${guestNumber}`;
  const guestEmail = `guest_${guestId}@guest.etchess.internal`;
  const token = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000); // 30 days

  // 1. Create guest user
  await db.insert(schema.user).values({
    id: guestId,
    name: guestName,
    email: guestEmail,
    emailVerified: false,
    role: "guest",
    createdAt: now,
    updatedAt: now,
  });

  // 2. Initialize default Glicko-2 ratings
  await db.insert(schema.ratings).values({
    userId: guestId,
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
    updatedAt: now,
  });

  // 3. Create persistent session record compatible with Better Auth
  await db.insert(schema.session).values({
    id: crypto.randomUUID(),
    token,
    userId: guestId,
    expiresAt,
    createdAt: now,
    updatedAt: now,
    ipAddress: c.req.header("cf-connecting-ip") || null,
    userAgent: c.req.header("user-agent") || null,
  });

  // Set session cookie with Secure flag in non-localhost environments (H8)
  const isSecure = c.req.url.startsWith("https://") || !c.req.url.includes("localhost");
  const secureFlag = isSecure ? "; Secure" : "";
  const cookieValue = `better-auth.session_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secureFlag}`;
  c.res.headers.set("Set-Cookie", cookieValue);

  return c.json({
    user: {
      id: guestId,
      name: guestName,
      email: guestEmail,
      role: "guest",
      isGuest: true,
      ratings: {
        bullet: 1500,
        blitz: 1500,
        rapid: 1500,
        classical: 1500,
      },
    },
    token,
  });
});
