import { AI_API_KEY, API_PROVIDER, type AIProvider } from "./config.js";

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
      process.stderr.write(
        `${API_PROVIDER} request failed (${response.status}): ${body.slice(0, 500)}\n`,
      );
      return null;
    }

    const data = (await response.json()) as ChatCompletionResponse;
    const answer = data.choices?.[0]?.message?.content?.trim();
    if (!answer || !NUMBER_ONLY.test(answer)) {
      process.stderr.write(
        `${API_PROVIDER} returned an invalid quiz answer: ${JSON.stringify(answer)}\n`,
      );
      return null;
    }
    return answer;
  } catch (err) {
    process.stderr.write(`${API_PROVIDER} quiz request: ${String(err)}\n`);
    return null;
  }
}
