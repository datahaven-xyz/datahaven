import { Octokit } from "octokit";
import yargs from "yargs";
import { getCommitAndLabels, getCompareLink } from "./github-utils";

const BINARY_CHANGES_LABEL = "B5-clientnoteworthy";
const BREAKING_CHANGES_LABEL = "breaking";

function capitalize(s) {
  return s[0].toUpperCase() + s.slice(1);
}

async function main() {
  const argv = yargs(process.argv.slice(2))
    .usage("Usage: npm run ts-node github/generate-release-body.ts [args]")
    .version("1.0.0")
    .options({
      from: {
        type: "string",
        describe: "previous tag to retrieve commits from",
        required: true,
      },
      to: {
        type: "string",
        describe: "current tag being drafted",
        required: true,
      },
      owner: {
        type: "string",
        describe: "Repository owner (Ex: datahaven-xyz)",
        required: true,
      },
      repo: {
        type: "string",
        describe: "Repository name (Ex: datahaven)",
        required: true,
      },
    })
    .demandOption(["from", "to"])
    .help().argv;

  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN || undefined,
  });

  const previousTag = argv.from;
  const newTag = argv.to;
  const moduleLinks = ["polkadot-sdk", "frontier"].map((repoName) => ({
    name: repoName,
    link: getCompareLink(repoName, previousTag, newTag),
  }));

  const { prByLabels } = await getCommitAndLabels(
    octokit,
    argv.owner,
    argv.repo,
    previousTag,
    newTag
  );
  const filteredPr = prByLabels[BINARY_CHANGES_LABEL] || [];

  const printPr = (pr) => {
    if (pr.labels.includes(BREAKING_CHANGES_LABEL)) {
      return "⚠️ " + pr.title + " (#" + pr.number + ")";
    } else {
      return pr.title + " (#" + pr.number + ")";
    }
  };

  const template = `
## Changes

${filteredPr.map((pr) => `* ${printPr(pr)}`).join("\n")}

## Dependency changes

DataHaven: https://github.com/${argv.owner}/${argv.repo}/compare/${previousTag}...${newTag}
${moduleLinks.map((modules) => `${capitalize(modules.name)}: ${modules.link}`).join("\n")}
`;
  console.log(template);
}

main();
