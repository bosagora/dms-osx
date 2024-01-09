import { BlockElementType, IBlockElement } from "../node/tasks/Types";
import { Block } from "../types";

export enum BranchStatus {
    PROPOSED = 0,
    PROOFED = 1,
    APPROVED = 2,
    EXECUTED = 3,
    FINALIZED = 4,
    CANCELED = 5,
}

export class BranchStatusStorage {
    private approvals: Map<string, BranchStatus>;

    constructor() {
        this.approvals = new Map<string, BranchStatus>();
    }

    private makeKey(height: bigint, type: BlockElementType, branch: number): string {
        return (
            height.toString().padStart(16, "0") +
            "_" +
            type.toString().padStart(3, "0") +
            "_" +
            branch.toString().padStart(3, "0")
        );
    }

    public setAllInBlock(block: Block, status: BranchStatus) {
        for (let idx = 0; idx < block.purchases.branches.length; idx++) {
            const key = this.makeKey(block.header.height, BlockElementType.PURCHASE, idx);
            this.approvals.set(key, status);
        }

        for (let idx = 0; idx < block.exchangeRates.branches.length; idx++) {
            const key = this.makeKey(block.header.height, BlockElementType.EXCHANGE_RATE, idx);
            this.approvals.set(key, status);
        }

        for (let idx = 0; idx < block.burnPoints.branches.length; idx++) {
            const key = this.makeKey(block.header.height, BlockElementType.BURN_POINT, idx);
            this.approvals.set(key, status);
        }
    }

    public set(data: IBlockElement, status: BranchStatus) {
        const key = this.makeKey(data.height, data.type, data.branch);
        this.approvals.set(key, status);
    }

    public get(data: IBlockElement): BranchStatus | undefined {
        const key = this.makeKey(data.height, data.type, data.branch);
        return this.approvals.get(key);
    }
}
