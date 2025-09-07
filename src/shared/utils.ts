import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import type { Logger } from "@shared/types";
import { LOG_LEVEL } from "@shared/config";

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const logLevels = {
  levels: {
    emerg: 0,
    alert: 1,
    crit: 2,
    error: 3,
    warning: 4,
    notice: 5,
    info: 6,
    debug: 7,
  },
  colors: {
    emerg: "red",
    alert: "red",
    crit: "red",
    error: "red",
    warning: "yellow",
    notice: "cyan",
    info: "green",
    debug: "blue",
  },
};

winston.addColors(logLevels.colors);

const winstonLogger = winston.createLogger({
  levels: logLevels.levels,
  level: LOG_LEVEL,
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.simple(),
  ),
  transports: [
    new winston.transports.Console(),
    new DailyRotateFile({
      filename: "logs/application-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      zippedArchive: true,
      maxSize: "20m",
      maxFiles: "14d",
    }),
  ],
});

export const logger: Logger = {
  emerg: (message: string): void => {
    winstonLogger.emerg(message);
  },
  alert: (message: string): void => {
    winstonLogger.alert(message);
  },
  crit: (message: string): void => {
    winstonLogger.crit(message);
  },
  error: (message: string): void => {
    winstonLogger.error(message);
  },
  warning: (message: string): void => {
    winstonLogger.warning(message);
  },
  notice: (message: string): void => {
    winstonLogger.notice(message);
  },
  info: (message: string): void => {
    winstonLogger.info(message);
  },
  debug: (message: string): void => {
    winstonLogger.debug(message);
  },
};
