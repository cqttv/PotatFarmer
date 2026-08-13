export const CREATE_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS totals (
    id                   INTEGER PRIMARY KEY CHECK (id = 1),
    farm                 INTEGER NOT NULL DEFAULT 0,
    farmAttempts         INTEGER NOT NULL DEFAULT 0,
    farmSuccesses        INTEGER NOT NULL DEFAULT 0,
    steal                INTEGER NOT NULL DEFAULT 0,
    stealAttempts        INTEGER NOT NULL DEFAULT 0,
    stealSuccesses       INTEGER NOT NULL DEFAULT 0,
    gamble               INTEGER NOT NULL DEFAULT 0,
    gambleAttempts       INTEGER NOT NULL DEFAULT 0,
    gambleWins           INTEGER NOT NULL DEFAULT 0,
    rankups              INTEGER NOT NULL DEFAULT 0,
    prestiges            INTEGER NOT NULL DEFAULT 0,
    quizReward           INTEGER NOT NULL DEFAULT 0,
    quizAttempts         INTEGER NOT NULL DEFAULT 0,
    quizSuccesses        INTEGER NOT NULL DEFAULT 0,
    quizFailures         INTEGER NOT NULL DEFAULT 0,
    quizAnswerAttempts   INTEGER NOT NULL DEFAULT 0,
    quizIncorrectAnswers INTEGER NOT NULL DEFAULT 0,
    quizCacheHits        INTEGER NOT NULL DEFAULT 0,
    quizApiCalls         INTEGER NOT NULL DEFAULT 0
  );
  INSERT OR IGNORE INTO totals (id) VALUES (1);

  CREATE TABLE IF NOT EXISTS daily (
    date                 TEXT PRIMARY KEY,
    farm                 INTEGER NOT NULL DEFAULT 0,
    farmAttempts         INTEGER NOT NULL DEFAULT 0,
    farmSuccesses        INTEGER NOT NULL DEFAULT 0,
    steal                INTEGER NOT NULL DEFAULT 0,
    stealAttempts        INTEGER NOT NULL DEFAULT 0,
    stealSuccesses       INTEGER NOT NULL DEFAULT 0,
    gamble               INTEGER NOT NULL DEFAULT 0,
    gambleAttempts       INTEGER NOT NULL DEFAULT 0,
    gambleWins           INTEGER NOT NULL DEFAULT 0,
    rankups              INTEGER NOT NULL DEFAULT 0,
    prestiges            INTEGER NOT NULL DEFAULT 0,
    quizReward           INTEGER NOT NULL DEFAULT 0,
    quizAttempts         INTEGER NOT NULL DEFAULT 0,
    quizSuccesses        INTEGER NOT NULL DEFAULT 0,
    quizFailures         INTEGER NOT NULL DEFAULT 0,
    quizAnswerAttempts   INTEGER NOT NULL DEFAULT 0,
    quizIncorrectAnswers INTEGER NOT NULL DEFAULT 0,
    quizCacheHits        INTEGER NOT NULL DEFAULT 0,
    quizApiCalls         INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS events (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    executedAt   TEXT NOT NULL,
    command      TEXT NOT NULL,
    category     TEXT NOT NULL,
    delta        INTEGER NOT NULL,
    balanceAfter INTEGER NOT NULL,
    responseText TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_events_executedAt
    ON events (executedAt);
  CREATE INDEX IF NOT EXISTS idx_events_category_executedAt
    ON events (category, executedAt);

  CREATE TABLE IF NOT EXISTS quiz_answers (
    question   TEXT PRIMARY KEY,
    answer     TEXT NOT NULL,
    createdAt  TEXT NOT NULL,
    lastUsedAt TEXT NOT NULL,
    useCount   INTEGER NOT NULL DEFAULT 1
  );
`;
