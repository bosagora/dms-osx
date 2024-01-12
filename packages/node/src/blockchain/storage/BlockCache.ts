import { Block } from "../types";

import { LRUCache } from "lru-cache";

export class BlockCache {
    private static MAX_CACHE_SIZE = 4 * 32;
    private static MIN_CACHE_SIZE = 3 * 32;
    private cache: LRUCache<bigint, Block>;

    constructor() {
        this.cache = new LRUCache<bigint, Block>({
            max: BlockCache.MIN_CACHE_SIZE,
            maxSize: BlockCache.MAX_CACHE_SIZE,
            sizeCalculation: (value: Block, key: bigint) => {
                return 1;
            },
            ttl: 1000 * 60 * 5,
            allowStale: false,
            updateAgeOnGet: false,
            updateAgeOnHas: false,
        });
    }

    public set(block: Block) {
        this.cache.set(block.header.slot, block);
    }

    public get(slot: bigint): Block | undefined {
        return this.cache.get(slot);
    }
}
