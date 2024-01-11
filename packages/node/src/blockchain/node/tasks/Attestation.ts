import { Config } from "../../../common/Config";
import { logger } from "../../../common/Logger";
import { NodeStorage } from "../../../storage/NodeStorage";
import { Event } from "../../event/EventDispatcher";
import { Block } from "../../types";
import { Node } from "../Node";
import { NodeTask } from "./NodeTask";
import { BlockElementType, IBlockElementProof } from "./Types";

export class Attestation extends NodeTask {
    constructor(config: Config, storage: NodeStorage, node: Node) {
        super(config, storage, node);

        this.node.addEventListener(Event.PROPOSED, this.prove.bind(this));
    }

    private async prove(event: string, block: Block) {
        logger.info(`prove`);
        const validators = this.getValidators();

        const proofs: IBlockElementProof[] = [];
        const slot = block.header.slot;
        const slot2 = (slot / BigInt(validators.length)) * BigInt(validators.length);
        const idx = Number(slot - slot2);
        const proposer = validators[idx];

        for (const validator of validators) {
            if (validator === proposer) continue;
            const account = (await validator.getAddress()).toLowerCase();
            for (let index = 0; index < block.purchases.branches.length; index++) {
                const branch = block.purchases.branches[index];
                proofs.push({
                    slot,
                    type: BlockElementType.PURCHASE,
                    branchIndex: index,
                    account,
                    signature: await branch.sign(validator, block.header.slot),
                });
            }
            for (let index = 0; index < block.exchangeRates.branches.length; index++) {
                const branch = block.exchangeRates.branches[index];
                proofs.push({
                    slot,
                    type: BlockElementType.EXCHANGE_RATE,
                    branchIndex: index,
                    account,
                    signature: await branch.sign(validator, block.header.slot),
                });
            }
            for (let index = 0; index < block.burnPoints.branches.length; index++) {
                const branch = block.burnPoints.branches[index];
                proofs.push({
                    slot,
                    type: BlockElementType.BURN_POINT,
                    branchIndex: index,
                    account,
                    signature: await branch.sign(validator, block.header.slot),
                });
            }
        }

        await this.node.proofedBlock(proofs, block);
    }

    public async work() {
        await this.dispatcher();
    }
}
