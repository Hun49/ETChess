import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { MiddlewareHandler } from "hono";
import { createAuth } from "../auth";
import * as schema from "../db/schema";
import type { Env } from "../types";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  isBanned: boolean;
  banExpiresAt?: Date | null;
  image?: string | null;
};

export type SessionData = {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
};

export interface HonoVariables {
  user: SessionUser | null;
  session: SessionData | null;
  requestId: string;
}

export const sessionMiddleware: MiddlewareHandler<{
  Bindings: Env;
  Variables: HonoVariables;
}> = async (c, next) => {
  const auth = createAuth(c.env);
  let sessionResult = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  // Fallback: check session table in D1 for guest sessions or direct Bearer tokens
  if (!sessionResult) {
    const authHeader = c.req.header("authorization");
    const cookieHeader = c.req.header("cookie");
    let token: string | null = null;

    if (authHeader?.toLowerCase().startsWith("bearer ")) {
      token = authHeader.slice(7).trim();
    } else if (cookieHeader) {
      const match = cookieHeader.match(/better-auth\.session_token=([^;]+)/);
      if (match) {
        // Strip out any trailing path/attributes if passed in raw header
        const rawToken = match[1].trim();
        token = decodeURIComponent(rawToken.split(";")[0].split(".")[0]);
      }
    }

    if (token) {
      try {
        const db = drizzle(c.env.DB, { schema });
        const [sess] = await db
          .select()
          .from(schema.session)
          .where(eq(schema.session.token, token));

        if (sess && new Date(sess.expiresAt).getTime() > Date.now()) {
          const [u] = await db.select().from(schema.user).where(eq(schema.user.id, sess.userId));

          if (u) {
            sessionResult = {
              user: u,
              session: sess,
            } as unknown as NonNullable<typeof sessionResult>;
          }
        }
      } catch {
        // Ignored, proceed unauthenticated
      }
    }
  }

  if (sessionResult) {
    const user = sessionResult.user as unknown as SessionUser;
    // Check if user is currently banned
    if (user.isBanned) {
      if (user.banExpiresAt && new Date(user.banExpiresAt).getTime() < Date.now()) {
        // Ban expired, can continue
        c.set("user", user);
        c.set("session", sessionResult.session as unknown as SessionData);
      } else {
        c.set("user", null);
        c.set("session", null);
        return c.json(
          {
            error: {
              code: "FORBIDDEN",
              message: "Account is banned",
            },
          },
          403,
        );
      }
    } else {
      c.set("user", user);
      c.set("session", sessionResult.session as unknown as SessionData);
    }
  } else {
    c.set("user", null);
    c.set("session", null);
  }

  await next();
};

export const requireAuth: MiddlewareHandler<{
  Bindings: Env;
  Variables: HonoVariables;
}> = async (c, next) => {
  const user = c.get("user");
  if (!user) {
    return c.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "Authentication required",
        },
      },
      401,
    );
  }
  await next();
};

export const requireRole = (
  allowedRoles: string[],
): MiddlewareHandler<{
  Bindings: Env;
  Variables: HonoVariables;
}> => {
  return async (c, next) => {
    const user = c.get("user");
    if (!user) {
      return c.json(
        {
          error: {
            code: "UNAUTHENTICATED",
            message: "Authentication required",
          },
        },
        401,
      );
    }
    if (!allowedRoles.includes(user.role)) {
      return c.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Insufficient permissions",
          },
        },
        403,
      );
    }
    await next();
  };
};
