"use server";

import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

const SESSION_COOKIE = "tpt_session";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  avatar: string | null;
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomUUID() + "-" + crypto.randomUUID();
  const expires = new Date(Date.now() + SESSION_DURATION_MS);

  await db.session.create({
    data: {
      sessionToken: token,
      userId,
      expires,
    },
  });

  return token;
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: new Date(Date.now() + SESSION_DURATION_MS),
    path: "/",
  });
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { sessionToken: token },
    include: {
      user: {
        select: { id: true, email: true, name: true, role: true, avatar: true, active: true },
      },
    },
  });

  if (!session || session.expires < new Date()) {
    if (session) await db.session.delete({ where: { sessionToken: token } });
    return null;
  }

  if (!session.user.active) return null;

  // Periodically prune expired sessions (~1% of calls)
  if (Math.random() < 0.01) {
    db.session.deleteMany({ where: { expires: { lt: new Date() } } }).catch(() => {});
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
    avatar: session.user.avatar,
  };
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    const { redirect } = await import("next/navigation");
    redirect("/login");
  }
  return session as SessionUser;
}

export async function requireRole(
  allowedRoles: string[]
): Promise<SessionUser> {
  const session = await requireSession();
  if (!allowedRoles.includes(session.role)) {
    const { redirect } = await import("next/navigation");
    redirect("/unauthorized");
  }
  return session;
}

export async function signIn(
  email: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });

  if (!user || !user.passwordHash) {
    return { success: false, error: "Invalid email or password" };
  }

  if (!user.active) {
    return { success: false, error: "Account is inactive" };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return { success: false, error: "Invalid email or password" };
  }

  const token = await createSession(user.id);
  await setSessionCookie(token);
  return { success: true };
}

export async function signOut() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { sessionToken: token } });
    cookieStore.delete(SESSION_COOKIE);
  }
}
