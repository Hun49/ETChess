import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema";

/**
 * Server-only utility to seed or promote an admin user directly in D1.
 * Admin roles can NEVER be granted via public sign-up or user update endpoints.
 */
export async function seedAdminUser(
  d1: D1Database,
  options: {
    id?: string;
    email: string;
    name: string;
  },
): Promise<{ id: string; email: string; role: string }> {
  const db = drizzle(d1, { schema });
  const now = new Date();

  const [existing] = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.email, options.email));

  if (existing) {
    await db
      .update(schema.user)
      .set({
        role: "admin",
        isBanned: false,
        banExpiresAt: null,
        updatedAt: now,
      })
      .where(eq(schema.user.id, existing.id));

    return { id: existing.id, email: existing.email, role: "admin" };
  }

  const newId = options.id || crypto.randomUUID();
  await db.insert(schema.user).values({
    id: newId,
    name: options.name,
    email: options.email,
    emailVerified: true,
    role: "admin",
    isBanned: false,
    createdAt: now,
    updatedAt: now,
  });

  await db
    .insert(schema.ratings)
    .values({
      userId: newId,
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
    })
    .onConflictDoNothing();

  return { id: newId, email: options.email, role: "admin" };
}
