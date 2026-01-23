import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { CompiledContract } from "@moonwall/cli";
import chalk from "chalk";
import solc from "solc";
import type { Abi } from "viem";
import type { ArgumentsCamelCase } from "yargs";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

type CompileCommandOptions = {
  PreCompilesDirectory: string;
  OutputDirectory: string;
  SourceDirectory: string;
  Verbose: boolean;
};

const sourceByReference: Record<string, string> = {};
const countByReference: Record<string, number> = {};
const refByContract: Record<string, string> = {};
let contractMd5: Record<string, string> = {};
const solcVersion = solc.version();

yargs(hideBin(process.argv))
  .usage("Usage: $0")
  .version("2.0.0")
  .options({
    PreCompilesDirectory: {
      type: "string",
      alias: "p",
      description: "Path to directory containing precompile solidity files",
      default: "../operator/precompiles/"
    },
    OutputDirectory: {
      type: "string",
      alias: "o",
      description: "Output directory for compiled contracts",
      default: "moonwall/contracts/out"
    },
    SourceDirectory: {
      type: "string",
      alias: "i",
      description: "Source directory for solidity contracts to compile",
      default: "moonwall/contracts/src"
    },
    Verbose: {
      type: "boolean",
      alias: "v",
      description: "Verbose mode for extra logging.",
      default: false
    }
  })
  .command<CompileCommandOptions>({
    command: "compile",
    describe: "Compile contracts",
    handler: async (argv) => {
      await main(argv);
    }
  })
  .parse();

async function main(args: ArgumentsCamelCase<CompileCommandOptions>) {
  const precompilesPath = path.join(process.cwd(), args.PreCompilesDirectory);
  const outputDirectory = path.join(process.cwd(), args.OutputDirectory);
  const sourceDirectory = path.join(process.cwd(), args.SourceDirectory);
  const tempFile = path.join(process.cwd(), args.OutputDirectory, ".compile.tmp");

  console.log(`🧪  Solc version: ${solcVersion}`);
  const precompilesDirectoryExists = await fs
    .access(precompilesPath)
    .then(() => true)
    .catch(() => false);
  if (precompilesDirectoryExists) {
    console.log(`🗃️  Precompiles directory: ${precompilesPath}`);
  } else {
    console.log(`⚠️  Precompiles directory not found (${precompilesPath}), skipping.`);
  }
  console.log(`🗃️  Output directory: ${outputDirectory}`);
  console.log(`🗃️  Source directory: ${sourceDirectory}`);

  await fs.mkdir(outputDirectory, { recursive: true });

  // Order is important so precompiles are available first
  const contractSourcePaths: Array<{
    filepath: string;
    importPath: string;
    compile: boolean;
  }> = [];

  if (precompilesDirectoryExists) {
    const entries = await fs.readdir(precompilesPath);
    for (const entry of entries) {
      const fullPath = path.join(precompilesPath, entry);
      contractSourcePaths.push({
        filepath: fullPath,
        importPath: path.posix.join("precompiles", entry),
        compile: true
      });
    }
  }

  contractSourcePaths.push({
    filepath: sourceDirectory,
    importPath: "", // Reference in contracts are local
    compile: true
  });

  const sourceToCompile: Record<string, string> = {};
  const filePaths: string[] = [];
  for (const contractPath of contractSourcePaths) {
    const contracts = (await getFiles(contractPath.filepath)).filter((filename: string) =>
      filename.endsWith(".sol")
    );
    for (const filepath of contracts) {
      const relativePath = path.relative(contractPath.filepath, filepath);
      const normalizedRelative = relativePath.split(path.sep).join(path.posix.sep);
      const importPrefix = contractPath.importPath.replace(/\/$/, "");
      const ref = importPrefix
        ? `${importPrefix}/${normalizedRelative}`.replace(/^\/+/, "")
        : normalizedRelative.replace(/^\/+/, "");
      filePaths.push(filepath);
      sourceByReference[ref] = (await fs.readFile(filepath)).toString();
      if (contractPath.compile) {
        countByReference[ref] = 0;
        if (!sourceByReference[ref].includes("// skip-compilation")) {
          sourceToCompile[ref] = sourceByReference[ref];
        }
      }
    }
  }

  console.log(`📁 Found ${Object.keys(sourceToCompile).length} contracts to compile`);
  const contractsToCompile: string[] = [];
  const tempFileExists = await fs
    .access(tempFile)
    .then(() => true)
    .catch(() => false);

  if (tempFileExists) {
    contractMd5 = JSON.parse((await fs.readFile(tempFile)).toString()) as Record<string, string>;
    for (const contract of Object.keys(sourceToCompile)) {
      const filePath = filePaths.find((candidate) => candidate.includes(contract));
      if (!filePath) {
        continue;
      }
      const contractHash = computeHash((await fs.readFile(filePath)).toString());
      if (contractHash !== contractMd5[contract]) {
        console.log(`  - Change in ${chalk.yellow(contract)}, compiling ⚙️`);
        contractsToCompile.push(contract);
      } else if (args.Verbose) {
        console.log(`  - No change to ${chalk.green(contract)}, skipping ✅`);
      }
    }
  } else {
    console.log(`  - ${chalk.yellow("No temp file found, compiling all contracts ⚙️")}`);
    contractsToCompile.push(...Object.keys(sourceToCompile));
  }

  // Compile contracts
  for (const ref of contractsToCompile) {
    try {
      await compile(ref, outputDirectory, tempFile);

      await fs.writeFile(tempFile, JSON.stringify(contractMd5, null, 2));
    } catch (e: any) {
      console.log(`Failed to compile: ${ref}`);
      if (e.errors) {
        for (const error of e.errors) {
          console.log(error.formattedMessage);
        }
      } else {
        console.log(e);
      }
      process.exit(1);
    }
  }
  // for (const ref of Object.keys(countByReference)) {
  //   if (!countByReference[ref]) {
  //     console.log(`${chalk.red("Warning")}: ${ref} never used: ${countByReference[ref]}`);
  //   }
  // }
}

// For some reasons, solc doesn't provide the relative path to imports :(
const getImports = (fileRef: string) => (dependency: string) => {
  if (sourceByReference[dependency]) {
    countByReference[dependency] = (countByReference[dependency] || 0) + 1;
    return { contents: sourceByReference[dependency] };
  }
  let base = fileRef;
  while (base && base.length > 1) {
    const localRef = path.join(base, dependency);
    if (sourceByReference[localRef]) {
      countByReference[localRef] = (countByReference[localRef] || 0) + 1;
      return { contents: sourceByReference[localRef] };
    }
    base = path.dirname(base);
  }
  return { error: "Source not found" };
};

function compileSolidity(
  fileRef: string,
  contractContent: string
): { [name: string]: CompiledContract<Abi> } {
  const filename = path.basename(fileRef);
  const result = JSON.parse(
    solc.compile(
      JSON.stringify({
        language: "Solidity",
        sources: {
          [filename]: {
            content: contractContent
          }
        },
        settings: {
          optimizer: { enabled: true, runs: 200 },
          outputSelection: {
            "*": {
              "*": ["*"]
            }
          },
          debug: {
            revertStrings: "debug"
          }
        }
      }),
      { import: getImports(fileRef) }
    )
  );
  if (!result.contracts) {
    throw result;
  }
  return Object.keys(result.contracts[filename]).reduce(
    (p, contractName) => {
      p[contractName] = {
        byteCode:
          `0x${result.contracts[filename][contractName].evm.bytecode.object}` as `0x${string}`,
        contract: result.contracts[filename][contractName],
        sourceCode: contractContent
      };
      return p;
    },
    {} as { [name: string]: CompiledContract<Abi> }
  );
}

// Shouldn't be run concurrently with the same 'name'
async function compile(
  fileRef: string,
  destPath: string,
  tempFilePath: string
): Promise<{ [name: string]: CompiledContract<Abi> }> {
  const soliditySource = sourceByReference[fileRef];
  countByReference[fileRef]++;
  if (!soliditySource) {
    throw new Error(`Missing solidity file: ${fileRef}`);
  }
  const compiledContracts = compileSolidity(fileRef, soliditySource);

  await Promise.all(
    Object.keys(compiledContracts).map(async (contractName) => {
      const dest = `${path.join(destPath, path.dirname(fileRef), contractName)}.json`;
      if (refByContract[dest]) {
        console.warn(
          chalk.red(
            `Contract ${contractName} already exist from ${refByContract[dest]}. Erasing previous version`
          )
        );
      }
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.writeFile(dest, JSON.stringify(compiledContracts[contractName], null, 2), {
        flag: "w",
        encoding: "utf-8"
      });
      console.log(`  - ${chalk.green(`${contractName}.json`)} file has been saved 💾`);
      refByContract[dest] = fileRef;
      contractMd5[fileRef] = computeHash(soliditySource);
    })
  );
  await fs.mkdir(path.dirname(tempFilePath), { recursive: true });
  return compiledContracts;
}

async function getFiles(dir: string): Promise<string[]> {
  const subdirs = await fs.readdir(dir);
  const files = await Promise.all(
    subdirs.map(async (subdir): Promise<string[]> => {
      const resolvedPath = path.resolve(dir, subdir);
      const stats = await fs.stat(resolvedPath);
      if (stats.isDirectory()) {
        return getFiles(resolvedPath);
      }
      return [resolvedPath];
    })
  );
  return files.flat();
}

function computeHash(input: string): string {
  const hash = crypto.createHash("md5");
  hash.update(input + solcVersion);
  return hash.digest("hex");
}
