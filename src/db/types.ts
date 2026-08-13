export interface StatsRow {
  farm: number;
  farmAttempts: number;
  farmSuccesses: number;
  steal: number;
  stealAttempts: number;
  stealSuccesses: number;
  rankups: number;
  prestiges: number;
  quizReward: number;
  quizAttempts: number;
  quizSuccesses: number;
  quizFailures: number;
  quizAnswerAttempts: number;
  quizIncorrectAnswers: number;
  quizCacheHits: number;
  quizApiCalls: number;
}

export interface EventSummary {
  id: number;
  executedAt: string;
  command: string;
  category: string;
  delta: number;
  balanceAfter: number;
}

export interface Event extends EventSummary {
  responseText: string;
}

export interface NewEvent {
  executedAt: string;
  command: string;
  category: string;
  delta: number;
  balanceAfter: number;
  responseText: string;
}
