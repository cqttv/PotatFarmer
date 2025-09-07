import type { Actions } from "@domain/actions";

export type Command = (typeof Actions)[keyof typeof Actions];

export interface CommandPlan {
  name: string;
  commands: {
    command: Command;
    delay: number;
  }[];
}

export interface ApiError {
  message: string;
}

export interface ApiResponseData {
  text?: string;
  error?: string;
  reply?: string;
}

export interface ApiResponse {
  data: ApiResponseData[] | ApiResponseData;
  duration: number;
  errors?: ApiError[];
  statusCode: number;
}
