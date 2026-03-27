import { query, queryOne, getSQL } from "@/lib/db";
import { verifyPassword, signToken } from "@/lib/auth";

export async function POST(request) {
  try {
    const body = await request.json();
    const { username, password } = body || {};

    if (!username?.trim() || !password?.trim()) {
      return Response.json({ error: "Username and password required" }, { status: 400 });
    }

    // Ensure users table exists (handles first-run)
    const sql = getSQL();
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    const user = await queryOne(
      "SELECT id, username, password_hash FROM users WHERE username = $1",
      [username.trim()]
    );

    if (!user) {
      return Response.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return Response.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const token = await signToken({ sub: user.username, id: user.id });
    return Response.json({ token, username: user.username });
  } catch (err) {
    console.error("Login error:", err?.message || err);
    return Response.json({ error: `Login failed: ${err?.message || "Unknown error"}` }, { status: 500 });
  }
}
