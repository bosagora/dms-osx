import { Config } from "../../../common/Config";
import { logger } from "../../../common/Logger";
import { NodeStorage } from "../../../storage/NodeStorage";
import { ContractUtils } from "../../../utils/ContractUtils";
import { Event } from "../../event/EventDispatcher";
import { Block } from "../../types";
import { Node } from "../Node";
import { NodeTask } from "./NodeTask";
import { BlockElementType, IBlockElementProof } from "./Types";

import { arrayify } from "@ethersproject/bytes";
import { PurchaseTransactionStep } from "../../../types";
import { BranchStatus } from "../../storage/BranchStatusStorage";

export class Verification extends NodeTask {
    constructor(config: Config, storage: NodeStorage, node: Node) {
        super(config, storage, node);
        this.node.addEventListener(Event.PROOFED, this.onProofed.bind(this));
        this.node.addEventListener(Event.PROOFED_BLOCK, this.onProofedBlock.bind(this));
    }

    private async onProofed(event: string, data: IBlockElementProof) {
        logger.info(`onProofed`);

        const status = this.node.branchStatusStorage.get(data);
        if (status !== undefined && status === BranchStatus.APPROVED) return;

        const block = this.node.getBlock(data.height);
        if (block !== undefined) {
            switch (data.type) {
                case BlockElementType.PURCHASE:
                    if (
                        block.purchases.branches.length > data.branch &&
                        block.purchases.branches[data.branch].items.length > 0
                    )
                        await this.verifyPurchases(block, data.branch);
                    break;
                case BlockElementType.EXCHANGE_RATE:
                    if (
                        block.exchangeRates.branches.length > data.branch &&
                        block.exchangeRates.branches[data.branch].items.length > 0
                    )
                        await this.verifyExchangeRates(block, data.branch);
                    break;
                case BlockElementType.BURN_POINT:
                    if (
                        block.burnPoints.branches.length > data.branch &&
                        block.burnPoints.branches[data.branch].items.length > 0
                    )
                        await this.verifyBurnPoints(block, data.branch);
                    break;
            }
        }
    }

    private async onProofedBlock(event: string, block: Block) {
        logger.info(`onProofedBlock`);
        if (block !== undefined) {
            for (let idx = 0; idx < block.purchases.branches.length; idx++) {
                const status = this.node.branchStatusStorage.get({
                    height: block.header.height,
                    type: BlockElementType.PURCHASE,
                    branch: idx,
                });
                if (status !== undefined && status === BranchStatus.APPROVED) continue;
                await this.verifyPurchases(block, idx);
            }
            for (let idx = 0; idx < block.exchangeRates.branches.length; idx++) {
                const status = this.node.branchStatusStorage.get({
                    height: block.header.height,
                    type: BlockElementType.EXCHANGE_RATE,
                    branch: idx,
                });
                if (status !== undefined && status === BranchStatus.APPROVED) continue;
                await this.verifyExchangeRates(block, idx);
            }
            for (let idx = 0; idx < block.burnPoints.branches.length; idx++) {
                const status = this.node.branchStatusStorage.get({
                    height: block.header.height,
                    type: BlockElementType.BURN_POINT,
                    branch: idx,
                });
                if (status !== undefined && status === BranchStatus.APPROVED) continue;
                await this.verifyBurnPoints(block, idx);
            }
        }
    }

    private async verifyPurchases(block: Block, branchIndex: number) {
        const validators = this.getValidators();
        const voters = new Map<string, boolean>();
        for (const validator of validators) {
            voters.set(validator.address.toLowerCase(), false);
        }

        const signatures = this.node.signatureStorage.load(block.header.height, BlockElementType.PURCHASE);
        if (signatures === undefined) return;
        const purchaseProofs = signatures.filter((m) => m.index === branchIndex);

        const branch = block.purchases.branches[branchIndex];
        const hash = branch.computeHash(block.header.height);

        for (const proof of purchaseProofs) {
            const account = ContractUtils.verifySignature(arrayify(hash), proof.signature).toLowerCase();
            if (voters.get(account) !== undefined) {
                voters.set(account, true);
            }
        }

        let count = 0;
        for (const value of voters.values()) if (value) count++;

        if (Math.floor((count * 1000) / validators.length) >= Math.floor(2000 / 3)) {
            logger.info("Verification Purchase Approved");
            await this.node.approved({
                height: block.header.height,
                type: BlockElementType.PURCHASE,
                branch: branchIndex,
            });
            await this.storage.updateStep(
                branch.items.map((m) => m.purchaseId),
                PurchaseTransactionStep.APPROVED
            );
        }
    }

    private async verifyExchangeRates(block: Block, branchIndex: number) {
        const validators = this.getValidators();
        const voters = new Map<string, boolean>();
        for (const validator of validators) {
            voters.set(validator.address.toLowerCase(), false);
        }

        const signatures = this.node.signatureStorage.load(block.header.height, BlockElementType.EXCHANGE_RATE);
        if (signatures === undefined) return;
        const purchaseProofs = signatures.filter((m) => m.index === branchIndex);

        const branch = block.exchangeRates.branches[branchIndex];
        const hash = branch.computeHash(block.header.height);

        for (const proof of purchaseProofs) {
            const account = ContractUtils.verifySignature(arrayify(hash), proof.signature).toLowerCase();
            if (voters.get(account) !== undefined) {
                voters.set(account, true);
            }
        }

        let count = 0;
        for (const value of voters.values()) if (value) count++;

        if (Math.floor((count * 1000) / validators.length) >= Math.floor(2000 / 3)) {
            logger.info("Verification Exchange Rate Approved");
            await this.node.approved({
                height: block.header.height,
                type: BlockElementType.EXCHANGE_RATE,
                branch: branchIndex,
            });
        }
    }

    private async verifyBurnPoints(block: Block, branchIndex: number) {
        const validators = this.getValidators();
        const voters = new Map<string, boolean>();
        for (const validator of validators) {
            voters.set(validator.address.toLowerCase(), false);
        }

        const signatures = this.node.signatureStorage.load(block.header.height, BlockElementType.BURN_POINT);
        if (signatures === undefined) return;
        const purchaseProofs = signatures.filter((m) => m.index === branchIndex);

        const branch = block.burnPoints.branches[branchIndex];
        const hash = branch.computeHash(block.header.height);

        for (const proof of purchaseProofs) {
            const account = ContractUtils.verifySignature(arrayify(hash), proof.signature).toLowerCase();
            if (voters.get(account) !== undefined) {
                voters.set(account, true);
            }
        }

        let count = 0;
        for (const value of voters.values()) if (value) count++;

        if (Math.floor((count * 1000) / validators.length) >= Math.floor(2000 / 3)) {
            logger.info("Verification Burn Point Approved");
            await this.node.approved({
                height: block.header.height,
                type: BlockElementType.BURN_POINT,
                branch: branchIndex,
            });
        }
    }

    public async work() {
        await this.dispatcher();
    }
}
