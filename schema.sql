DROP TABLE IF EXISTS feedback;

CREATE TABLE feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  issue_theme TEXT NOT NULL,
  feedback_text TEXT NOT NULL,
  sentiment_score REAL NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_theme ON feedback(issue_theme);
CREATE INDEX idx_user ON feedback(user_id);
CREATE INDEX idx_created ON feedback(created_at);
