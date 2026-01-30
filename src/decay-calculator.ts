export async function calculateDecayScores(db) {
    // Get all themes with their feedback
    const themes = await db.prepare(`
      SELECT DISTINCT issue_theme FROM feedback
    `).all();
    
    const decayScores = [];
    
    for (const { issue_theme } of themes.results) {
      // Get all feedback for this theme
      const feedbackItems = await db.prepare(`
        SELECT * FROM feedback 
        WHERE issue_theme = ? 
        ORDER BY created_at ASC
      `).bind(issue_theme).all();
      
      if (feedbackItems.results.length === 0) continue;
      
      const items = feedbackItems.results;
      const now = new Date();
      const firstComplaint = new Date(items[0].created_at);
      const lastComplaint = new Date(items[items.length - 1].created_at);
      
      // Calculate age in days
      const ageInDays = (now - firstComplaint) / (1000 * 60 * 60 * 24);
      
      // Calculate volume increase (recent 14 days vs previous 14 days)
      const recent14Days = items.filter(i => {
        const itemDate = new Date(i.created_at);
        const daysAgo = (now - itemDate) / (1000 * 60 * 60 * 24);
        return daysAgo <= 14;
      }).length;
      
      const previous14Days = items.filter(i => {
        const itemDate = new Date(i.created_at);
        const daysAgo = (now - itemDate) / (1000 * 60 * 60 * 24);
        return daysAgo > 14 && daysAgo <= 28;
      }).length;
      
      // Calculate percentage increase (handle division by zero)
      let volumeIncrease = 0;
      if (previous14Days > 0) {
        volumeIncrease = ((recent14Days - previous14Days) / previous14Days) * 100;
      } else if (recent14Days > 0) {
        volumeIncrease = 100; // If we have recent complaints but no previous ones, that's a 100% increase
      }
      
      // Sentiment decline (compare first third vs last third for better detection)
      const thirdLength = Math.floor(items.length / 3);
      const firstThird = items.slice(0, thirdLength);
      const lastThird = items.slice(-thirdLength);
      
      const avgSentimentFirst = firstThird.reduce((sum, i) => sum + (i.sentiment_score || 0), 0) / firstThird.length;
      const avgSentimentLast = lastThird.reduce((sum, i) => sum + (i.sentiment_score || 0), 0) / lastThird.length;
      
      // Calculate absolute decline (negative sentiment getting more negative = decline)
      const sentimentDecline = Math.abs(avgSentimentLast - avgSentimentFirst);
      
      // Cross-channel count
      const uniqueChannels = new Set(items.map(i => i.channel)).size;
      
      // Repeat complainers
      const userCounts = {};
      items.forEach(i => {
        userCounts[i.user_id] = (userCounts[i.user_id] || 0) + 1;
      });
      const repeatComplainers = Object.values(userCounts).filter(count => count >= 2).length;
      
      // IMPROVED DECAY SCORE CALCULATION (0-100)
      // More aggressive scoring to properly identify critical issues
      
      // Age component (0-30 points): Issues that have been around longer score higher
      const ageScore = Math.min((ageInDays / 60) * 30, 30); // 60+ days = full 30 points
      
      // Volume increase component (0-40 points): Growing complaints score much higher
      const volumeScore = Math.min((volumeIncrease / 200) * 40, 40); // 200%+ increase = full 40 points
      
      // Sentiment decline component (0-20 points): Getting angrier = higher score
      const sentimentScore = Math.min((sentimentDecline / 0.5) * 20, 20); // 0.5+ decline = full 20 points
      
      // Cross-channel component (0-10 points): Public escalation
      const channelScore = uniqueChannels >= 3 ? 10 : uniqueChannels >= 2 ? 5 : 0;
      
      // Calculate final decay score
      const decayScore = Math.min(100, Math.round(
        ageScore + volumeScore + sentimentScore + channelScore
      ));
      
      decayScores.push({
        issue_theme,
        decayScore,
        metrics: {
          ageInDays: Math.round(ageInDays),
          totalCount: items.length,
          recentCount: recent14Days,
          previousCount: previous14Days,
          volumeIncrease: Math.round(volumeIncrease),
          sentimentDecline: sentimentDecline.toFixed(2),
          avgSentimentFirst: avgSentimentFirst.toFixed(2),
          avgSentimentLast: avgSentimentLast.toFixed(2),
          uniqueChannels,
          repeatComplainers,
          firstComplaint: firstComplaint.toISOString().split('T')[0],
          lastComplaint: lastComplaint.toISOString().split('T')[0],
          avgSentiment: (items.reduce((sum, i) => sum + (i.sentiment_score || 0), 0) / items.length).toFixed(2),
          // Score breakdown for debugging
          scoreBreakdown: {
            age: Math.round(ageScore),
            volume: Math.round(volumeScore),
            sentiment: Math.round(sentimentScore),
            channels: channelScore
          }
        }
      });
    }
    
    // Sort by decay score descending
    return decayScores.sort((a, b) => b.decayScore - a.decayScore);
  }
  
  export async function getUserEscalations(db) {
    // Find users who've escalated across channels
    const result = await db.prepare(`
      SELECT 
        user_id,
        issue_theme,
        GROUP_CONCAT(DISTINCT channel) as channels,
        COUNT(*) as complaint_count,
        MIN(created_at) as first_complaint,
        MAX(created_at) as last_complaint,
        AVG(sentiment_score) as avg_sentiment
      FROM feedback
      GROUP BY user_id, issue_theme
      HAVING COUNT(DISTINCT channel) >= 2
      ORDER BY last_complaint DESC
      LIMIT 10
    `).all();
    
    return result.results;
  }