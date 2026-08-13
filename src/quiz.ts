import {
  CommandError,
  fetchRank,
  sendCommand,
  type CommandResult,
} from "./api.js";
import { answerQuizQuestion } from "./ai.js";
import { BOT_PREFIX, COMMAND_DELAY } from "./config.js";
import {
  deleteQuizAnswer,
  getQuizAnswer,
  recordEvent,
  saveQuizAnswer,
} from "./db/index.js";
import { Actions } from "./plans.js";
import { formatLogText, log } from "./logger.js";
import { playerInfo, setLastCommand, updateFromRank } from "./stats/player.js";
import { recordQuizStats } from "./stats/recording.js";

const QUIZ_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const QUIZ_SUFFIX =
  /\s*\(You have five minutes to answer correctly, time starts now!\)\s*$/i;
const COOLDOWN =
  /✋⏰|next quiz is not available|quiz is not available|cooldown/i;
const INCORRECT = /incorrect answer/i;
const TERMINAL_FAILURE = /expired|failed to answer|five attempts/i;
const NO_RESULT = /didn'?t return any result/i;
let quizSequence = 0;

export type QuizResult = "completed" | "unavailable" | "failed";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeQuestion(question: string): string {
  return question.trim().replace(/\s+/g, " ").toLowerCase();
}

function failQuiz(): QuizResult {
  recordEvent({
    executedAt: new Date().toISOString(),
    command: Actions.QUIZ,
    category: "quiz_failure",
    delta: 0,
    balanceAfter: playerInfo.potatoes,
    responseText: "Quiz attempt failed",
  });
  recordQuizStats({ quizFailures: 1 });
  return "failed";
}

function isCooldown(error: unknown): boolean {
  return error instanceof Error && COOLDOWN.test(error.message);
}

async function confirmQuizCompleted(quizId: string): Promise<boolean> {
  // #a and #quiz share a five-second command cooldown.
  await sleep(Math.max(5_500, COMMAND_DELAY));
  try {
    const result = await sendCommand(Actions.QUIZ);
    const completed = result.text !== null && COOLDOWN.test(result.text);
    log.info("Quiz completion check finished", {
      quizId,
      completed,
      response: formatLogText(result.text),
    });
    return completed;
  } catch (err) {
    const completed = isCooldown(err);
    log.info("Quiz completion check returned an error", {
      quizId,
      completed,
      error: err instanceof Error ? err.message : String(err),
    });
    return completed;
  }
}

async function recordSuccess(
  questionKey: string,
  answer: string,
  balanceBefore: number,
  quizId: string,
): Promise<void> {
  const rank = await fetchRank();
  if (rank) updateFromRank(rank);
  const reward = Math.max(0, playerInfo.potatoes - balanceBefore);
  recordEvent({
    executedAt: new Date().toISOString(),
    command: `${Actions.ANSWER} ${answer}`,
    category: "quiz",
    delta: reward,
    balanceAfter: playerInfo.potatoes,
    responseText: `Correct quiz answer: ${answer}`,
  });
  saveQuizAnswer(questionKey, answer);
  recordQuizStats({ quizSuccesses: 1, quizReward: reward });
  log.info("Quiz completed successfully", {
    quizId,
    answer,
    reward,
    balanceBefore,
    balanceAfter: playerInfo.potatoes,
  });
}

export async function runQuizPlan(): Promise<QuizResult> {
  const quizId = `${Date.now().toString(36)}-${++quizSequence}`;
  const startedAt = Date.now();
  log.info("Starting quiz", { quizId });
  let started: CommandResult;
  try {
    started = await sendCommand(Actions.QUIZ);
  } catch (err) {
    if (isCooldown(err)) {
      log.info("Quiz is on cooldown", { quizId });
      return "unavailable";
    }
    log.error("Unable to start quiz", err, { quizId });
    return "failed";
  }

  if (started.text === null || COOLDOWN.test(started.text)) {
    log.info("Quiz is unavailable", {
      quizId,
      response: formatLogText(started.text),
    });
    return "unavailable";
  }

  const question = started.text.replace(QUIZ_SUFFIX, "").trim();
  if (question === started.text.trim()) {
    log.warn("Unable to parse quiz question", {
      quizId,
      response: formatLogText(started.text, 500),
    });
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
  log.info("Quiz question parsed", {
    quizId,
    question: formatLogText(question, 500),
    questionKey,
    cacheHit: cachedAnswer !== null,
    balanceBefore,
    timeoutMs: QUIZ_TIMEOUT_MS,
  });

  // #quiz and its #a alias share the same five-second command cooldown.
  await sleep(Math.max(5_500, COMMAND_DELAY));

  while (answerAttempts < MAX_ATTEMPTS) {
    if (Date.now() >= deadline) {
      log.warn("Quiz deadline reached before selecting an answer", {
        quizId,
        answerAttempts,
        durationMs: Date.now() - startedAt,
      });
      return failQuiz();
    }

    const fromCache = answerAttempts === 0 && cachedAnswer !== null;
    let answer: string | null;
    if (fromCache) {
      answer = cachedAnswer;
      recordQuizStats({ quizCacheHits: 1 });
      log.info("Using cached quiz answer", { quizId, answer });
    } else {
      recordQuizStats({ quizApiCalls: 1 });
      log.debug("Requesting answer from AI", {
        quizId,
        rejectedAnswers,
        answerAttempts,
      });
      answer = await answerQuizQuestion(question, rejectedAnswers);
    }
    if (answer === null || rejectedAnswers.includes(answer)) {
      log.warn("No usable quiz answer was produced", {
        quizId,
        answer,
        alreadyRejected: answer !== null && rejectedAnswers.includes(answer),
        rejectedAnswers,
      });
      await sleep(1_000);
      continue;
    }
    if (Date.now() >= deadline) {
      log.warn("Quiz deadline reached before submitting answer", {
        quizId,
        answer,
        durationMs: Date.now() - startedAt,
      });
      return failQuiz();
    }

    setLastCommand(`${BOT_PREFIX}${Actions.ANSWER} ${answer}`);
    answerAttempts += 1;
    recordQuizStats({ quizAnswerAttempts: 1 });
    log.info("Submitting quiz answer", {
      quizId,
      answer,
      attempt: answerAttempts,
      source: fromCache ? "cache" : "ai",
      remainingMs: deadline - Date.now(),
    });

    try {
      const result = await sendCommand(`${Actions.ANSWER} ${answer}`);
      if (result.text && /that'?s right|congratulations/i.test(result.text)) {
        await recordSuccess(questionKey, answer, balanceBefore, quizId);
        return "completed";
      }

      // PotatBotat sends a correct-answer message directly to Twitch and then
      // may return no result to the REST caller. Verify the quiz is closed
      // before treating that ambiguous response as another answer attempt.
      if (result.text === null && (await confirmQuizCompleted(quizId))) {
        await recordSuccess(questionKey, answer, balanceBefore, quizId);
        return "completed";
      }

      if (result.text && INCORRECT.test(result.text)) {
        recordQuizStats({ quizIncorrectAnswers: 1 });
        rejectedAnswers.push(answer);
        if (fromCache) deleteQuizAnswer(questionKey, answer);
        log.warn("Quiz answer was incorrect", {
          quizId,
          answer,
          attempt: answerAttempts,
          source: fromCache ? "cache" : "ai",
          cacheEntryDeleted: fromCache,
          rejectedAnswers,
        });
        await sleep(Math.max(5_500, COMMAND_DELAY));
        continue;
      }

      if (result.text && TERMINAL_FAILURE.test(result.text)) {
        log.warn("Quiz ended with a terminal failure", {
          quizId,
          answer,
          attempt: answerAttempts,
          error: result.text,
        });
        return failQuiz();
      }

      if (result.text && COOLDOWN.test(result.text)) {
        // A command cooldown does not consume one of PotatBotat's five quiz
        // attempts, so do not let it exhaust the local attempt budget either.
        answerAttempts -= 1;
        recordQuizStats({ quizAnswerAttempts: -1 });
        log.info("Quiz answer command is on cooldown; retrying", {
          quizId,
          answer,
          remainingMs: deadline - Date.now(),
        });
        await sleep(Math.max(5_500, COMMAND_DELAY));
        continue;
      }

      log.warn("Quiz answer returned an unrecognized response", {
        quizId,
        answer,
        attempt: answerAttempts,
        response: formatLogText(result.text, 500),
        isError: result.isError,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (
        err instanceof CommandError &&
        err.status === 404 &&
        NO_RESULT.test(message) &&
        (await confirmQuizCompleted(quizId))
      ) {
        await recordSuccess(questionKey, answer, balanceBefore, quizId);
        return "completed";
      }
      if (INCORRECT.test(message)) {
        recordQuizStats({ quizIncorrectAnswers: 1 });
        rejectedAnswers.push(answer);
        if (fromCache) deleteQuizAnswer(questionKey, answer);
        log.warn("Quiz answer was incorrect", {
          quizId,
          answer,
          attempt: answerAttempts,
          source: fromCache ? "cache" : "ai",
          cacheEntryDeleted: fromCache,
          rejectedAnswers,
        });
        await sleep(Math.max(5_500, COMMAND_DELAY));
        continue;
      }
      if (TERMINAL_FAILURE.test(message)) {
        log.warn("Quiz ended with a terminal failure", {
          quizId,
          answer,
          attempt: answerAttempts,
          error: message,
        });
        return failQuiz();
      }
      log.error("Quiz answer submission failed", err, {
        quizId,
        answer,
        attempt: answerAttempts,
      });
      return failQuiz();
    }
  }

  log.warn("Quiz exhausted all answer attempts", {
    quizId,
    answerAttempts,
    rejectedAnswers,
    durationMs: Date.now() - startedAt,
  });
  return failQuiz();
}
