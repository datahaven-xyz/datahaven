import { CONTAINER_NAMES, getPublicPort } from "utils";

export const getRPCUrl = async (): Promise<string> => {
  const publicPort = await getPublicPort(CONTAINER_NAMES.EL1, 8545);
  return `http://127.0.0.1:${publicPort}`;
};

export const getWSUrl = async (): Promise<string> => {
  const publicPort = await getPublicPort(CONTAINER_NAMES.EL1, 8546);
  return `ws://127.0.0.1:${publicPort}`;
};
