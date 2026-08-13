import { CommandError, fetchRank, sendCommand } from "../api/client.js";
import { BOT_PREFIX } from "../config.js";
import { formatLogText, log } from "../logger.js";
import {
  Actions,
  progressionReadiness,
  shouldRun,
  type Command,
} from "../plans.js";
import { playerInfo, setLastCommand, updateFromRank } from "../stats/player.js";
import { recordCommandResult } from "../stats/recording.js";

export interface ExecutedCommand {
  succeeded: boolean;
  text: string | null;
  rankupReady: boolean;
  prestigeReady: boolean;
}

function hasReadyMarker(
  text: string | null,
  marker: "rankup" | "prestige",
): boolean {
  return text?.toLowerCase().includes(`ready to ${marker}`) ?? false;
}

export async function refreshRank(): Promise<void> {
  const text = await fetchRank();
  if (!text) return;
  updateFromRank(text);
  log.debug("Player rank refreshed", {
    rank: playerInfo.rank,
    prestige: playerInfo.prestige,
    potatoes: playerInfo.potatoes,
  });
}

export async function executeCommand(
  command: Command,
): Promise<ExecutedCommand> {
  if (!shouldRun(command, playerInfo)) {
    log.info("Command skipped by plan guard", {
      command,
      potatoes: playerInfo.potatoes,
      rank: playerInfo.rank,
      prestige: playerInfo.prestige,
    });
    return {
      succeeded: false,
      text: null,
      rankupReady: false,
      prestigeReady: false,
    };
  }

  try {
    const startedAt = Date.now();
    const result = await sendCommand(command);
    if (result.text !== null && command !== Actions.STATUS) {
      setLastCommand(`${BOT_PREFIX}${command}`);
    }
    if (
      (command === Actions.RANKUP || command === Actions.PRESTIGE) &&
      !result.isError
    ) {
      await refreshRank();
    }
    recordCommandResult(command, result.text, result.isError);
    const stateReadiness = progressionReadiness(playerInfo);
    const executed: ExecutedCommand = {
      succeeded: !result.isError && result.text !== null,
      text: result.text,
      rankupReady:
        stateReadiness.rankupReady || hasReadyMarker(result.text, "rankup"),
      prestigeReady:
        stateReadiness.prestigeReady || hasReadyMarker(result.text, "prestige"),
    };
    log.info("Command executed", {
      command,
      succeeded: executed.succeeded,
      isError: result.isError,
      durationMs: Date.now() - startedAt,
      response: formatLogText(result.text),
    });
    return executed;
  } catch (error) {
    const responseText =
      error instanceof CommandError ? error.responseText : null;
    if (responseText !== null && command !== Actions.STATUS) {
      const stateChanged = recordCommandResult(command, responseText, true);
      if (stateChanged) setLastCommand(`${BOT_PREFIX}${command}`);
    }
    log.error("Command execution failed", error, { command });
    return {
      succeeded: false,
      text: responseText,
      rankupReady: false,
      prestigeReady: false,
    };
  }
}
