import type { AppType } from "@etchess/api";
import { createAuthClient } from "better-auth/react";
import { hc } from "hono/client";

const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

export const authClient = createAuthClient({
  baseURL: `${origin}/api/auth`,
});

export const { signIn, signUp, signOut, useSession } = authClient;

export const api = hc<AppType>(origin, {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => {
    return fetch(input, {
      ...init,
      credentials: "include",
    });
  },
});
