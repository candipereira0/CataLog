import { getDJMatches, getUserFromSession, updateDeviceLastSeen } from "./db";

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function getSessionCookie(req: Request): string | null {
  const cookie = req.headers.get("cookie");
  if (!cookie) return null;
  const match = cookie.match(/session=([^;]+)/);
  return match ? match[1] : null;
}

function requireAuth(req: Request): { userId: number; user: Record<string, unknown>; sessionId: string } | Response {
  const sessionId = getSessionCookie(req);
  if (!sessionId) return json({ error: "Unauthorized" }, 401);
  const user = getUserFromSession(sessionId);
  if (!user) {
    const resp = json({ error: "Unauthorized" }, 401);
    resp.headers.set("Set-Cookie", "session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
    return resp;
  }
  updateDeviceLastSeen(sessionId);
  return { userId: user.id as number, user, sessionId };
}

export async function handleGetUserMatches(req: Request, userId: string): Promise<Response> {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const targetId = parseInt(userId);
  if (isNaN(targetId)) return json({ error: "Invalid user ID" }, 400);

  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get("limit") || "20");

  const matches = getDJMatches(targetId, Math.min(limit, 50));
  return json({ matches });
}
