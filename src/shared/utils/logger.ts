import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import type { Logger } from "@shared/interfaces/logger";
import { LOG_LEVEL } from "@shared/configs/appConfig";
import { LogLevels } from "@shared/configs/logsLevels";

winston.addColors(LogLevels.colors);

const winstonLogger = winston.createLogger({
  levels: LogLevels.levels,
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
