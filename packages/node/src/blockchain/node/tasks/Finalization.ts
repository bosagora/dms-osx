import { Config } from "../../../common/Config";
import { logger } from "../../../common/Logger";
import { NodeStorage } from "../../../storage/NodeStorage";
import { PurchaseTransactionStep } from "../../../types";
import { Event } from "../../event/EventDispatcher";
import { BranchStatus } from "../../storage/BranchStatusStorage";
import { Block } from "../../types";
import { Node } from "../Node";
import { NodeTask } from "./NodeTask";
import { BlockElementType } from "./Types";

export class Finalization extends NodeTask {
    constructor(config: Config, storage: NodeStorage, node: Node) {
        super(config, storage, node);
        this.node.addEventListener(Event.PROPOSED, this.finalize.bind(this));
    }

    private async finalize(event: string, block: Block) {
        logger.info(`finalize`);
        const cycleSize = this.node.blockConfig.CYCLE_SIZE;
        const idx = Number(block.header.height - (block.header.height / BigInt(cycleSize)) * BigInt(cycleSize));
        const cycle = block.header.height / BigInt(cycleSize) - 2n;

        if (idx !== 0 || cycle < 0) return;

        for (let height = cycle * BigInt(cycleSize); height < (cycle + 1n) * BigInt(cycleSize); height++) {
            if (height <= 0n) continue;

            const prevBlock = this.node.getBlock(height);
            if (prevBlock === undefined) continue;

            for (let branchIdx = 0; branchIdx < prevBlock.purchases.branches.length; branchIdx++) {
                const element = {
                    height,
                    type: BlockElementType.PURCHASE,
                    branchIndex: branchIdx,
                };
                const status = this.node.branchStatusStorage.get(element);
                if (status === undefined || status !== BranchStatus.EXECUTED) {
                    await this.node.canceled(element);
                    await this.storage.updateStep(
                        prevBlock.purchases.branches[branchIdx].items.map((m) => m.purchaseId),
                        PurchaseTransactionStep.CANCELED
                    );
                } else {
                    await this.node.finalized(element);
                }
            }

            for (let branchIdx = 0; branchIdx < prevBlock.exchangeRates.branches.length; branchIdx++) {
                const element = {
                    height,
                    type: BlockElementType.EXCHANGE_RATE,
                    branchIndex: branchIdx,
                };
                const status = this.node.branchStatusStorage.get(element);
                if (status === undefined || status !== BranchStatus.EXECUTED) {
                    await this.node.canceled(element);
                } else {
                    await this.node.finalized(element);
                }
            }

            for (let branchIdx = 0; branchIdx < prevBlock.burnPoints.branches.length; branchIdx++) {
                const element = {
                    height,
                    type: BlockElementType.BURN_POINT,
                    branchIndex: branchIdx,
                };
                const status = this.node.branchStatusStorage.get(element);
                if (status === undefined || status !== BranchStatus.EXECUTED) {
                    await this.node.canceled(element);
                } else {
                    await this.node.finalized(element);
                }
            }
        }
    }

    public async work() {
        await this.dispatcher();
    }
}
