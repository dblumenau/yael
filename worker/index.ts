import { DurableObject } from "cloudflare:workers";
import { isHoneypot, parseContact, type ContactInput } from "./contact";

interface Env {
  ASSETS: Fetcher;
  CONTACTS: DurableObjectNamespace<ContactsDatabase>;
  INSTANCE_NAME: string;
  ADMIN_TOKEN?: string;
}

export type ContactRow = ContactInput & { id: number; created_at: string };

export class ContactsDatabase extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contactName TEXT NOT NULL,
      email TEXT NOT NULL,
      comments TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
  }

  add(c: ContactInput): void {
    this.ctx.storage.sql.exec(
      "INSERT INTO contacts (contactName, email, comments) VALUES (?, ?, ?)",
      c.contactName,
      c.email,
      c.comments,
    );
  }

  list(limit: number): ContactRow[] {
    return this.ctx.storage.sql
      .exec<ContactRow>("SELECT id, contactName, email, comments, created_at FROM contacts ORDER BY id DESC LIMIT ?", limit)
      .toArray();
  }
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

async function authorised(request: Request, token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const given = new TextEncoder().encode(request.headers.get("authorization") ?? "");
  const want = new TextEncoder().encode(`Bearer ${token}`);
  return given.byteLength === want.byteLength && crypto.subtle.timingSafeEqual(given, want);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    const db = () => env.CONTACTS.get(env.CONTACTS.idFromName(env.INSTANCE_NAME));

    if (pathname === "/api/health") return json({ ok: true, instance: env.INSTANCE_NAME });

    if (pathname === "/api/contact") {
      if (request.method !== "POST") return json({ error: "method not allowed" }, 405);
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return json({ errors: ["Invalid request"] }, 400);
      }
      if (isHoneypot(body)) return json({ ok: true }, 201);
      const parsed = parseContact(body);
      if (!parsed.ok) return json({ errors: parsed.errors }, 422);
      await db().add(parsed.value);
      return json({ ok: true }, 201);
    }

    if (pathname === "/api/admin/contacts") {
      if (!(await authorised(request, env.ADMIN_TOKEN))) return json({ error: "not found" }, 404);
      return json({ contacts: await db().list(200) });
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
