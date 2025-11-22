import { $ } from "bun";
import { z } from "zod";
import { logger } from "./logger";

export type KurtosisServiceInfo = {
  name: string;
  portType: string;
  portNumber: number;
};

export const standardKurtosisServices = [
  "el-1-reth-lodestar",
  "el-2-reth-lodestar",
  "vc-1-reth-lodestar",
  "vc-2-reth-lodestar",
  "dora"
];

const portDetailSchema = z.object({
  number: z.number(),
  transport: z.number(), // Consider z.literal(0) | z.literal(2) if these are the only values
  maybe_application_protocol: z.string().optional()
});

const portsListSchema = z.record(z.string(), portDetailSchema);

const serviceSchema = z.object({
  image: z.string(),
  ports: portsListSchema,
  public_ports: portsListSchema,
  files: z.record(z.string(), z.array(z.string())).optional(),
  entrypoint: z.array(z.string()).optional(),
  cmd: z.array(z.string()),
  env_vars: z.record(z.string(), z.string()).optional(),
  labels: z.record(z.string(), z.string()).optional(),
  tini_enabled: z.boolean()
});

export type KurtosisService = z.infer<typeof serviceSchema>;

export const getServiceFromKurtosis = async (
  service: string,
  enclave: string
): Promise<KurtosisService> => {
  logger.debug("Getting service from kurtosis", service);

  const command = `kurtosis service inspect ${enclave} ${service} -o json`;
  logger.debug(`Running command: ${command}`);

  const { stdout, stderr, exitCode } = await $`sh -c ${command}`.nothrow().quiet();
  if (exitCode !== 0) {
    throw Error(`Failed to get port for ${service}: ${stderr.toString()}`);
  }

  const output = stdout.toString();
  logger.trace(output);

  return serviceSchema.parse(JSON.parse(output));
};

export const getPortFromKurtosis = async (
  service: string,
  portName: string,
  enclave: string
): Promise<number> => {
  logger.debug("Getting port for service", service, portName);

  const command = `kurtosis service inspect ${enclave} ${service} -o json`;
  logger.debug(`Running command: ${command}`);

  const { stdout, stderr, exitCode } = await $`sh -c ${command}`.nothrow().quiet();
  if (exitCode !== 0) {
    throw Error(`Failed to get port for ${service} ${portName}: ${stderr.toString()}`);
  }

  const output = stdout.toString();
  logger.debug(output);

  const parsed = serviceSchema.parse(JSON.parse(output));

  return parsed.public_ports[portName].number;
};

export const getServicesFromKurtosis = async (
  enclaveName: string
): Promise<Record<string, KurtosisService>> => {
  const promises = standardKurtosisServices.map(async (serviceName) => {
    const serviceData = await getServiceFromKurtosis(serviceName, enclaveName);
    return { [serviceName]: serviceData };
  });

  const results = await Promise.all(promises);
  return results.reduce((acc, current) => ({ ...acc, ...current }), {});
};
