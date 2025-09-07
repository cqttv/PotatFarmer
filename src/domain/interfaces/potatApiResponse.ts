import type { PotatApiError } from "@domain/interfaces/potatApiError";
import type { PotatApiResponseData } from "@domain/interfaces/potatApiResponseData";

export interface PotatApiResponse {
  data: PotatApiResponseData[] | PotatApiResponseData;
  duration: number;
  errors?: PotatApiError[];
  statusCode: number;
}
