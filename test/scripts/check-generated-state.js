const fs = require("node:fs");
const path = require("node:path");

const contractsPath = "../contracts/src";

// Get our generated state creation time
const stateGeneratedCTime = fs.lstatSync("../contracts/deployments/state-diff.json").ctime;
console.log(stateGeneratedCTime);

// Only read our .sol files
const contents = fs.readdirSync(contractsPath, { recursive: true });

try {
  for (const content of contents) {
    const stats = fs.lstatSync(path.join(contractsPath, content));
    if (stats.isFile()) {
      console.log(stats.mtime);

      // if this a .sol file check the date
      if (stateGeneratedCTime < stats.mtime) {
        throw "State generated file is outdated. Please regenerate it with `bun ./scripts/generate-contracts.ts`";
      }
    }
  }
} catch (err) {
  console.error(err);
  // Actually exit the process with a non-zero code
  process.exit(1);
}
