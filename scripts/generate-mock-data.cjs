const themes = [
    "API rate limits too strict",
    "Documentation unclear",
    "Billing errors",
    "Slow dashboard loading",
    "Worker cold start times",
  ];
  
  const channels = ["Discord", "Email", "Twitter", "GitHub", "Support Ticket"];
  
  function randomDate(daysAgo) {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString();
  }
  
  function generateFeedback() {
    const feedback = [];
  
    // Background noise
    for (let i = 0; i < 200; i++) {
      feedback.push({
        user_id: `user_${Math.floor(Math.random() * 100)}`,
        channel: channels[Math.floor(Math.random() * channels.length)],
        issue_theme: themes[Math.floor(Math.random() * themes.length)],
        feedback_text: `Random feedback ${i}`,
        sentiment_score: -0.3 + Math.random() * 0.5,
        created_at: randomDate(Math.floor(Math.random() * 90)),
      });
    }
  
    // Decaying issue: API rate limits
    const rateUsers = ["user_42", "user_87", "user_133"];
  
    for (let i = 0; i < 5; i++) {
      feedback.push({
        user_id: rateUsers[i % 3],
        channel: "Discord",
        issue_theme: "API rate limits too strict",
        feedback_text: "Having trouble with rate limits",
        sentiment_score: -0.2 - i * 0.05,
        created_at: randomDate(68 - i),
      });
    }
  
    for (let i = 0; i < 8; i++) {
      feedback.push({
        user_id: rateUsers[i % 3],
        channel: i < 4 ? "Discord" : "Email",
        issue_theme: "API rate limits too strict",
        feedback_text: "Rate limits are blocking our production app",
        sentiment_score: -0.5 - i * 0.03,
        created_at: randomDate(40 - i * 2),
      });
    }
  
    for (let i = 0; i < 4; i++) {
      feedback.push({
        user_id: rateUsers[i % 3],
        channel: i < 2 ? "Email" : "Twitter",
        issue_theme: "API rate limits too strict",
        feedback_text: "URGENT: Rate limits are killing our business",
        sentiment_score: -0.85 - i * 0.03,
        created_at: randomDate(7 - i),
      });
    }
  
    // Billing escalation journey
    feedback.push({
      user_id: "user_847",
      channel: "Discord",
      issue_theme: "Billing errors",
      feedback_text: "Got charged twice this month",
      sentiment_score: -0.4,
      created_at: randomDate(45),
    });
    feedback.push({
      user_id: "user_847",
      channel: "Email",
      issue_theme: "Billing errors",
      feedback_text: "Still seeing billing issues, need help",
      sentiment_score: -0.6,
      created_at: randomDate(12),
    });
    feedback.push({
      user_id: "user_847",
      channel: "Twitter",
      issue_theme: "Billing errors",
      feedback_text: "@cloudflare billing is broken, been waiting weeks",
      sentiment_score: -0.9,
      created_at: randomDate(1),
    });
  
    // Stable docs issue
    for (let i = 0; i < 8; i++) {
      feedback.push({
        user_id: `user_${200 + i}`,
        channel: "GitHub",
        issue_theme: "Documentation unclear",
        feedback_text: "KV documentation could be clearer",
        sentiment_score: -0.4,
        created_at: randomDate(15 - i),
      });
    }
  
    return feedback;
  }
  
  console.log(JSON.stringify(generateFeedback(), null, 2));
  