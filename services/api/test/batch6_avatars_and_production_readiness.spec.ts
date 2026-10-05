import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { beforeAll, describe, expect, it } from "vitest";
import app from "../src";
import * as schema from "../src/db/schema";
import { applyTestSchema } from "./helpers";

interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

interface AvatarUploadResponse {
  success: boolean;
  avatarUrl: string;
}

interface UserProfileResponse {
  user: {
    id: string;
    name: string;
    image: string | null;
  };
}

describe("Batch 6: Avatars, R2 Storage & Production Readiness", () => {
  const db = drizzle(env.DB, { schema });
  const testUserId = `b6_user_${Date.now()}`;
  const testUserToken = `token_${testUserId}`;

  const request = (path: string, init?: RequestInit) =>
    app.fetch(new Request(`http://localhost${path}`, init), env);

  beforeAll(async () => {
    await applyTestSchema(env.DB);
    const now = new Date();

    await db.insert(schema.user).values({
      id: testUserId,
      name: "AvatarTester",
      email: `${testUserId}@example.com`,
      role: "user",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(schema.session).values({
      id: `session_${testUserId}`,
      userId: testUserId,
      token: testUserToken,
      expiresAt: new Date(now.getTime() + 86_400_000),
      createdAt: now,
      updatedAt: now,
    });
  });

  describe("POST /api/users/avatar", () => {
    it("rejects unauthenticated requests with 401", async () => {
      const res = await request("/api/users/avatar", {
        method: "POST",
      });
      expect(res.status).toBe(401);
      const json = (await res.json()) as ApiErrorResponse;
      expect(json.error.code).toBe("UNAUTHENTICATED");
    });

    it("rejects non-multipart requests with 400", async () => {
      const res = await request("/api/users/avatar", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${testUserToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ file: "dummy" }),
      });
      expect(res.status).toBe(400);
      const json = (await res.json()) as ApiErrorResponse;
      expect(json.error.code).toBe("BAD_REQUEST");
    });

    it("rejects invalid MIME types with 400", async () => {
      const form = new FormData();
      form.append("file", new File(["dummy text content"], "document.txt", { type: "text/plain" }));

      const res = await request("/api/users/avatar", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${testUserToken}`,
        },
        body: form,
      });
      expect(res.status).toBe(400);
      const json = (await res.json()) as ApiErrorResponse;
      expect(json.error.code).toBe("INVALID_FILE_TYPE");
    });

    it("rejects oversized images (> 2MB) with 413", async () => {
      // 2.1 MB buffer
      const largeContent = new Uint8Array(2.1 * 1024 * 1024);
      const form = new FormData();
      form.append("file", new File([largeContent], "avatar.png", { type: "image/png" }));

      const res = await request("/api/users/avatar", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${testUserToken}`,
        },
        body: form,
      });
      expect(res.status).toBe(413);
      const json = (await res.json()) as ApiErrorResponse;
      expect(json.error.code).toBe("PAYLOAD_TOO_LARGE");
    });

    it("successfully uploads valid WebP/PNG image and updates user profile", async () => {
      const pngBytes = new Uint8Array([
        137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82,
      ]);
      const form = new FormData();
      form.append("file", new File([pngBytes], "avatar.png", { type: "image/png" }));

      const res = await request("/api/users/avatar", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${testUserToken}`,
        },
        body: form,
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as AvatarUploadResponse;
      expect(json.success).toBe(true);
      expect(json.avatarUrl).toBe(`/api/users/avatar/${testUserId}`);

      // Verify D1 user record was updated
      const [userRow] = await db.select().from(schema.user).where(eq(schema.user.id, testUserId));
      expect(userRow.image).toBe(`/api/users/avatar/${testUserId}`);
    });
  });

  describe("GET /api/users/avatar/:id", () => {
    it("returns 404 for a user who has no avatar uploaded", async () => {
      const res = await request("/api/users/avatar/non_existent_avatar_user");
      expect(res.status).toBe(404);
      const json = (await res.json()) as ApiErrorResponse;
      expect(json.error.code).toBe("NOT_FOUND");
    });

    it("serves the uploaded avatar binary with caching headers", async () => {
      const res = await request(`/api/users/avatar/${testUserId}`);
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("image/png");
      expect(res.headers.get("Cache-Control")).toContain("public");
      expect(res.headers.get("Cache-Control")).toContain("max-age=86400");

      const bodyBytes = new Uint8Array(await res.arrayBuffer());
      expect(bodyBytes.length).toBeGreaterThan(0);
      expect(bodyBytes[0]).toBe(137); // PNG magic byte
      expect(bodyBytes[1]).toBe(80);
    });
  });

  describe("PATCH /api/users/me profile image validation", () => {
    it("accepts an internal /api/ path as image URL", async () => {
      const res = await request("/api/users/me", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${testUserToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: `/api/users/avatar/${testUserId}`,
        }),
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as UserProfileResponse;
      expect(json.user.image).toBe(`/api/users/avatar/${testUserId}`);
    });

    it("accepts an external https image URL", async () => {
      const res = await request("/api/users/me", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${testUserToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: "https://images.unsplash.com/photo-chess.jpg",
        }),
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as UserProfileResponse;
      expect(json.user.image).toBe("https://images.unsplash.com/photo-chess.jpg");
    });

    it("rejects invalid schemes such as javascript: or ftp:", async () => {
      const res = await request("/api/users/me", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${testUserToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: "javascript:alert(1)",
        }),
      });
      expect(res.status).toBe(400);
    });
  });
});
