import { BEARER_TOKEN, API_URL, BOT_PREFIX } from "@shared/configs/appConfig";
import { logger } from "@shared/utils/logger";
import type { PotatApiResponse } from "@domain/interfaces/potatApiResponse";
import type { PotatApiResponseData } from "@domain/interfaces/potatApiResponseData";

export async function sendCommand(command: string): Promise<void> {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${BEARER_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: `${BOT_PREFIX}${command}` }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  const data = (await response.json()) as PotatApiResponse;

  if (data.statusCode !== 200) {
    const errorMsg =
      data.errors?.map((e) => e.message).join("; ") ?? "Unknown error";
    throw new Error(errorMsg);
  }

  const rawData = data.data;
  const normalizedData: PotatApiResponseData[] = Array.isArray(rawData)
    ? rawData
    : [rawData];

  if (normalizedData.length === 0) {
    logger.debug(JSON.stringify(data, null, 2));
    logger.notice(`${BOT_PREFIX}${command}: No response data.`);
    return;
  }

  for (const resp of normalizedData) {
    const responseText = resp.error ?? resp.text ?? "No response";
    const formattedResponse = `${BOT_PREFIX}${command}: ${responseText}`;

    if (resp.error || /(not ready)/i.test(String(responseText))) {
      logger.notice(formattedResponse);
      continue;
    }

    logger.info(formattedResponse);
  }
}
