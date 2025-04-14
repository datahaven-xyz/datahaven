import pino from "pino";
import pinoPretty from "pino-pretty";
import chalk from "chalk";

const logLevel = process.env.LOG_LEVEL || "info";

const stream = pinoPretty({
  colorize: true
});

// Custom logger type with success method
interface CustomLogger extends pino.Logger {
  success(msg: string, ...args: any[]): void;
}

// Create the base logger with proper configuration
export const logger: CustomLogger = pino(
  {
    level: logLevel
  },
  stream
) as CustomLogger;

// Add custom success method to the logger
logger.success = function (message: string) {
  this.info(`✅ ${message}`);
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
