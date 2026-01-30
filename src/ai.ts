export async function analyzeWithAI(env: any, text: string) {
    const prompt = `
  Return JSON only:
  {
    "issue_theme": "short label (max 8 words)",
    "sentiment_score": number between -1 and 1
  }
  Text: ${text}
  `.trim();
  
    const resp = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
      messages: [
        { role: "system", content: "You output strict JSON only." },
        { role: "user", content: prompt }
      ]
    });
  
    const raw = (resp as any).response ?? resp;
    return {
      issue_theme: raw.issue_theme ?? "Uncategorized",
      sentiment_score: typeof raw.sentiment_score === "number" ? raw.sentiment_score : -0.3
    };
  }
  