import { GoogleGenAI } from "@google/genai";

const EMBED_MODEL = "gemini-embedding-001";
const EMBED_DIM = 3072;
const BATCH_SIZE = 100;

function getClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");
  return new GoogleGenAI({ apiKey: key });
}

export async function embedText(text) {
  const client = getClient();
  const result = await client.models.embedContent({
    model: EMBED_MODEL,
    contents: text.trim(),
  });
  if (result?.embeddings?.[0]?.values) {
    return result.embeddings[0].values;
  }
  throw new Error("Gemini embedding returned no data");
}

export async function embedBatch(texts) {
  const client = getClient();
  const results = new Array(texts.length).fill(null);

  for (let start = 0; start < texts.length; start += BATCH_SIZE) {
    const batch = texts.slice(start, start + BATCH_SIZE);
    const validIndices = [];
    const validTexts = [];

    batch.forEach((t, i) => {
      const stripped = t?.trim();
      if (stripped) {
        validIndices.push(start + i);
        validTexts.push(stripped);
      }
    });

    if (validTexts.length === 0) continue;

    try {
      const result = await client.models.embedContent({
        model: EMBED_MODEL,
        contents: validTexts,
      });
      if (result?.embeddings) {
        result.embeddings.forEach((emb, idx) => {
          results[validIndices[idx]] = emb.values;
        });
      }
    } catch (err) {
      // Fallback to sequential
      for (let i = 0; i < validTexts.length; i++) {
        try {
          results[validIndices[i]] = await embedText(validTexts[i]);
        } catch {
          // skip failed
        }
      }
    }
  }

  return results;
}

export { EMBED_DIM };
