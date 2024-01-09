export class BlockConfig {
    public GENESIS_TIME: bigint;
    public SECONDS_PER_BLOCK: number;
    public waitedProvide: number;
    public CYCLE_SIZE: number;

    constructor(GENESIS_TIME: bigint, SECONDS_PER_BLOCK: number, waitedProvide: number) {
        this.GENESIS_TIME = GENESIS_TIME;
        this.SECONDS_PER_BLOCK = SECONDS_PER_BLOCK;
        this.waitedProvide = waitedProvide;
        this.CYCLE_SIZE = 3;
    }
}
