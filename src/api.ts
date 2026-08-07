import { BEARER_TOKEN, API_URL, BOT_PREFIX } from "./config.js";
import { Actions } from "./plans.js";
import { formatLogText, log } from "./logger.js";

export interface CommandResult {
  text: string | null;
  isError: boolean;
}

interface ApiResponseData {
  text?: string;
  error?: string;
}

interface ApiResponse {
  data: ApiResponseData[] | ApiResponseData;
  errors?: { message: string }[];
  statusCode: number;
}

export class CommandError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "CommandError";
    this.status = status;
  }
}

export async function sendCommand(command: string): Promise<CommandResult> {
  const startedAt = Date.now();
  log.debug("Sending command", { command });
  let response: Awaited<ReturnType<typeof fetch>>;
  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${BEARER_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: `${BOT_PREFIX}${command}` }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    log.error("Command request failed", err, {
      command,
      durationMs: Date.now() - startedAt,
    });
    throw err;
  }

  const data = (await response.json()) as ApiResponse;
  if (!response.ok || data.statusCode !== 200) {
    const error = new CommandError(
      data.errors?.map((e) => e.message).join("; ") ??
        `HTTP ${response.status}`,
      data.statusCode || response.status,
    );
    log.warn("Command was rejected", {
      command,
      httpStatus: response.status,
      apiStatus: data.statusCode,
      durationMs: Date.now() - startedAt,
      error: error.message,
    });
    throw error;
  }

  const [resp] = Array.isArray(data.data) ? data.data : [data.data];
  const result = !resp
    ? { text: null, isError: false }
    : resp.error !== undefined
      ? { text: resp.error, isError: true }
      : { text: resp.text ?? null, isError: false };
  log.debug("Command completed", {
    command,
    durationMs: Date.now() - startedAt,
    isError: result.isError,
    response: formatLogText(result.text),
  });
  return result;
}

export async function fetchRank(): Promise<string | null> {
  try {
    const { text } = await sendCommand(Actions.RANK);
    return text;
  } catch (err) {
    log.warn("Unable to refresh rank", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
