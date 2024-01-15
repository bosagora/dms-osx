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
        const epochSize = BigInt(this.node.blockConfig.SLOTS_PER_EPOCH);
        const idx = this.node.blockConfig.getNumberOfEpoch(block.header.slot);
        const epoch = this.node.blockConfig.getEpoch(block.header.slot) - 2n;

        if (idx !== 0 || epoch < 0) return;

        logger.info(`Finalize [epoch: ${epoch}]`);

        for (let slot = epoch * epochSize; slot < (epoch + 1n) * epochSize; slot++) {
            if (slot <= 0n) continue;

            const prevBlock = await this.node.getBlock(slot);
            if (prevBlock === undefined) continue;

            for (let branchIdx = 0; branchIdx < prevBlock.purchases.branches.length; branchIdx++) {
                const element = {
                    slot,
                    type: BlockElementType.PURCHASE,
                    branchIndex: branchIdx,
                };
                const status = await this.node.branchStatusStorage.get(element);
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
                    slot,
                    type: BlockElementType.EXCHANGE_RATE,
                    branchIndex: branchIdx,
                };
                const status = await this.node.branchStatusStorage.get(element);
                if (status === undefined || status !== BranchStatus.EXECUTED) {
                    await this.node.canceled(element);
                } else {
                    await this.node.finalized(element);
                }
            }

            for (let branchIdx = 0; branchIdx < prevBlock.burnPoints.branches.length; branchIdx++) {
                const element = {
                    slot,
                    type: BlockElementType.BURN_POINT,
                    branchIndex: branchIdx,
                };
                const status = await this.node.branchStatusStorage.get(element);
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
