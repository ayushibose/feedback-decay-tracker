type Row = {
    user_id: string;
    channel: string;
    issue_theme: string;
    feedback_text: string;
    sentiment_score: number;
    created_at: string;
  };
  
  const MS_DAY = 1000 * 60 * 60 * 24;
  
  function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n));
  }
  
  export async function calculateDecayScores(db: D1Database) {
    const themes = await db.prepare(`SELECT DISTINCT issue_theme FROM feedback`).all();
    const out: any[] = [];
  
    for (const t of themes.results as any[]) {
      const theme = t.issue_theme as string;
  
      const feedbackItems = await db.prepare(`
        SELECT user_id, channel, issue_theme, feedback_text, sentiment_score, created_at
        FROM feedback
        WHERE issue_theme = ?
        ORDER BY created_at ASC
      `).bind(theme).all();
  
      const items = feedbackItems.results as unknown as Row[];
      if (!items.length) continue;
  
      const now = new Date();
      const first = new Date(items[0].created_at);
      const last = new Date(items[items.length - 1].created_at);
  
      const ageDays = (now.getTime() - first.getTime()) / MS_DAY;
  
      // recent window = last 14 days
      const recent = items.filter(i => (now.getTime() - new Date(i.created_at).getTime()) / MS_DAY <= 14).length;
  
      // baseline window = days 15–60 ago (gives you a trend baseline)
      const baseline = items.filter(i => {
        const daysAgo = (now.getTime() - new Date(i.created_at).getTime()) / MS_DAY;
        return daysAgo > 14 && daysAgo <= 60;
      }).length;
  
      // normalize growth 0..1 (no negative penalty)
      const growth = baseline > 0 ? (recent - (baseline / 3)) / (baseline / 3) : (recent > 0 ? 1 : 0);
      const growthNorm = clamp(growth / 5, 0, 1); // cap extreme spikes
  
      // sentiment trajectory: only count worsening (more negative over time)
      const mid = Math.floor(items.length / 2);
      const firstHalf = items.slice(0, Math.max(1, mid));
      const secondHalf = items.slice(Math.max(1, mid));
  
      const avg1 = firstHalf.reduce((s, i) => s + i.sentiment_score, 0) / firstHalf.length;
      const avg2 = secondHalf.reduce((s, i) => s + i.sentiment_score, 0) / secondHalf.length;
  
      const worsening = clamp(avg1 - avg2, 0, 1); // e.g., -0.2 -> -0.8 = 0.6
      const sentimentNorm = worsening; // already 0..1
  
      const uniqueChannels = new Set(items.map(i => i.channel)).size;
  
      const userCounts = new Map<string, number>();
      items.forEach(i => userCounts.set(i.user_id, (userCounts.get(i.user_id) ?? 0) + 1));
      const repeatUsers = [...userCounts.values()].filter(c => c >= 2).length;
  
      // decay score 0..100 (explainable)
      const ageNorm = clamp(Math.min(ageDays, 90) / 90, 0, 1);
  
      const decayScore = Math.round(
        ageNorm * 30 +          // 30%
        growthNorm * 40 +       // 40%
        sentimentNorm * 20 +    // 20%
        (uniqueChannels >= 3 ? 10 : 0) // 10%
      );
  
      const avgSentiment = items.reduce((s, i) => s + i.sentiment_score, 0) / items.length;
  
      out.push({
        issue_theme: theme,
        decayScore: clamp(decayScore, 0, 100),
        metrics: {
          ageInDays: Math.round(ageDays),
          totalCount: items.length,
          recentCount: recent,
          volumeGrowthNorm: Number(growthNorm.toFixed(2)),
          sentimentWorsening: Number(sentimentNorm.toFixed(2)),
          uniqueChannels,
          repeatComplainers: repeatUsers,
          firstComplaint: items[0].created_at.slice(0, 10),
          lastComplaint: items[items.length - 1].created_at.slice(0, 10),
          avgSentiment: Number(avgSentiment.toFixed(2)),
        },
      });
    }
  
    return out.sort((a, b) => b.decayScore - a.decayScore);
  }
  
  export async function getUserEscalations(db: D1Database) {
    const result = await db.prepare(`
      SELECT
        user_id,
        issue_theme,
        GROUP_CONCAT(DISTINCT channel) AS channels,
        COUNT(*) AS complaint_count,
        MIN(created_at) AS first_complaint,
        MAX(created_at) AS last_complaint,
        AVG(sentiment_score) AS avg_sentiment
      FROM feedback
      GROUP BY user_id, issue_theme
      HAVING COUNT(DISTINCT channel) >= 2
      ORDER BY last_complaint DESC
      LIMIT 10
    `).all();
  
    return result.results ?? [];
  }
  