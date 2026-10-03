import type { Context, MiddlewareHandler } from "hono";
import { createAuth } from "../auth";
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
  const sessionResult = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

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
