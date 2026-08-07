import {
  CommandError,
  fetchRank,
  sendCommand,
  type CommandResult,
} from "./api.js";
import { answerQuizQuestion } from "./ai.js";
import { BOT_PREFIX, COMMAND_DELAY } from "./config.js";
import { deleteQuizAnswer, getQuizAnswer, saveQuizAnswer } from "./db.js";
import { Actions } from "./plans.js";
import {
  playerInfo,
  recordQuizStats,
  setLastCommand,
  updateFromRank,
} from "./stats.js";

const QUIZ_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const QUIZ_SUFFIX =
  /\s*\(You have five minutes to answer correctly, time starts now!\)\s*$/i;
const COOLDOWN =
  /✋⏰|next quiz is not available|quiz is not available|cooldown/i;
const INCORRECT = /incorrect answer/i;
const TERMINAL_FAILURE = /expired|failed to answer|five attempts/i;
const NO_RESULT = /didn'?t return any result/i;

export type QuizResult = "completed" | "unavailable" | "failed";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeQuestion(question: string): string {
  return question.trim().replace(/\s+/g, " ").toLowerCase();
}

function isCooldown(error: unknown): boolean {
  return error instanceof Error && COOLDOWN.test(error.message);
}

async function confirmQuizCompleted(): Promise<boolean> {
  // #a and #quiz share a five-second command cooldown.
  await sleep(Math.max(5_500, COMMAND_DELAY));
  try {
    const result = await sendCommand(Actions.QUIZ);
    return result.text !== null && COOLDOWN.test(result.text);
  } catch (err) {
    return isCooldown(err);
  }
}

async function recordSuccess(
  questionKey: string,
  answer: string,
  balanceBefore: number,
): Promise<void> {
  const rank = await fetchRank();
  if (rank) updateFromRank(rank);
  const reward = Math.max(0, playerInfo.potatoes - balanceBefore);
  saveQuizAnswer(questionKey, answer);
  recordQuizStats({ quizSuccesses: 1, quizReward: reward });
}

export async function runQuizPlan(): Promise<QuizResult> {
  let started: CommandResult;
  try {
    started = await sendCommand(Actions.QUIZ);
  } catch (err) {
    if (isCooldown(err)) return "unavailable";
    process.stderr.write(`quiz start: ${String(err)}\n`);
    return "failed";
  }

  if (started.text === null || COOLDOWN.test(started.text))
    return "unavailable";

  const question = started.text.replace(QUIZ_SUFFIX, "").trim();
  if (question === started.text.trim()) {
    process.stderr.write(`Unable to parse quiz question: ${started.text}\n`);
    return "failed";
  }

  setLastCommand(`${BOT_PREFIX}${Actions.QUIZ}`);
  recordQuizStats({ quizAttempts: 1 });

  const deadline = Date.now() + QUIZ_TIMEOUT_MS;
  const questionKey = normalizeQuestion(question);
  const cachedAnswer = getQuizAnswer(questionKey);
  const rejectedAnswers: string[] = [];
  const balanceBefore = playerInfo.potatoes;
  let answerAttempts = 0;

  while (answerAttempts < MAX_ATTEMPTS) {
    if (Date.now() >= deadline) return "failed";

    const fromCache = answerAttempts === 0 && cachedAnswer !== null;
    let answer: string | null;
    if (fromCache) {
      answer = cachedAnswer;
      recordQuizStats({ quizCacheHits: 1 });
    } else {
      recordQuizStats({ quizApiCalls: 1 });
      answer = await answerQuizQuestion(question, rejectedAnswers);
    }
    if (answer === null || rejectedAnswers.includes(answer)) {
      await sleep(1_000);
      continue;
    }
    if (Date.now() >= deadline) return "failed";

    setLastCommand(`${BOT_PREFIX}${Actions.ANSWER} ${answer}`);
    answerAttempts += 1;
    recordQuizStats({ quizAnswerAttempts: 1 });

    try {
      const result = await sendCommand(`${Actions.ANSWER} ${answer}`);
      if (result.text && /that'?s right|congratulations/i.test(result.text)) {
        await recordSuccess(questionKey, answer, balanceBefore);
        return "completed";
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (
        err instanceof CommandError &&
        err.status === 404 &&
        NO_RESULT.test(message) &&
        (await confirmQuizCompleted())
      ) {
        await recordSuccess(questionKey, answer, balanceBefore);
        return "completed";
      }
      if (INCORRECT.test(message)) {
        rejectedAnswers.push(answer);
        if (fromCache) deleteQuizAnswer(questionKey, answer);
        await sleep(Math.max(5_500, COMMAND_DELAY));
        continue;
      }
      if (TERMINAL_FAILURE.test(message)) return "failed";
      process.stderr.write(`quiz answer: ${String(err)}\n`);
      return "failed";
    }
  }

  return "failed";
}
