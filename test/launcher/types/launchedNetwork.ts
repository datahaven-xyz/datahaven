import invariant from "tiny-invariant";
import { logger, type RelayerType } from "utils";

type ContainerSpec = {
  name: string;
  publicPorts: Record<string, number>;
  internalPorts: Record<string, number>;
};

/**
 * Represents the state and associated resources of a launched network environment,
 * including DataHaven nodes, Kurtosis services, and related process/file descriptors.
 */
export class LaunchedNetwork {
  protected runId: string;
  protected _containers: ContainerSpec[];
  protected _networkId: string;
  protected _networkName: string;
  protected _activeRelayers: RelayerType[];
  /** The RPC URL for the Ethereum Execution Layer (EL) client. */
  protected _elRpcUrl?: string;
  /** The HTTP endpoint for the Ethereum Consensus Layer (CL) client. */
  protected _clEndpoint?: string;
  /** The Kubernetes namespace for the network. Used only for deploy commands. */
  protected _kubeNamespace?: string;
  /** The DataHaven authorities for the network. */
  protected _datahavenAuthorities?: string[];

  constructor() {
    this.runId = crypto.randomUUID();
    this._containers = [];
    this._activeRelayers = [];
    this._networkName = "";
    this._networkId = "";
    this._elRpcUrl = undefined;
    this._clEndpoint = undefined;
    this._kubeNamespace = undefined;
    this._datahavenAuthorities = undefined;
  }

  public set networkName(name: string) {
    invariant(name.trim().length > 0, "❌ networkName cannot be empty");
    this._networkName = name.trim();
  }

  public get networkName(): string {
    return this._networkName;
  }

  public set networkId(id: string) {
    invariant(id.trim().length > 0, "❌ networkId cannot be empty");
    this._networkId = id.trim();
  }

  public get networkId(): string {
    return this._networkId;
  }

  /**
   * Gets the unique ID for this run of the launched network.
   * @returns The run ID string.
   */
  getRunId(): string {
    return this.runId;
  }

  /**
   * Gets the port for a DataHaven RPC node.
   *
   * In reality, it just looks for the "ws" port of the
   * `datahaven-alice` container, if it was registered.
   * @returns The port number of the container, or -1 if ws port is not found.
   * @throws If the container is not found.
   */
  getContainerPort(id: string): number {
    const container = this._containers.find((x) => x.name === id);
    invariant(container, `❌ Container ${id} not found`);
    return container.publicPorts.ws ?? -1;
  }

  addContainer(
    containerName: string,
    publicPorts: Record<string, number> = {},
    internalPorts: Record<string, number> = {}
  ) {
    this._containers.push({ name: containerName, publicPorts, internalPorts });
  }

  public getPublicWsPort(): number {
    logger.debug("Getting public WebSocket port for LaunchedNetwork");
    logger.debug("Containers:");
    logger.debug(JSON.stringify(this.containers));
    const port = this.containers.map((x) => x.publicPorts.ws).find((x) => x !== -1);
    invariant(port !== undefined, "❌ No public port found in containers");
    return port;
  }

  /**
   * Sets the RPC URL for the Ethereum Execution Layer (EL) client.
   * @param url - The EL RPC URL string.
   */
  public set elRpcUrl(url: string) {
    this._elRpcUrl = url;
  }

  /**
   * Gets the RPC URL for the Ethereum Execution Layer (EL) client.
   * @returns The EL RPC URL string.
   * @throws If the EL RPC URL has not been set.
   */
  public get elRpcUrl(): string {
    invariant(this._elRpcUrl, "❌ EL RPC URL not set in LaunchedNetwork");
    return this._elRpcUrl;
  }

  /**
   * Sets the HTTP endpoint for the Ethereum Consensus Layer (CL) client.
   * @param url - The CL HTTP endpoint string.
   */
  public set clEndpoint(url: string) {
    this._clEndpoint = url;
  }

  /**
   * Gets the HTTP endpoint for the Ethereum Consensus Layer (CL) client.
   * @returns The CL HTTP endpoint string.
   * @throws If the CL HTTP endpoint has not been set.
   */
  public get clEndpoint(): string {
    invariant(this._clEndpoint, "❌ CL HTTP Endpoint not set in LaunchedNetwork");
    return this._clEndpoint;
  }

  public get containers(): ContainerSpec[] {
    return this._containers;
  }

  public get relayers(): RelayerType[] {
    return [...this._activeRelayers];
  }

  public set kubeNamespace(namespace: string) {
    this._kubeNamespace = namespace;
  }

  public get kubeNamespace(): string {
    invariant(this._kubeNamespace, "❌ Kubernetes namespace not set in LaunchedNetwork");
    return this._kubeNamespace;
  }

  /**
   * Sets the DataHaven authorities for the network.
   * @param authorities - Array of authority hashes.
   */
  public set datahavenAuthorities(authorities: string[]) {
    this._datahavenAuthorities = authorities;
  }

  /**
   * Gets the DataHaven authorities for the network.
   * @returns Array of authority hashes.
   */
  public get datahavenAuthorities(): string[] {
    return this._datahavenAuthorities || [];
  }
}
