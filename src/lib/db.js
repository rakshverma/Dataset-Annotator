import { neon } from "@neondatabase/serverless";

let _sql = null;

export function getSQL() {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL not set");
    _sql = neon(url);
  }
  return _sql;
}

/**
 * Execute a parameterized query using Neon serverless tagged templates.
 * Converts standard SQL with $1, $2 placeholders to tagged template format.
 *
 * @param {string} text - SQL with $1, $2 placeholders
 * @param {any[]} params - Parameter values
 * @returns {Promise<any[]>} Array of row objects
 */
export async function query(text, params = []) {
  const sql = getSQL();

  // Build a tagged template call dynamically
  // Split SQL on $1, $2, ... to create template strings array and values
  const parts = text.split(/\$(\d+)/);
  const strings = [];
  const values = [];

  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      // Static SQL text
      strings.push(parts[i]);
    } else {
      // Parameter reference ($N) — N is 1-indexed
      const paramIndex = parseInt(parts[i], 10) - 1;
      values.push(params[paramIndex]);
    }
  }

  // For queries with no params, strings will just be [fullSQL]
  // Create a proper tagged template arguments array
  const templateStrings = Object.assign([...strings], { raw: [...strings] });
  Object.freeze(templateStrings);

  return sql(templateStrings, ...values);
}

export async function queryOne(text, params = []) {
  const rows = await query(text, params);
  return rows.length > 0 ? rows[0] : null;
}

export async function initTables() {
  const sql = getSQL();

  await sql`CREATE EXTENSION IF NOT EXISTS vector`;

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS dataset_examples (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      account_label TEXT NOT NULL,
      task_type TEXT NOT NULL DEFAULT 'itops_reasoning',
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS dataset_states (
      id SERIAL PRIMARY KEY,
      example_id INTEGER NOT NULL REFERENCES dataset_examples(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      content_json TEXT NOT NULL,
      reasoning_trace TEXT,
      ai_conclusion TEXT,
      change_note TEXT,
      modified_by TEXT NOT NULL,
      modified_at TEXT NOT NULL,
      model_name TEXT,
      concept_coverage TEXT DEFAULT '[]',
      UNIQUE(example_id, version)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS grounding_sources (
      id SERIAL PRIMARY KEY,
      example_id INTEGER NOT NULL REFERENCES dataset_examples(id) ON DELETE CASCADE,
      state_id INTEGER NOT NULL REFERENCES dataset_states(id) ON DELETE CASCADE,
      source_type TEXT NOT NULL,
      source_name TEXT,
      source_ref TEXT,
      source_text TEXT,
      added_by TEXT NOT NULL,
      added_at TEXT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS concept_registry (
      concept TEXT PRIMARY KEY,
      usage_count INTEGER NOT NULL DEFAULT 1,
      last_used_at TEXT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS wiki_documents (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '',
      source_ref TEXT,
      content_text TEXT NOT NULL DEFAULT '',
      added_by TEXT NOT NULL,
      added_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS document_chunks (
      id TEXT PRIMARY KEY,
      doc_id TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'wiki',
      title TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '',
      chunk_index INTEGER NOT NULL DEFAULT 0,
      content TEXT NOT NULL,
      embedding vector(3072),
      metadata JSONB DEFAULT '{}'::jsonb
    )
  `;

  try {
    await sql`CREATE INDEX IF NOT EXISTS idx_chunks_source ON document_chunks (source)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_chunks_doc_id ON document_chunks (doc_id)`;
  } catch (e) {
    // indexes may already exist
  }
}
