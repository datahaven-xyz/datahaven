import pino from "pino";
import pinoPretty from "pino-pretty";

const logLevel = process.env.LOG_LEVEL || "info";

const stream = pinoPretty({
  colorize: true
});
export const logger = pino({ level: logLevel }, stream);
