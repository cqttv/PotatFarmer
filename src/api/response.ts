export interface ApiResponseData {
  text?: string;
  error?: string;
}

export interface ApiResponse {
  data: ApiResponseData[] | ApiResponseData;
  errors?: { message: string }[];
  statusCode: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isResponseData(value: unknown): value is ApiResponseData {
  return (
    isRecord(value) &&
    (value["text"] === undefined || typeof value["text"] === "string") &&
    (value["error"] === undefined || typeof value["error"] === "string")
  );
}

export function parseApiResponse(value: unknown): ApiResponse {
  if (!isRecord(value) || typeof value["statusCode"] !== "number") {
    throw new Error("API returned an invalid response");
  }

  const data = value["data"];
  const errors = value["errors"];
  const validData = Array.isArray(data)
    ? data.every(isResponseData)
    : isResponseData(data);
  const validErrors =
    errors === undefined ||
    (Array.isArray(errors) &&
      errors.every(
        (error) => isRecord(error) && typeof error["message"] === "string",
      ));
  if (!validData || !validErrors) {
    throw new Error("API returned an invalid response");
  }

  return value as unknown as ApiResponse;
}
