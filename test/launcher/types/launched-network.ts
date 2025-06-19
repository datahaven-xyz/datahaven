import invariant from "tiny-invariant";

export interface Container {
  name: string;
  publicPorts: {
    ws: number;
    rpc: number;
  };
}

export interface LaunchedNetwork {
  networkName: string;
  kubeNamespace: string;
  containers: Container[];
  elRpcUrl?: string;
  clEndpoint?: string;
  datahavenAuthorities?: string[];
}

/**
 * Creates a new LaunchedNetwork instance
 */
export function createLaunchedNetwork(networkId: string): LaunchedNetwork {
  return {
    networkName: `datahaven-net-${networkId}`,
    kubeNamespace: "", // Not used in local launches
    containers: [],
    datahavenAuthorities: []
  };
}

/**
 * Gets the public WebSocket port from the first registered container
 */
export function getPublicWsPort(network: LaunchedNetwork): number {
  const firstContainer = network.containers[0];
  invariant(
    firstContainer && firstContainer.publicPorts.ws > 0,
    "❌ No containers with public WebSocket ports found in launched network"
  );
  return firstContainer.publicPorts.ws;
}

/**
 * Gets the public RPC port from the first registered container
 */
export function getPublicRpcPort(network: LaunchedNetwork): number {
  const firstContainer = network.containers[0];
  invariant(
    firstContainer && firstContainer.publicPorts.rpc > 0,
    "❌ No containers with public RPC ports found in launched network"
  );
  return firstContainer.publicPorts.rpc;
}

/**
 * Adds a container to the launched network
 */
export function addContainer(network: LaunchedNetwork, container: Container): void {
  network.containers.push(container);
}

/**
 * Updates the Ethereum RPC URL
 */
export function setElRpcUrl(network: LaunchedNetwork, url: string): void {
  network.elRpcUrl = url;
}

/**
 * Updates the Consensus Layer endpoint
 */
export function setClEndpoint(network: LaunchedNetwork, url: string): void {
  network.clEndpoint = url;
}

/**
 * Sets the DataHaven authorities
 */
export function setDatahavenAuthorities(network: LaunchedNetwork, authorities: string[]): void {
  network.datahavenAuthorities = authorities;
}
