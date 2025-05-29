import path from "node:path";
import { $ } from "bun";
import { logger, printDivider } from "utils";
import type { ParsedDataHavenParameter } from "utils/types";

// Constants for paths
export const PARAMETERS_TEMPLATE_PATH = "configs/parameters/datahaven-parameters.json";
export const PARAMETERS_OUTPUT_DIR = "tmp/configs";
export const PARAMETERS_OUTPUT_FILE = "datahaven-parameters.json";
export const PARAMETERS_OUTPUT_PATH = path.join(PARAMETERS_OUTPUT_DIR, PARAMETERS_OUTPUT_FILE);

/**
 * A collection of parameters to be set in the DataHaven runtime.
 * This class is used to collect parameters from different steps of the launch process
 * and then generate a JSON file to be used by the setDataHavenParameters script.
 */
export class ParameterCollection {
  private parameters: ParsedDataHavenParameter[] = [];

  /**
   * Adds a parameter to the collection
   * @param param The parameter to add
   */
  public addParameter(param: ParsedDataHavenParameter): void {
    // Check if parameter with same name already exists
    const existingIndex = this.parameters.findIndex((p) => p.name === param.name);
    if (existingIndex !== -1) {
      // Replace existing parameter
      this.parameters[existingIndex] = param;
      logger.debug(`Updated parameter: ${String(param.name)} = ${JSON.stringify(param.value)}`);
    } else {
      // Add new parameter
      this.parameters.push(param);
      logger.debug(`Added parameter: ${String(param.name)} = ${JSON.stringify(param.value)}`);
    }
  }

  /**
   * Returns the current parameters
   */
  public getParameters(): ParsedDataHavenParameter[] {
    return [...this.parameters];
  }

  /**
   * Generates a JSON file with the parameters collected so far
   */
  public async generateParametersFile(): Promise<string> {
    logger.debug(`Ensuring output directory exists: ${PARAMETERS_OUTPUT_DIR}`);
    await $`mkdir -p ${PARAMETERS_OUTPUT_DIR}`.quiet();

    // If we have no parameters, load the template to get the structure
    if (this.parameters.length === 0) {
      logger.debug(`No parameters collected, loading template from ${PARAMETERS_TEMPLATE_PATH}`);
      const templateFile = Bun.file(PARAMETERS_TEMPLATE_PATH);
      if (!(await templateFile.exists())) {
        throw new Error(`Template file ${PARAMETERS_TEMPLATE_PATH} does not exist`);
      }
      this.parameters = await templateFile.json();
    }

    // Write the parameters to a file
    logger.debug(`Writing parameters to ${PARAMETERS_OUTPUT_PATH}`);
    await Bun.write(PARAMETERS_OUTPUT_PATH, JSON.stringify(this.parameters, null, 2));
    logger.debug(`Parameters file generated at ${PARAMETERS_OUTPUT_PATH}`);

    return PARAMETERS_OUTPUT_PATH;
  }
}

/**
 * Creates a new ParameterCollection, pre-loaded with template parameters if available
 */
export async function createParameterCollection(): Promise<ParameterCollection> {
  const collection = new ParameterCollection();
  const templateFile = Bun.file(PARAMETERS_TEMPLATE_PATH);

  if (await templateFile.exists()) {
    const templateParams = await templateFile.json();
    for (const param of templateParams) {
      collection.addParameter(param);
    }
  }

  return collection;
}

/**
 * A helper function to set DataHaven parameters from a ParameterCollection
 *
 * @param options Options for setting parameters
 * @param options.rpcUrl The RPC URL of the DataHaven node
 * @param options.collection The parameter collection
 * @param options.setParameters Flag to control execution
 * @returns Promise resolving to true if parameters were set successfully
 */
export async function setParametersFromCollection({
  rpcUrl,
  collection,
  setParameters,
  wait
}: {
  rpcUrl: string;
  collection: ParameterCollection;
  setParameters?: boolean;
}): Promise<boolean> {
  const parametersFilePath = await collection.generateParametersFile();

  try {
    // Import the setDataHavenParameters function dynamically
    const { setDataHavenParameters } = await import("../scripts/set-datahaven-parameters");

    return await setDataHavenParameters({
      rpcUrl,
      parametersFilePath,
      setParameters,
      wait
    });
  } catch (error) {
    logger.error(`Failed to set DataHaven parameters: ${error}`);
    printDivider();
    return false;
  }
}
