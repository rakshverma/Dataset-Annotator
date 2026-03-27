import { query } from "@/lib/db";
import { getUser, unauthorized } from "@/lib/auth";
import { embedText } from "@/lib/embeddings";

export async function POST(request) {
  const user = await getUser(request);
  if (!user) return unauthorized();

  try {
    const { query: searchQuery, n_results = 5, source_filter = null, min_score = 0 } = await request.json();
    if (!searchQuery?.trim()) {
      return Response.json({ error: "Query required" }, { status: 400 });
    }

    const queryVec = await embedText(searchQuery.trim());
    const vecStr = `[${queryVec.join(",")}]`;

    let sql = `
      SELECT id, doc_id, source, title, tags, chunk_index, content, metadata,
             1 - (embedding <=> $1::vector) AS similarity
      FROM document_chunks
    `;
    const params = [vecStr];

    if (source_filter) {
      sql += ` WHERE source = $2`;
      params.push(source_filter);
    }

    sql += ` ORDER BY embedding <=> $1::vector LIMIT $${params.length + 1}`;
    params.push(n_results);

    const rows = await query(sql, params);

    const hits = rows
      .map((row) => ({
        doc_id: row.doc_id,
        title: row.title || "",
        tags: row.tags || "",
        chunk: row.content || "",
        score: Math.round(parseFloat(row.similarity || 0) * 10000) / 10000,
        chunk_index: row.chunk_index || 0,
        source: row.source || "wiki",
        ...(row.metadata || {}),
      }))
      .filter((h) => h.score >= min_score);

    return Response.json(hits);
  } catch (err) {
    console.error("Search error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
