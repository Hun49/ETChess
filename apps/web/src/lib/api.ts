import type { AppType } from "@etchess/api";
import { createAuthClient } from "better-auth/react";
import { hc } from "hono/client";

const origin =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
  (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");

export const authClient = createAuthClient({
  baseURL: origin,
  plugins: [],
});

export const { signIn, signOut, useSession } = authClient;

export const api = hc<AppType>(origin, {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => {
    return fetch(input, {
      ...init,
      credentials: "include",
    });
  },
});
