export type UserRole = "user" | "admin" | "moderator";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role: UserRole;
  banned: boolean;
  createdAt: number;
}
