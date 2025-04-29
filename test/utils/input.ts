import {
  type Status,
  type Theme,
  createPrompt,
  isEnterKey,
  makeTheme,
  useEffect,
  useKeypress,
  usePrefix,
  useState
} from "@inquirer/core";
import type { PartialDeep } from "@inquirer/type";
import chalk from "chalk";

type TimeoutConfirmConfig = {
  message: string;
  default?: boolean;
  timeoutMs: number;
  theme?: PartialDeep<Theme>;
};

export const timeoutConfirm = createPrompt<boolean, TimeoutConfirmConfig>((cfg, done) => {
  const [status, setStatus] = useState<Status>("loading");
  const [input, setInput] = useState("");
  const [left, setLeft] = useState(cfg.timeoutMs);

  const theme = makeTheme(cfg.theme);
  const prefix = usePrefix({ status, theme });

  useEffect(() => {
    const startTime = Date.now();
    const id = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newLeft = Math.max(0, cfg.timeoutMs - elapsed);

      setLeft(newLeft);

      if (newLeft <= 0) {
        setStatus("done");
        clearInterval(id);
        done(cfg.default ?? true);
      }
    }, 10);

    return () => clearInterval(id);
  }, []);

  const finish = () => {
    const val = /^(y|yes)$/i.test(input)
      ? true
      : /^(n|no)$/i.test(input)
        ? false
        : (cfg.default ?? true);
    setStatus("done");
    done(val);
  };

  useKeypress((key, rl) => {
    if (isEnterKey(key)) finish();
    else setInput(rl.line);
  });

  const defaultBadge = theme.style.defaultAnswer(cfg.default === false ? "y/N" : "Y/n");

  const main = `${prefix} ${theme.style.message(cfg.message, status)} \
${defaultBadge} ${input}`;
  const border = chalk.yellow("=".repeat(cfg.message.length + 40));
  const hint = theme.style.help(
    chalk.magenta(
      `⏱ Will default to ${chalk.bold(cfg.default ? "YES" : "NO")} in ${chalk.bold((left / 1000).toFixed(0))}s`
    )
  );

  return `${border}\n${hint}\n${main}\n${border}`;
});

export const confirmWithTimeout = (
  question: string,
  defaultValue: boolean,
  timeoutSeconds: number
) =>
  timeoutConfirm({
    message: question,
    default: defaultValue,
    timeoutMs: timeoutSeconds * 1000,
    theme: {
      style: {
        message: (text: string) => chalk.cyan(text),
        answer: (text: string) => chalk.green(text)
      }
    }
  });
