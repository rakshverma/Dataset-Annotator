import { getUser, unauthorized } from "@/lib/auth";

const SO_API_BASE = "https://api.stackexchange.com/2.3";
const MAX_SOURCE_CHARS = 4000;

function stripHtml(html) {
  if (!html) return "";
  return html
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`")
    .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, "\n```\n$1\n```\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(request) {
  const user = await getUser(request);
  if (!user) return unauthorized();

  try {
    const { query, tags = "", max_questions = 3 } = await request.json();
    if (!query?.trim()) {
      return Response.json({ error: "Query required" }, { status: 400 });
    }

    const tagParam = tags.trim()
      ? `&tagged=${encodeURIComponent(tags.trim())}`
      : "";

    // Search for questions
    const searchUrl =
      `${SO_API_BASE}/search/advanced` +
      `?order=desc&sort=relevance` +
      `&q=${encodeURIComponent(query.trim())}` +
      `${tagParam}&site=stackoverflow&filter=withbody` +
      `&pagesize=${max_questions}`;

    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) {
      return Response.json({ error: `SO API error: ${searchRes.status}` }, { status: 502 });
    }
    const searchData = await searchRes.json();
    const items = searchData.items || [];

    if (items.length === 0) {
      return Response.json([]);
    }

    // Fetch top answers
    const questionIds = items.map((i) => String(i.question_id));
    const answersUrl =
      `${SO_API_BASE}/questions/${questionIds.join(";")}/answers` +
      `?order=desc&sort=votes&site=stackoverflow&filter=withbody` +
      `&pagesize=5`;

    const ansRes = await fetch(answersUrl);
    const ansData = ansRes.ok ? await ansRes.json() : { items: [] };
    const answerMap = {};
    for (const ans of ansData.items || []) {
      const qid = ans.question_id;
      if (!answerMap[qid]) {
        answerMap[qid] = stripHtml(ans.body || "");
      }
    }

    // Build sources
    const sources = items.map((item) => {
      const qid = item.question_id;
      const qTitle = item.title || `Question #${qid}`;
      const qBody = stripHtml(item.body || "");
      const topAnswer = answerMap[qid] || "No answer available.";
      const combined = `QUESTION: ${qTitle}\n\n${qBody}\n\nTOP ANSWER:\n${topAnswer}`;

      return {
        source_type: "so_ground_truth",
        source_name: qTitle,
        source_ref: item.link || `https://stackoverflow.com/q/${qid}`,
        source_text: combined.slice(0, MAX_SOURCE_CHARS),
        score: item.score || 0,
        answer_count: item.answer_count || 0,
        tags: item.tags || [],
      };
    });

    return Response.json(sources);
  } catch (err) {
    console.error("SO search error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
