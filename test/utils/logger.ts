import pino from "pino";
import pinoPretty from "pino-pretty";
import chalk from "chalk";

const logLevel = process.env.LOG_LEVEL || "info";

const stream = pinoPretty({
  colorize: true
});

// Create the base logger
const baseLogger = pino({ level: logLevel }, stream);

// Extend the logger with a success method
export const logger = {
  ...baseLogger,
  success: (message: string) => {
    baseLogger.info(`✅ ${message}`);
  }
};

// Simple progress bar function
export const printProgress = (percent: number) => {
  const width = 30;
  const completed = Math.floor(width * (percent / 100));
  const remaining = width - completed;

  const bar = chalk.green("█".repeat(completed)) + chalk.gray("░".repeat(remaining));

  console.log(`\n${chalk.bold("Progress:")} ${bar} ${percent}%\n`);
};

// Print a section header
export const printHeader = (title: string) => {
  console.log(`\n${chalk.bold.cyan(`▶ ${title}`)}`);
  console.log(chalk.gray("─".repeat(title.length + 3)));
};

// Print a divider
export const printDivider = () => {
  console.log(chalk.gray(`\n${"─".repeat(50)}\n`));
};
