import type { Command } from "@domain/types/command";

export interface CommandPlan {
  name: string;
  commands: {
    command: Command;
    delay: number;
  }[];
}
