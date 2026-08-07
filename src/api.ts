import { BEARER_TOKEN, API_URL, BOT_PREFIX } from "./config.js";
import { Actions } from "./plans.js";

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
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${BEARER_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: `${BOT_PREFIX}${command}` }),
    signal: AbortSignal.timeout(10_000),
  });

  const data = (await response.json()) as ApiResponse;
  if (!response.ok || data.statusCode !== 200) {
    throw new CommandError(
      data.errors?.map((e) => e.message).join("; ") ??
        `HTTP ${response.status}`,
      data.statusCode || response.status,
    );
  }

  const [resp] = Array.isArray(data.data) ? data.data : [data.data];
  if (!resp) return { text: null, isError: false };
  if (resp.error !== undefined) return { text: resp.error, isError: true };
  return { text: resp.text ?? null, isError: false };
}

export async function fetchRank(): Promise<string | null> {
  try {
    const { text } = await sendCommand(Actions.RANK);
    return text;
  } catch {
    return null;
  }
}
