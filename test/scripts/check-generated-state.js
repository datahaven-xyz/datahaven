const fs = require("node:fs");
const path = require("node:path");

const contractsPath = "../contracts/src";

// Get our generated state creation time
const stateGeneratedCTime = fs.lstatSync("../contracts/deployments/state-diff.json").ctime;

// Only read our .sol files
const contents = fs.readdirSync(contractsPath, { recursive: true });

for (const content of contents) {
  const stats = fs.lstatSync(path.join(contractsPath, content));
  if (stats.isFile()) {
    // if this a .sol file check the date
    if (stateGeneratedCTime < stats.mtime) {
      throw "State generated file is outdated. Please regenerate it with `bun ./scripts/generate-contracts.ts`";
    }
  }
}
