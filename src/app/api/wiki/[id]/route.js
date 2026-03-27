import { query, queryOne } from "@/lib/db";
import { getUser, unauthorized } from "@/lib/auth";

export async function GET(request, { params }) {
  const user = await getUser(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const doc = await queryOne("SELECT * FROM wiki_documents WHERE id = $1", [id]);
  if (!doc) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(doc);
}

export async function DELETE(request, { params }) {
  const user = await getUser(request);
  if (!user) return unauthorized();

  const { id } = await params;
  await query("DELETE FROM document_chunks WHERE doc_id = $1 AND source = 'wiki'", [String(id)]);
  await query("DELETE FROM wiki_documents WHERE id = $1", [id]);
  return Response.json({ ok: true });
}
