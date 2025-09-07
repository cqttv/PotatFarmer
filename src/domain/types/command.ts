import type { Actions } from "@domain/actions";

export type Command = (typeof Actions)[keyof typeof Actions];
