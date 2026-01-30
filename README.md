# ⚡ Feedback Decay Tracker

A time-based feedback analysis tool that identifies which customer issues are escalating and will cause churn if left unresolved. 

**Live Demo:** https://feedback-decay-tracker.ayushibose12.workers.dev/

## The Problem

Product teams receive scattered feedback from Discord, Twitter, support tickets, email, and GitHub. Most tools just aggregate this data, but they miss the critical question: **Which issues are getting worse over time?**

## The Solution

Feedback Decay Tracker calculates a "decay score" (0-100) for each issue by analyzing:
- **Age**: How long has this been unresolved?
- **Volume Trend**: Is it increasing? (Recent 14 days vs. previous 14 days)
- **Sentiment Decline**: Are users getting angrier?
- **Channel Escalation**: Are users going public (Discord → Email → Twitter)?

Issues with scores **70+** are flagged as critical and require immediate attention to prevent customer churn.

## Architecture

### Cloudflare Products Used

| Product | Purpose |
|---------|---------|
| **Workers** | Edge compute runtime hosting both API and frontend dashboard |
| **D1 Database** | SQL storage for temporal feedback analysis with complex queries (GROUP BY, date filtering) |
| **Workers AI** | Binding ready for future sentiment analysis (currently using mock scores) |
| **KV** | Caching layer for expensive decay score calculations |

### Why These Products?

- **D1**: Enables temporal queries like "compare feedback volume from last 14 days vs. previous 14 days" using SQL date functions
- **Workers**: Single deployment for both API (`/api/*`) and dashboard (`/`) with global edge distribution
- **KV**: Reduces repeated calculations—decay scores are cached for 5 minutes
- **Workers AI**: Future enhancement to replace mock sentiment scores with real-time analysis

## Decay Score Algorithm

```javascript
decay_score = (
  age_in_days / 60 * 30% +          // Issues that linger score higher
  volume_increase / 200 * 40% +      // Growing problems get priority
  sentiment_decline / 0.5 * 20% +    // Anger escalation matters
  (cross_channel >= 3 ? 10% : 0)    // Public complaints = urgent
)
```

**Example:**
- Issue: "API rate limits too strict"
- Age: 68 days → **30 points**
- Volume: 5 complaints → 12 complaints = 140% increase → **28 points**
- Sentiment: -0.2 → -0.95 = 0.75 decline → **20 points**
- Channels: Discord, Email, Support Ticket, Twitter (4 channels) → **10 points**
- **Total Decay Score: 88 (CRITICAL)** 

## Quick Start

### Prerequisites
- Node.js 18+
- Cloudflare account
- Wrangler CLI: `npm install -g wrangler`

### Installation

```bash
# Clone the repository
git clone https://github.com/[YOUR_USERNAME]/feedback-decay-tracker.git
cd feedback-decay-tracker

# Install dependencies
npm install

# Login to Cloudflare
npx wrangler login

# Create D1 database
npx wrangler d1 create feedback-db
# Copy the database_id to wrangler.toml

# Create KV namespace
npx wrangler kv:namespace create "CACHE"
# Copy the id to wrangler.toml
```

### Setup Database

```bash
# Apply schema
npx wrangler d1 execute feedback-db --local --file=./schema.sql
npx wrangler d1 execute feedback-db --remote --file=./schema.sql

# Seed with mock data
npx wrangler d1 execute feedback-db --local --file=./critical-feedback-fixed.sql
npx wrangler d1 execute feedback-db --remote --file=./critical-feedback-fixed.sql
```

### Run Locally

```bash
npx wrangler dev
# Visit http://localhost:8787
```

### Deploy

```bash
npx wrangler deploy
# Your app will be live at https://feedback-decay-tracker.YOUR_ACCOUNT.workers.dev
```

## API Endpoints

### GET /api/decay-scores
Returns all issues sorted by decay score (highest first).

**Response:**
```json
[
  {
    "issue_theme": "API rate limits too strict",
    "decayScore": 88,
    "metrics": {
      "ageInDays": 68,
      "totalCount": 24,
      "recentCount": 12,
      "previousCount": 5,
      "volumeIncrease": 140,
      "sentimentDecline": "0.75",
      "uniqueChannels": 4,
      "repeatComplainers": 3,
      "firstComplaint": "2024-11-23",
      "lastComplaint": "2025-01-29"
    }
  }
]
```

### GET /api/escalations
Returns users who escalated across multiple channels.

**Response:**
```json
[
  {
    "user_id": "user_847",
    "issue_theme": "Billing errors",
    "channels": "Discord,Email,Twitter",
    "complaint_count": 7,
    "first_complaint": "2024-12-16",
    "last_complaint": "2025-01-29",
    "avg_sentiment": -0.68
  }
]
```

## Tech Stack

- **Runtime**: Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite)
- **Cache**: Cloudflare KV
- **AI**: Cloudflare Workers AI (binding ready)
- **Frontend**: Vanilla JavaScript + HTML/CSS (no frameworks)
- **Deployment**: Wrangler CLI

## Project Structure

```
feedback-decay-tracker/
├── src/
│   ├── index.js              # Main Worker + Dashboard HTML
│   └── decay-calculator.js   # Core algorithm logic
├── schema.sql                # D1 database schema
├── critical-feedback.sql # Mock data with decay patterns
├── wrangler.toml             # Cloudflare configuration
└── package.json              # Dependencies
```

## Key Differentiators

1. **Time-Based Intelligence**: Most feedback tools are snapshots. This tracks *change over time*.
2. **Actionable Prioritization**: Tells PMs exactly which fires to fight first.
3. **Escalation Detection**: Identifies users moving from private channels to public complaints.
4. **Real Product Thinking**: Demonstrates understanding of urgency vs. importance and churn prevention.

## Built With

- Claude
- Cloudflare Developer Platform
- Designed for the Cloudflare PM Internship Assignment (2026)

---

**Author**: Ayushi Bose  
