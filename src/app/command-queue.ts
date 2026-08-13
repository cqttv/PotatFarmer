import { Actions, type Command } from "../plans.js";

export interface CommandOutcome {
  succeeded: boolean;
  rankupReady: boolean;
  prestigeReady: boolean;
}

export class CommandQueue {
  readonly #commands: Command[] = [];
  readonly #queued = new Set<Command>();
  #cursor = 0;

  constructor(initialCommands: readonly Command[]) {
    this.enqueueLast(...initialCommands);
  }

  takeNext(): Command | null {
    const command = this.#commands.at(this.#cursor);
    if (command === undefined) return null;
    this.#cursor += 1;
    return command;
  }

  enqueueNext(...commands: readonly Command[]): void {
    const additions = this.#newCommands(commands);
    this.#commands.splice(this.#cursor, 0, ...additions);
  }

  enqueueLast(...commands: readonly Command[]): void {
    this.#commands.push(...this.#newCommands(commands));
  }

  snapshot(): readonly Command[] {
    return [...this.#commands];
  }

  get processedCount(): number {
    return this.#cursor;
  }

  #newCommands(commands: readonly Command[]): Command[] {
    const additions: Command[] = [];
    for (const command of commands) {
      if (this.#queued.has(command)) continue;
      this.#queued.add(command);
      additions.push(command);
    }
    return additions;
  }
}

export function scheduleFollowUps(
  queue: CommandQueue,
  command: Command,
  outcome: CommandOutcome,
): void {
  const immediate: Command[] = [];
  if (outcome.prestigeReady) immediate.push(Actions.PRESTIGE);
  else if (outcome.rankupReady) immediate.push(Actions.RANKUP);

  if (outcome.succeeded && command === Actions.SHOP_CDR) {
    immediate.push(Actions.CDR);
  }
  if (outcome.succeeded && command === Actions.SHOP_QUIZ) {
    immediate.push(Actions.QUIZ);
  }
  queue.enqueueNext(...immediate);

  if (outcome.succeeded && command === Actions.CDR) {
    queue.enqueueLast(Actions.FARM, Actions.STEAL);
  }
}
