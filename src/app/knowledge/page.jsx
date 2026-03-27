"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { apiJson, isLoggedIn } from "@/lib/api";

export default function KnowledgeBasePage() {
  const router = useRouter();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [showUpload, setShowUpload] = useState(false);
  const [search, setSearch] = useState("");

  // Upload form
  const [docTitle, setDocTitle] = useState("");
  const [docTags, setDocTags] = useState("");
  const [docRef, setDocRef] = useState("");
  const [docContent, setDocContent] = useState("");
  const [uploading, setUploading] = useState(false);

  // Vector stats
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/login"); return; }
    loadData();
  }, [router]);

  async function loadData() {
    try {
      const [docsData, statsData] = await Promise.all([
        apiJson("/api/wiki"),
        apiJson("/api/vectors/stats"),
      ]);
      setDocs(docsData);
      setStats(statsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch() {
    setLoading(true);
    const url = search.trim() ? `/api/wiki?search=${encodeURIComponent(search)}` : "/api/wiki";
    try {
      const data = await apiJson(url);
      setDocs(data);
    } catch (err) {
      setMsg({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload() {
    if (!docTitle.trim() || !docContent.trim()) {
      setMsg({ type: "error", text: "Title and content required" });
      return;
    }
    setUploading(true);
    try {
      const res = await apiJson("/api/wiki", {
        method: "POST",
        body: JSON.stringify({
          title: docTitle.trim(),
          tags: docTags.trim(),
          source_ref: docRef.trim(),
          content_text: docContent.trim(),
        }),
      });
      setMsg({ type: "success", text: `Document #${res.id} saved — ${res.chunks} chunks embedded` });
      setShowUpload(false);
      setDocTitle(""); setDocTags(""); setDocRef(""); setDocContent("");
      loadData();
    } catch (err) {
      setMsg({ type: "error", text: err.message });
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this document and its embeddings?")) return;
    try {
      await apiJson(`/api/wiki/${id}`, { method: "DELETE" });
      setDocs(docs.filter((d) => d.id !== id));
      setMsg({ type: "success", text: "Document deleted" });
    } catch (err) {
      setMsg({ type: "error", text: err.message });
    }
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <h1 className="page-title">Knowledge Base</h1>
        <p className="page-subtitle">Manage wiki documents and vector embeddings</p>

        {stats && (
          <div className="stat-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            <div className="stat-card">
              <div className="stat-value">{docs.length}</div>
              <div className="stat-label">Wiki Documents</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.total_chunks?.toLocaleString() || 0}</div>
              <div className="stat-label">Total Chunks</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.ok ? "✓" : "✗"}</div>
              <div className="stat-label">Vector Store</div>
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
          <input
            className="form-input"
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            style={{ flex: 1 }}
          />
          <button className="btn btn-secondary" onClick={handleSearch}>Search</button>
          <button className="btn btn-primary" onClick={() => setShowUpload(!showUpload)}>
            {showUpload ? "Cancel" : "+ Add Document"}
          </button>
        </div>

        {msg.text && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

        {showUpload && (
          <div className="card" style={{ marginBottom: "1.5rem" }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem" }}>Upload Document</h3>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Title</label>
                <input className="form-input" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Tags (comma-separated)</label>
                <input className="form-input" value={docTags} onChange={(e) => setDocTags(e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Source Reference</label>
              <input className="form-input" value={docRef} onChange={(e) => setDocRef(e.target.value)} placeholder="https://..." />
            </div>
            <div className="form-group">
              <label className="form-label">Content</label>
              <textarea className="form-textarea" value={docContent} onChange={(e) => setDocContent(e.target.value)} rows={8} />
            </div>
            <button className="btn btn-primary" onClick={handleUpload} disabled={uploading}>
              {uploading ? <span className="spinner" /> : "📤"} Upload & Embed
            </button>
          </div>
        )}

        {loading ? (
          <div className="empty-state"><span className="spinner" /></div>
        ) : docs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📄</div>
            <p>No documents yet. Click &quot;Add Document&quot; to get started.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {docs.map((doc) => (
              <div key={doc.id} className="card card-compact" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong style={{ fontSize: "0.92rem" }}>{doc.title}</strong>
                  <div style={{ fontSize: "0.78rem", color: "#6B7280", marginTop: "0.2rem" }}>
                    {doc.tags && <span className="pill pill-blue">{doc.tags}</span>}
                    <span className="pill pill-gray">{doc.added_by}</span>
                    <span className="pill pill-gray">{doc.added_at?.slice(0, 10)}</span>
                    {doc.content_length && <span className="pill pill-gray">{Math.round(doc.content_length / 1000)}k chars</span>}
                  </div>
                </div>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(doc.id)}>Delete</button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
