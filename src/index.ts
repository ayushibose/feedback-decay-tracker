import { calculateDecayScores, getUserEscalations } from "./decay-calculator";
import { analyzeWithAI } from "./ai";

export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  AI: any;
}

const HTML_TEMPLATE =`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Feedback Decay Tracker</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #0f0f0f;
      color: #e0e0e0;
      margin: 0;
      padding: 20px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { margin: 0 0 8px; color: #fff; }
    .subtitle { color: #888; margin: 0 0 20px; }

    .row { display: flex; gap: 12px; flex-wrap: wrap; align-items: end; }
    .card {
      background: #1a1a1a;
      border-radius: 12px;
      padding: 16px;
      margin: 12px 0;
      border-left: 4px solid #666;
    }
    .card.critical { border-left-color: #ff4444; }
    .card.warning  { border-left-color: #ffaa00; }
    .card.stable   { border-left-color: #00aa00; }

    .header { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
    .title { font-size: 1.1rem; font-weight: 700; color: #fff; }

    .score {
      font-size: 1.8rem;
      font-weight: 800;
      padding: 6px 14px;
      border-radius: 10px;
      background: rgba(255,255,255,0.08);
      min-width: 80px;
      text-align: center;
    }
    .score.critical { color: #ff4444; }
    .score.warning  { color: #ffaa00; }
    .score.stable   { color: #00aa00; }

    .metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 10px;
      margin-top: 12px;
    }
    .metric {
      background: #0f0f0f;
      border-radius: 10px;
      padding: 10px;
    }
    .metric .label { color: #888; font-size: 0.85rem; margin-bottom: 6px; }
    .metric .value { color: #fff; font-size: 1.1rem; font-weight: 700; }

    .alert {
      background: linear-gradient(135deg, #ff4444 0%, #cc0000 100%);
      border-radius: 12px;
      padding: 16px;
      margin: 14px 0 18px;
      border-left: 4px solid #ff0000;
    }
    .alert h2 { margin: 0 0 6px; color: #fff; font-size: 1.1rem; }
    .alert p { margin: 0; color: rgba(255,255,255,0.9); }

    .section-title { margin-top: 26px; margin-bottom: 10px; color: #fff; }

    .pill {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      background: rgba(255,255,255,0.1);
      margin-right: 6px;
      margin-top: 6px;
      font-size: 0.85rem;
      color: #fff;
    }

    .muted { color: #aaa; }

    input, select, button {
      background: #1a1a1a;
      border: 1px solid #333;
      color: #e0e0e0;
      border-radius: 10px;
      padding: 10px 12px;
    }
    button { cursor: pointer; }
    button:hover { border-color: #555; }
    .small { font-size: 0.85rem; color: #aaa; margin-top: 8px; }
    pre { white-space: pre-wrap; background:#0f0f0f; padding:10px; border-radius:10px; border:1px solid #222; }
  </style>
</head>
<body>
  <div class="container">
    <h1>⚡ Feedback Decay Tracker</h1>
    <p class="subtitle">Time-based escalation risk from feedback trends</p>

    <div class="card">
      <div class="header">
        <div class="title">Quick ingest (proves Workers AI)</div>
      </div>
      <div class="row" style="margin-top:12px;">
        <input id="user_id" placeholder="user_id (e.g., user_999)" />
        <select id="channel">
          <option>Discord</option>
          <option>Email</option>
          <option>Support Ticket</option>
          <option>GitHub</option>
          <option>Twitter</option>
          <option>Forum</option>
        </select>
        <input id="created_at" placeholder="created_at ISO (leave blank = now)" style="min-width:260px;" />
        <input id="feedback_text" placeholder="feedback_text" style="flex:1; min-width:320px;" />
        <button id="send">Analyze + Save</button>
      </div>
      <div class="small">Tip: leave created_at blank to use current time. After ingest, refresh to see updated scores.</div>
      <pre id="ingest_out" class="muted"></pre>
    </div>

    <div id="content">Loading...</div>
  </div>

<script>
function esc(s) {
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;");
}

function severity(score) {
  if (score >= 70) return "critical";
  if (score >= 40) return "warning";
  return "stable";
}

async function postJSON(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: {"content-type":"application/json"},
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

async function loadData() {
  const [decayRes, escalationsRes] = await Promise.all([
    fetch("/api/decay-scores"),
    fetch("/api/escalations")
  ]);

  const decayData = await decayRes.json();
  const escalations = await escalationsRes.json();

  const criticalIssues = decayData.filter(d => d.decayScore >= 70);

  let html = "";

  if (criticalIssues.length > 0) {
    html += '<div class="alert">';
    html += '<h2>🚨 CRITICAL DECAY ALERTS (' + criticalIssues.length + ')</h2>';
    html += '<p>High-risk themes: long-running + growing volume + worsening sentiment + channel escalation</p>';
    html += '</div>';
  }

  decayData.forEach(issue => {
    const sev = severity(issue.decayScore);
    html += '<div class="card ' + sev + '">';
    html += '<div class="header">';
    html += '<div class="title">' + esc(issue.issue_theme) + '</div>';
    html += '<div class="score ' + sev + '">' + issue.decayScore + '</div>';
    html += '</div>';

    const m = issue.metrics || {};
    html += '<div class="metrics">';
    html += '<div class="metric"><div class="label">Age</div><div class="value">' + (m.ageInDays ?? "-") + ' days</div></div>';
    html += '<div class="metric"><div class="label">Total</div><div class="value">' + (m.totalCount ?? "-") + '</div></div>';
    html += '<div class="metric"><div class="label">Recent (14d)</div><div class="value">' + (m.recentCount ?? "-") + '</div></div>';
    html += '<div class="metric"><div class="label">Growth (norm)</div><div class="value">↗️ ' + (m.volumeGrowthNorm ?? "-") + '</div></div>';
    html += '<div class="metric"><div class="label">Worsening</div><div class="value">↘️ ' + (m.sentimentWorsening ?? "-") + '</div></div>';
    html += '<div class="metric"><div class="label">Avg sentiment</div><div class="value">' + (m.avgSentiment ?? "-") + '</div></div>';
    html += '<div class="metric"><div class="label">Channels</div><div class="value">' + (m.uniqueChannels ?? "-") + '</div></div>';
    html += '<div class="metric"><div class="label">Repeat users</div><div class="value">' + (m.repeatComplainers ?? "-") + '</div></div>';
    html += '<div class="metric"><div class="label">First seen</div><div class="value">' + (m.firstComplaint ?? "-") + '</div></div>';
    html += '<div class="metric"><div class="label">Last seen</div><div class="value">' + (m.lastComplaint ?? "-") + '</div></div>';
    html += '</div>';

    html += '</div>';
  });

  if (Array.isArray(escalations) && escalations.length > 0) {
    html += '<h2 class="section-title">🔥 Recent escalations (cross-channel users)</h2>';
    escalations.forEach(escRow => {
      const channels = String(escRow.channels || "").split(",").map(s => s.trim()).filter(Boolean);
      html += '<div class="card warning">';
      html += '<div class="title">👤 ' + esc(escRow.user_id) + ' <span class="muted">— ' + esc(escRow.issue_theme) + '</span></div>';
      html += '<div style="margin-top:8px;">';
      channels.forEach(ch => { html += '<span class="pill">' + esc(ch) + '</span>'; });
      html += '</div>';
      html += '<div class="small">';
      html += 'Complaints: ' + escRow.complaint_count + ' • ';
      html += 'First: ' + esc(escRow.first_complaint) + ' • ';
      html += 'Last: ' + esc(escRow.last_complaint) + ' • ';
      html += 'Avg sentiment: ' + Number(escRow.avg_sentiment).toFixed(2);
      html += '</div>';
      html += '</div>';
    });
  }

  document.getElementById("content").innerHTML = html || "<p>No data found. Seed your DB first.</p>";
}

document.getElementById("send").addEventListener("click", async () => {
  const user_id = document.getElementById("user_id").value.trim() || "user_demo";
  const channel = document.getElementById("channel").value;
  const feedback_text = document.getElementById("feedback_text").value.trim();
  const created_at_in = document.getElementById("created_at").value.trim();

  if (!feedback_text) {
    document.getElementById("ingest_out").textContent = "Please enter feedback_text.";
    return;
  }

  const created_at = created_at_in || new Date().toISOString();

  document.getElementById("ingest_out").textContent = "Analyzing...";
  const r = await postJSON("/api/ingest", { user_id, channel, feedback_text, created_at });
  document.getElementById("ingest_out").textContent = JSON.stringify(r.data, null, 2);

  await loadData();
});

loadData();
</script>
</body>
</html>`;


async function json(data: any, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json; charset=utf-8" },
    ...init
  });
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);

    // Serve dashboard
    if (url.pathname === "/" || url.pathname === "") {
      return new Response(HTML_TEMPLATE, { headers: { "Content-Type": "text/html" } });
    }

    // NEW: Ingest endpoint using Workers AI (proves AI usage)
    if (url.pathname === "/api/ingest" && request.method === "POST") {
      const body = await request.json().catch(() => null) as any;
      if (!body?.user_id || !body?.channel || !body?.feedback_text || !body?.created_at) {
        return json({ error: "Missing user_id/channel/feedback_text/created_at" }, { status: 400 });
      }

      const ai = await analyzeWithAI(env, body.feedback_text);

      await env.DB.prepare(`
        INSERT INTO feedback (user_id, channel, issue_theme, feedback_text, sentiment_score, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        body.user_id,
        body.channel,
        ai.issue_theme,
        body.feedback_text,
        ai.sentiment_score,
        body.created_at
      ).run();

      // bust cache
      await env.CACHE.delete("decay_scores:v1");
      await env.CACHE.delete("escalations:v1");

      return json({ ok: true, ai });
    }

    // API: Decay scores (cached)
    if (url.pathname === "/api/decay-scores") {
      const cached = await env.CACHE.get("decay_scores:v1");
      if (cached) return new Response(cached, { headers: { "content-type": "application/json" } });

      const scores = await calculateDecayScores(env.DB);
      const payload = JSON.stringify(scores);

      await env.CACHE.put("decay_scores:v1", payload, { expirationTtl: 300 }); // 5 min cache
      return new Response(payload, { headers: { "content-type": "application/json" } });
    }

    // API: User escalations (cached)
    if (url.pathname === "/api/escalations") {
      const cached = await env.CACHE.get("escalations:v1");
      if (cached) return new Response(cached, { headers: { "content-type": "application/json" } });

      const escalations = await getUserEscalations(env.DB);
      const payload = JSON.stringify(escalations);

      await env.CACHE.put("escalations:v1", payload, { expirationTtl: 300 });
      return new Response(payload, { headers: { "content-type": "application/json" } });
    }

    return new Response("Not Found", { status: 404 });
  }
};
