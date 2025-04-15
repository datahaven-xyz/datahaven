import chalk from "chalk";
import readline from "node:readline";
// Helper function to create an interactive prompt with timeout
export const promptWithTimeout = async (
  question: string,
  defaultValue: boolean,
  timeoutSeconds: number
): Promise<boolean> => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise<boolean>((resolve) => {
    const defaultText = defaultValue ? "Y/n" : "y/N";

    // Create a visually striking prompt
    const border = chalk.yellow("=".repeat(question.length + 40));
    console.log("\n");
    console.log(border);
    console.log(chalk.yellow("▶ ") + chalk.bold.cyan(question));
    console.log(
      chalk.magenta(
        `⏱  Will default to ${chalk.bold(defaultValue ? "YES" : "NO")} in ${chalk.bold(timeoutSeconds)} seconds`
      )
    );
    console.log(border);
    const fullQuestion = chalk.green(`\n➤ Please enter your choice [${chalk.bold(defaultText)}]: `);

    const timer = setTimeout(() => {
      console.log(
        `\n${chalk.yellow("⏱")} ${chalk.bold("Timeout reached, using default:")} ${chalk.green(defaultValue ? "YES" : "NO")}\n`
      );
      rl.close();
      resolve(defaultValue);
    }, timeoutSeconds * 1000);

    rl.question(fullQuestion, (answer) => {
      clearTimeout(timer);
      rl.close();

      if (answer.trim() === "") {
        resolve(defaultValue);
      } else {
        const normalizedAnswer = answer.trim().toLowerCase();
        console.log("");
        resolve(normalizedAnswer === "y" || normalizedAnswer === "yes");
      }
    });
  });
};
