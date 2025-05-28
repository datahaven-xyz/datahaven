import { serve } from "bun";
import invariant from "tiny-invariant";
import { logger } from "utils";

/** This is a mock Ethereum RPC server that simulates basic Ethereum JSON-RPC methods.
 *
 * It is unknown if we will use this, or if it it needed. Still it's good to have as a reminder
 */
class MockEthereumRPC {
  constructor(
    public blockNumber = 123,
    public logs: string[] = [],
    public subscriptions: Map<string, string> = new Map()
  ) {}

  handleRPC(method: `${string}_${string}`, params: (string | number)[], id: number) {
    switch (method) {
      case "eth_blockNumber":
        return {
          jsonrpc: "2.0",
          id,
          result: `0x${this.blockNumber.toString(16)}`
        };

      case "eth_getLogs":
        return { jsonrpc: "2.0", id, result: this.logs };

      case "eth_subscribe": {
        const subId = `0x${Math.random().toString(16).slice(2)}`;
        invariant(
          typeof params[0] === "string",
          `invalid parameters, should be string: ${params[0]}`
        );
        this.subscriptions.set(subId, params[0]); // "newHeads", "logs", etc
        return { jsonrpc: "2.0", id, result: subId };
      }

      case "eth_getBlockByNumber":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            number: `0x${this.blockNumber.toString(16)}`,
            hash: "0x1234567890abcdef",
            timestamp: `0x${Math.floor(Date.now() / 1000).toString(16)}`,
            transactions: []
          }
        };

      default:
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: "Method not found" }
        };
    }
  }

  addLog(log: string) {
    this.logs.push(log);
  }

  incrementBlock() {
    this.blockNumber++;
  }
}

export const mockEth = new MockEthereumRPC();

export const mockEthServer = serve({
  port: 8545,
  websocket: {
    message(ws, message) {
      const { method, params, id } = JSON.parse(
        typeof message === "string" ? message : message.toString()
      );
      logger.debug(`Received request: ${method} args: ${JSON.stringify(params)}`);
      const response = mockEth.handleRPC(method, params, id);
      ws.send(JSON.stringify(response));
    },

    open(ws) {
      logger.info("Ethereum WebSocket connection opened");
      ws.send(
        JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_connection",
          params: { status: "connected", comment: "Mock ETH" }
        })
      );
    },

    close(_ws, code, message) {
      logger.info(`WebSocket connection closed: ${code} ${message}`);
    }
  },
  fetch(req, server) {
    // Handle WebSocket upgrade requests
    if (server.upgrade(req)) {
      return;
    }

    // Handle regular HTTP requests
    if (req.method === "POST") {
      return new Response(JSON.stringify(mockEth.handleRPC("eth_blockNumber", [], 1)), {
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(
      "Mock Ethereum RPC Server\nWebSocket: ws://localhost:8545\nHTTP: http://localhost:8545",
      {
        status: 200,
        headers: { "Content-Type": "text/plain" }
      }
    );
  }
});

logger.info("Mock Ethereum RPC running on ws://localhost:8545");
