import { AI_API_KEY, API_PROVIDER, type AIProvider } from "../config.js";
import { formatLogText, log } from "../logger.js";

interface ChatCompletionResponse {
  choices?: { message?: { content?: string | null } }[];
}

interface ProviderConfig {
  endpoint: string;
  model: string;
}

const PROVIDERS: Record<AIProvider, ProviderConfig> = {
  openai: {
    endpoint: "https://api.openai.com/v1/chat/completions",
    model: "gpt-5-nano",
  },
  gemini: {
    endpoint:
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    model: "gemini-3.1-flash-lite",
  },
  deepseek: {
    endpoint: "https://api.deepseek.com/chat/completions",
    model: "deepseek-chat",
  },
};

const SYSTEM_PROMPT =
  "Solve the math question. Return only the numeric answer, with no units, words, explanation, formatting, or punctuation other than a decimal point or leading minus sign.";

// eslint-disable-next-line security/detect-unsafe-regex
const NUMBER_ONLY = /^-?\d+(?:\.\d+)?$/;

function requestBody(question: string): Record<string, unknown> {
  // eslint-disable-next-line security/detect-object-injection
  const provider = PROVIDERS[API_PROVIDER];
  const body: Record<string, unknown> = {
    model: provider.model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: question },
    ],
  };

  if (API_PROVIDER === "openai") {
    body["service_tier"] = "flex";
    body["reasoning_effort"] = "minimal";
    body["store"] = false;
    body["max_completion_tokens"] = 100;
  } else {
    body["max_tokens"] = 100;
    body["stream"] = false;
  }

  return body;
}

export async function answerQuizQuestion(
  question: string,
  rejectedAnswers: readonly string[],
): Promise<string | null> {
  const exclusions =
    rejectedAnswers.length === 0
      ? ""
      : `\nThe following previous answers were rejected and must not be repeated: ${rejectedAnswers.join(", ")}.`;
  // eslint-disable-next-line security/detect-object-injection
  const provider = PROVIDERS[API_PROVIDER];
  const startedAt = Date.now();
  log.debug("Requesting quiz answer", {
    provider: API_PROVIDER,
    model: provider.model,
    question: formatLogText(question),
    rejectedAnswers,
  });

  try {
    const response = await fetch(provider.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify(requestBody(`${question}${exclusions}`)),
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      const body = await response.text();
      log.warn("Quiz answer request was rejected", {
        provider: API_PROVIDER,
        model: provider.model,
        status: response.status,
        durationMs: Date.now() - startedAt,
        response: formatLogText(body, 500),
      });
      return null;
    }

    const data = (await response.json()) as ChatCompletionResponse;
    const answer = data.choices?.[0]?.message?.content?.trim();
    if (!answer || !NUMBER_ONLY.test(answer)) {
      log.warn("Provider returned an invalid quiz answer", {
        provider: API_PROVIDER,
        model: provider.model,
        durationMs: Date.now() - startedAt,
        answer: formatLogText(answer ?? null),
      });
      return null;
    }
    log.info("Quiz answer received", {
      provider: API_PROVIDER,
      model: provider.model,
      durationMs: Date.now() - startedAt,
      answer,
    });
    return answer;
  } catch (err) {
    log.error("Quiz answer request failed", err, {
      provider: API_PROVIDER,
      model: provider.model,
      durationMs: Date.now() - startedAt,
    });
    return null;
  }
}
