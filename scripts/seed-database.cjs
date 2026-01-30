const fs = require("fs");
const path = require("path");

// #region agent log
const logDir = path.join(__dirname, "..", ".cursor");
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}
const logPath = path.join(logDir, "debug.log");
const logEntry = {
  sessionId: "debug-session",
  runId: "run1",
  hypothesisId: "A",
  location: "seed-database.cjs:2",
  message: "File path resolution",
  data: {
    cwd: process.cwd(),
    scriptDir: __dirname,
    relativePath: "./mock-data.json",
    resolvedPath: path.resolve("./mock-data.json"),
    resolvedFromScriptDir: path.resolve(__dirname, "..", "mock-data.json"),
    fileExists: fs.existsSync("./mock-data.json"),
    fileExistsFromScriptDir: fs.existsSync(path.resolve(__dirname, "..", "mock-data.json"))
  },
  timestamp: Date.now()
};
try {
  fs.appendFileSync(logPath, JSON.stringify(logEntry) + "\n");
} catch (e) {
  // Fallback to console if log write fails
  console.error("Log write failed:", e);
}
// #endregion

// #region agent log
let fileContent;
const mockDataPath = path.resolve(__dirname, "..", "mock-data.json");
try {
  fileContent = fs.readFileSync(mockDataPath, "utf-8");
  const logEntry2 = {
    sessionId: "debug-session",
    runId: "run1",
    hypothesisId: "B",
    location: "seed-database.cjs:2",
    message: "File content before parse",
    data: {
      fileLength: fileContent.length,
      firstChars: fileContent.substring(0, 50),
      hasBOM: fileContent.charCodeAt(0) === 0xFEFF,
      firstCharCode: fileContent.charCodeAt(0)
    },
    timestamp: Date.now()
  };
  try {
    fs.appendFileSync(logPath, JSON.stringify(logEntry2) + "\n");
  } catch (e) {
    console.error("Log write failed:", e);
  }
} catch (readError) {
  const logEntryError = {
    sessionId: "debug-session",
    runId: "run1",
    hypothesisId: "B",
    location: "seed-database.cjs:2",
    message: "File read error",
    data: {
      errorMessage: readError.message,
      errorStack: readError.stack,
      errorName: readError.name
    },
    timestamp: Date.now()
  };
  try {
    fs.appendFileSync(logPath, JSON.stringify(logEntryError) + "\n");
  } catch (e) {
    console.error("Log write failed:", e);
  }
  throw readError;
}
// #endregion

// #region agent log
let data;
try {
  data = JSON.parse(fileContent);
  const logEntry3 = {
    sessionId: "debug-session",
    runId: "run1",
    hypothesisId: "C",
    location: "seed-database.cjs:2",
    message: "JSON parse success",
    data: {
      isArray: Array.isArray(data),
      length: data.length
    },
    timestamp: Date.now()
  };
  try {
    fs.appendFileSync(logPath, JSON.stringify(logEntry3) + "\n");
  } catch (e) {
    console.error("Log write failed:", e);
  }
} catch (error) {
  const logEntry4 = {
    sessionId: "debug-session",
    runId: "run1",
    hypothesisId: "D",
    location: "seed-database.cjs:2",
    message: "JSON parse error",
    data: {
      errorMessage: error.message,
      errorStack: error.stack,
      errorName: error.name
    },
    timestamp: Date.now()
  };
  try {
    fs.appendFileSync(logPath, JSON.stringify(logEntry4) + "\n");
  } catch (e) {
    console.error("Log write failed:", e);
  }
  throw error;
}
// #endregion

function esc(s) {
  return String(s).replaceAll("'", "''");
}

const sql = data.map(item => `
INSERT INTO feedback (user_id, channel, issue_theme, feedback_text, sentiment_score, created_at)
VALUES ('${esc(item.user_id)}','${esc(item.channel)}','${esc(item.issue_theme)}','${esc(item.feedback_text)}',${item.sentiment_score},'${esc(item.created_at)}');
`).join("\n");

console.log(sql);
