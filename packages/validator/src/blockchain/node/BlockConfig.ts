export class BlockConfig {
    public GENESIS_TIME: bigint;
    public SECONDS_PER_SLOT: number;
    public SLOTS_PER_EPOCH: number;

    constructor(GENESIS_TIME: bigint, SECONDS_PER_SLOT: number, SLOTS_PER_EPOCH: number) {
        this.GENESIS_TIME = GENESIS_TIME;
        this.SECONDS_PER_SLOT = SECONDS_PER_SLOT;
        this.SLOTS_PER_EPOCH = SLOTS_PER_EPOCH;
    }

    public getEpoch(slot: bigint): bigint {
        return slot / BigInt(this.SLOTS_PER_EPOCH);
    }

    public getNumberOfEpoch(slot: bigint): number {
        const size = BigInt(this.SLOTS_PER_EPOCH);
        return Number(slot - (slot / size) * size);
    }
}
