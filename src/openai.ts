import { OPENAI_API_KEY } from "./config.js";

interface ChatCompletionResponse {
  choices?: { message?: { content?: string | null } }[];
}

const NUMBER_ONLY = /^-?\d+(?:\.\d+)?$/;

export async function answerQuizQuestion(
  question: string,
  rejectedAnswers: readonly string[],
): Promise<string | null> {
  const exclusions =
    rejectedAnswers.length === 0
      ? ""
      : `\nThe following previous answers were rejected and must not be repeated: ${rejectedAnswers.join(", ")}.`;

  try {
    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-5-nano",
          service_tier: "flex",
          messages: [
            {
              role: "system",
              content:
                "Solve the math question. Return only the numeric answer, with no units, words, explanation, formatting, or punctuation other than a decimal point or leading minus sign.",
            },
            { role: "user", content: `${question}${exclusions}` },
          ],
          reasoning_effort: "minimal",
          store: false,
          max_completion_tokens: 100,
        }),
        signal: AbortSignal.timeout(60_000),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      process.stderr.write(
        `OpenAI request failed (${response.status}): ${body.slice(0, 500)}\n`,
      );
      return null;
    }

    const data = (await response.json()) as ChatCompletionResponse;
    const answer = data.choices?.[0]?.message?.content?.trim();
    if (!answer || !NUMBER_ONLY.test(answer)) {
      process.stderr.write(
        `OpenAI returned an invalid quiz answer: ${JSON.stringify(answer)}\n`,
      );
      return null;
    }
    return answer;
  } catch (err) {
    process.stderr.write(`OpenAI quiz request: ${String(err)}\n`);
    return null;
  }
}
