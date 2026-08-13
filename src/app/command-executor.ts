import { fetchRank, sendCommand } from "../api.js";
import { BOT_PREFIX } from "../config.js";
import { formatLogText, log } from "../logger.js";
import { Actions, shouldRun, type Command } from "../plans.js";
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
    recordCommandResult(command, result.text, result.isError);
    if (
      (command === Actions.RANKUP || command === Actions.PRESTIGE) &&
      !result.isError
    ) {
      await refreshRank();
    }
    const executed: ExecutedCommand = {
      succeeded: !result.isError && result.text !== null,
      text: result.text,
      rankupReady: hasReadyMarker(result.text, "rankup"),
      prestigeReady: hasReadyMarker(result.text, "prestige"),
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
    log.error("Command execution failed", error, { command });
    return {
      succeeded: false,
      text: null,
      rankupReady: false,
      prestigeReady: false,
    };
  }
}
