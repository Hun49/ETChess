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

describe("Batch 11: Security Hardening, Moderation & Avatar File Audits", () => {
  const db = drizzle(env.DB, { schema });

  const adminUserId = `b11_admin_${Date.now()}`;
  const adminToken = `token_${adminUserId}`;

  const normalUserId = `b11_normal_${Date.now()}`;
  const normalUserToken = `token_${normalUserId}`;

  const guestUserId = `b11_guest_${Date.now()}`;
  const guestUserToken = `token_${guestUserId}`;

  const request = (path: string, init?: RequestInit) =>
    app.fetch(new Request(`http://localhost${path}`, init), env);

  beforeAll(async () => {
    await applyTestSchema(env.DB);
    const now = new Date();
    const future = new Date(now.getTime() + 86_400_000);

    // 1. Create Admin
    await db.insert(schema.user).values({
      id: adminUserId,
      name: "SuperAdmin",
      email: `${adminUserId}@etchess.com`,
      role: "admin",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(schema.session).values({
      id: `sess_${adminUserId}`,
      userId: adminUserId,
      token: adminToken,
      expiresAt: future,
      createdAt: now,
      updatedAt: now,
    });

    // 2. Create Normal User
    await db.insert(schema.user).values({
      id: normalUserId,
      name: "NormalPlayer",
      email: `${normalUserId}@test.com`,
      role: "user",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(schema.session).values({
      id: `sess_${normalUserId}`,
      userId: normalUserId,
      token: normalUserToken,
      expiresAt: future,
      createdAt: now,
      updatedAt: now,
    });

    // 3. Create Guest User
    await db.insert(schema.user).values({
      id: guestUserId,
      name: "GuestPlayer",
      email: `${guestUserId}@guest.etchess.com`,
      role: "guest",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(schema.session).values({
      id: `sess_${guestUserId}`,
      userId: guestUserId,
      token: guestUserToken,
      expiresAt: future,
      createdAt: now,
      updatedAt: now,
    });
  });

  describe("Admin Authorization Matrix", () => {
    it("rejects unauthenticated requests to admin metrics with 401", async () => {
      const res = await request("/api/admin/metrics");
      expect(res.status).toBe(401);
      const json = (await res.json()) as ApiErrorResponse;
      expect(json.error.code).toBe("UNAUTHENTICATED");
    });

    it("rejects guest users from admin metrics with 403", async () => {
      const res = await request("/api/admin/metrics", {
        headers: { Authorization: `Bearer ${guestUserToken}` },
      });
      expect(res.status).toBe(403);
      const json = (await res.json()) as ApiErrorResponse;
      expect(json.error.code).toBe("FORBIDDEN");
    });

    it("rejects regular users from admin metrics with 403", async () => {
      const res = await request("/api/admin/metrics", {
        headers: { Authorization: `Bearer ${normalUserToken}` },
      });
      expect(res.status).toBe(403);
      const json = (await res.json()) as ApiErrorResponse;
      expect(json.error.code).toBe("FORBIDDEN");
    });

    it("allows admin user to access admin metrics", async () => {
      const res = await request("/api/admin/metrics", {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as { totalUsers: number };
      expect(json.totalUsers).toBeGreaterThan(0);
    });

    it("rejects regular users from audit logs with 403", async () => {
      const res = await request("/api/admin/audit-logs", {
        headers: { Authorization: `Bearer ${normalUserToken}` },
      });
      expect(res.status).toBe(403);
      const json = (await res.json()) as ApiErrorResponse;
      expect(json.error.code).toBe("FORBIDDEN");
    });

    it("allows admin user to fetch audit logs", async () => {
      const res = await request("/api/admin/audit-logs", {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as { auditLogs: unknown[] };
      expect(Array.isArray(json.auditLogs)).toBe(true);
    });

    it("prevents admin from banning themselves", async () => {
      const res = await request(`/api/admin/users/${adminUserId}/ban`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          durationDays: 1,
          reason: "Testing self-ban",
        }),
      });
      expect(res.status).toBe(400);
      const json = (await res.json()) as ApiErrorResponse;
      expect(json.error.code).toBe("VALIDATION_FAILED");
      expect(json.error.message).toContain("Cannot ban yourself");
    });
  });

  describe("Banned Account Enforcement", () => {
    it("immediately locks banned users out of authenticated routes", async () => {
      // 1. Admin bans normal user
      const banRes = await request(`/api/admin/users/${normalUserId}/ban`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          durationDays: 3,
          reason: "Policy violation",
        }),
      });
      expect(banRes.status).toBe(200);

      // 2. Normal user tries to access /api/users/me
      const meRes = await request("/api/users/me", {
        headers: { Authorization: `Bearer ${normalUserToken}` },
      });
      expect(meRes.status).toBe(403);
      const json = (await meRes.json()) as ApiErrorResponse;
      expect(json.error.code).toBe("FORBIDDEN");
      expect(json.error.message).toContain("banned");

      // 3. Admin unbans normal user
      const unbanRes = await request(`/api/admin/users/${normalUserId}/unban`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reason: "Restored",
        }),
      });
      expect(unbanRes.status).toBe(200);

      // 4. Normal user can access /api/users/me again
      const restoredMeRes = await request("/api/users/me", {
        headers: { Authorization: `Bearer ${normalUserToken}` },
      });
      expect(restoredMeRes.status).toBe(200);
    });
  });

  describe("R2 Avatar Security & Magic Byte Inspection", () => {
    it("rejects malicious file with fake MIME header and HTML content", async () => {
      const maliciousBytes = new TextEncoder().encode(
        "<html><body><script>malware()</script></body></html>",
      );
      const form = new FormData();
      form.append("file", new File([maliciousBytes], "avatar.jpg", { type: "image/jpeg" }));

      const res = await request("/api/users/avatar", {
        method: "POST",
        headers: { Authorization: `Bearer ${normalUserToken}` },
        body: form,
      });
      expect(res.status).toBe(400);
      const json = (await res.json()) as ApiErrorResponse;
      expect(json.error.code).toBe("INVALID_FILE_SIGNATURE");
    });

    it("rejects truncated/corrupt image header", async () => {
      const corruptBytes = new Uint8Array([0xff, 0xd8, 0x00]); // truncated
      const form = new FormData();
      form.append("file", new File([corruptBytes], "avatar.jpg", { type: "image/jpeg" }));

      const res = await request("/api/users/avatar", {
        method: "POST",
        headers: { Authorization: `Bearer ${normalUserToken}` },
        body: form,
      });
      expect(res.status).toBe(400);
      const json = (await res.json()) as ApiErrorResponse;
      expect(json.error.code).toBe("INVALID_FILE_SIGNATURE");
    });

    it("accepts authentic JPEG image with FF D8 FF signature", async () => {
      const validJpeg = new Uint8Array([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      ]);
      const form = new FormData();
      form.append("file", new File([validJpeg], "avatar.jpg", { type: "image/jpeg" }));

      const res = await request("/api/users/avatar", {
        method: "POST",
        headers: { Authorization: `Bearer ${normalUserToken}` },
        body: form,
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as { success: boolean; avatarUrl: string };
      expect(json.success).toBe(true);
      expect(json.avatarUrl).toBe(`/api/users/avatar/${normalUserId}`);

      // Verify profile was updated in D1
      const [u] = await db.select().from(schema.user).where(eq(schema.user.id, normalUserId));
      expect(u.image).toBe(`/api/users/avatar/${normalUserId}`);
    });

    it("allows user to delete avatar, resetting image to null", async () => {
      const delRes = await request("/api/users/avatar", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${normalUserToken}` },
      });
      expect(delRes.status).toBe(200);

      // Verify D1 image is null
      const [u] = await db.select().from(schema.user).where(eq(schema.user.id, normalUserId));
      expect(u.image).toBeNull();

      // Subsequent GET returns 404
      const getRes = await request(`/api/users/avatar/${normalUserId}`);
      expect(getRes.status).toBe(404);
    });
  });

  describe("API Consistency & Envelope Format", () => {
    it("returns consistent standard error envelope { error: { code, message } } on not found", async () => {
      const res = await request("/api/non-existent-endpoint");
      expect(res.status).toBe(404);
      const json = (await res.json()) as ApiErrorResponse;
      expect(json.error).toBeDefined();
      expect(typeof json.error.code).toBe("string");
      expect(typeof json.error.message).toBe("string");
    });
  });
});
