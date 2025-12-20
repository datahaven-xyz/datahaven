const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const originalHash = fs.readFileSync("../contracts/deployments/state-diff.checksum", "utf-8");

// Only read our .sol files
const contractsPath = "../contracts/src";
const contents = fs.readdirSync(contractsPath, { recursive: true });

// Create a hash object
const hash = crypto.createHash("sha1");

for (const content of contents) {
  const stats = fs.lstatSync(path.join(contractsPath, content));
  if (stats.isFile()) {
    const data = fs.readFileSync(path.join(contractsPath, content));
    hash.update(data);
  }
}

if (hash.digest("hex") !== originalHash) {
  throw "State generated file is outdated. Please regenerate it with `bun ./scripts/generate-contracts.ts`";
}
