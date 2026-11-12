import { createPublicClient, decodeEventLog, http, type Address } from "viem";
import { eventAbi, type IndexedEvent } from "./events.js";
import type { ReadModel } from "./model.js";

/** The only thing the indexer needs from a chain: reads. */
export interface ChainSource {
  head(): Promise<bigint>;
  blockHash(n: bigint): Promise<string | null>;
  blockTimestamp(n: bigint): Promise<bigint | null>;
  logs(from: bigint, to: bigint): Promise<IndexedEvent[]>;
}

const CHUNK = 2000n;

export class Syncer {
  constructor(private model: ReadModel, private source: ChainSource) {}

  /**
   * Bring the model level with the chain head. If the chain no longer contains the block we last
   * indexed (wiped local chain, shorter chain, reorg), drop everything and replay from genesis.
   */
  async sync(): Promise<void> {
    const head = await this.source.head();
    let last = this.model.lastBlock();
    if (last >= 0n) {
      const hash = head >= last ? await this.source.blockHash(last) : null;
      if (hash === null || hash !== this.model.lastBlockHash()) {
        this.model.reset();
        last = -1n;
      }
    }
    let from = last + 1n;
    while (from <= head) {
      const to = from + CHUNK - 1n < head ? from + CHUNK - 1n : head;
      this.model.apply(await this.source.logs(from, to));
      from = to + 1n;
    }
    if (head > last || last === -1n) {
      const hash = await this.source.blockHash(head);
      const time = await this.source.blockTimestamp(head);
      if (hash) this.model.setCheckpoint(head, hash, time ?? undefined);
    }
  }
}

/** A viem-backed source reading logs of the four deployed contracts. Read-only: no account, no signing. */
export function viemSource(rpcUrl: string, addresses: Address[]): ChainSource {
  const client = createPublicClient({ transport: http(rpcUrl) });
  return {
    // cacheTime 0: viem caches eth_blockNumber for its polling interval, and a stale head would both delay events
    // and (if lower than the last indexed block) be mistaken for a restarted chain.
    head: () => client.getBlockNumber({ cacheTime: 0 }),
    blockHash: async (n) => (await client.getBlock({ blockNumber: n }).catch(() => null))?.hash ?? null,
    blockTimestamp: async (n) => (await client.getBlock({ blockNumber: n }).catch(() => null))?.timestamp ?? null,
    logs: async (from, to) => {
      const logs = await client.getLogs({ address: addresses, fromBlock: from, toBlock: to });
      const out: IndexedEvent[] = [];
      for (const log of logs) {
        try {
          const d = decodeEventLog({ abi: eventAbi, data: log.data, topics: log.topics });
          out.push({
            name: d.eventName,
            args: d.args as unknown as Record<string, unknown>,
            blockNumber: log.blockNumber,
            logIndex: log.logIndex,
          });
        } catch (err) {
          // Our contracts only emit events in eventAbi, so a failure here is a real ABI mismatch: never hide it.
          console.warn(`indexer: could not decode log ${log.transactionHash}#${log.logIndex}: ${(err as Error).message}`);
        }
      }
      return out;
    },
  };
}
