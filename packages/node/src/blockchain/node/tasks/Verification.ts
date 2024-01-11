import { Config } from "../../../common/Config";
import { logger } from "../../../common/Logger";
import { NodeStorage } from "../../../storage/NodeStorage";
import { PurchaseTransactionStep } from "../../../types";
import { ContractUtils } from "../../../utils/ContractUtils";
import { Event } from "../../event/EventDispatcher";
import { BranchStatus } from "../../storage/BranchStatusStorage";
import { Block } from "../../types";
import { Node } from "../Node";
import { NodeTask } from "./NodeTask";
import { BlockElementType } from "./Types";

import { arrayify } from "@ethersproject/bytes";

export class Verification extends NodeTask {
    constructor(config: Config, storage: NodeStorage, node: Node) {
        super(config, storage, node);
        this.node.addEventListener(Event.PROPOSED, this.verify.bind(this));
    }

    private async verify(event: string, proposedBlock: Block) {
        logger.info(`verify`);
        if (proposedBlock === undefined) return;

        const prevBlock = await this.node.getBlock(proposedBlock.header.height - 1n);
        if (prevBlock === undefined) return;

        for (let branchIndex = 0; branchIndex < prevBlock.purchases.branches.length; branchIndex++) {
            const branch = prevBlock.purchases.branches[branchIndex];
            const hash = branch.computeHash(prevBlock.header.height);
            const proofs = proposedBlock.purchases.signatures.filter((m) => m.branchIndex === branchIndex);

            for (const proof of proofs) {
                const account = ContractUtils.verifySignature(arrayify(hash), proof.signature).toLowerCase();
                this.node.signatureStorage.save(prevBlock.header.height, BlockElementType.PURCHASE, {
                    branchIndex,
                    account,
                    signature: proof.signature,
                });
            }
        }

        for (let branchIndex = 0; branchIndex < prevBlock.exchangeRates.branches.length; branchIndex++) {
            const branch = prevBlock.exchangeRates.branches[branchIndex];
            const hash = branch.computeHash(prevBlock.header.height);
            const proofs = proposedBlock.exchangeRates.signatures.filter((m) => m.branchIndex === branchIndex);

            for (const proof of proofs) {
                const account = ContractUtils.verifySignature(arrayify(hash), proof.signature).toLowerCase();
                this.node.signatureStorage.save(prevBlock.header.height, BlockElementType.EXCHANGE_RATE, {
                    branchIndex,
                    account,
                    signature: proof.signature,
                });
            }
        }

        for (let branchIndex = 0; branchIndex < prevBlock.burnPoints.branches.length; branchIndex++) {
            const branch = prevBlock.burnPoints.branches[branchIndex];
            const hash = branch.computeHash(prevBlock.header.height);
            const proofs = proposedBlock.burnPoints.signatures.filter((m) => m.branchIndex === branchIndex);

            for (const proof of proofs) {
                const account = ContractUtils.verifySignature(arrayify(hash), proof.signature).toLowerCase();
                this.node.signatureStorage.save(prevBlock.header.height, BlockElementType.BURN_POINT, {
                    branchIndex,
                    account,
                    signature: proof.signature,
                });
            }
        }

        for (let idx = 0; idx < prevBlock.purchases.branches.length; idx++) {
            const status = this.node.branchStatusStorage.get({
                height: prevBlock.header.height,
                type: BlockElementType.PURCHASE,
                branchIndex: idx,
            });
            if (status !== undefined && status === BranchStatus.APPROVED) continue;
            await this.verifyPurchases(prevBlock, idx);
        }

        for (let idx = 0; idx < prevBlock.exchangeRates.branches.length; idx++) {
            const status = this.node.branchStatusStorage.get({
                height: prevBlock.header.height,
                type: BlockElementType.EXCHANGE_RATE,
                branchIndex: idx,
            });
            if (status !== undefined && status === BranchStatus.APPROVED) continue;
            await this.verifyExchangeRates(prevBlock, idx);
        }

        for (let idx = 0; idx < prevBlock.burnPoints.branches.length; idx++) {
            const status = this.node.branchStatusStorage.get({
                height: prevBlock.header.height,
                type: BlockElementType.BURN_POINT,
                branchIndex: idx,
            });
            if (status !== undefined && status === BranchStatus.APPROVED) continue;
            await this.verifyBurnPoints(prevBlock, idx);
        }
    }

    private async verifyPurchases(prevBlock: Block, branchIndex: number) {
        const validators = this.getValidators();
        const voters = new Map<string, boolean>();
        for (const validator of validators) {
            voters.set(validator.address.toLowerCase(), false);
        }

        const signatures = this.node.signatureStorage.load(prevBlock.header.height, BlockElementType.PURCHASE);
        if (signatures === undefined) return;
        const proofs = signatures.filter((m) => m.branchIndex === branchIndex);

        const branch = prevBlock.purchases.branches[branchIndex];

        for (const proof of proofs) {
            if (voters.get(proof.account) !== undefined) {
                voters.set(proof.account, true);
            }
        }

        let count = 0;
        for (const value of voters.values()) if (value) count++;

        if (Math.floor((count * 1000) / validators.length) >= Math.floor(2000 / 3)) {
            logger.info("Verification Purchase Approved");
            await this.node.approved({
                height: prevBlock.header.height,
                type: BlockElementType.PURCHASE,
                branchIndex,
            });
            await this.storage.updateStep(
                branch.items.map((m) => m.purchaseId),
                PurchaseTransactionStep.APPROVED
            );
        }
    }

    private async verifyExchangeRates(prevBlock: Block, branchIndex: number) {
        const validators = this.getValidators();
        const voters = new Map<string, boolean>();
        for (const validator of validators) {
            voters.set(validator.address.toLowerCase(), false);
        }

        const signatures = this.node.signatureStorage.load(prevBlock.header.height, BlockElementType.EXCHANGE_RATE);
        if (signatures === undefined) return;

        const proofs = signatures.filter((m) => m.branchIndex === branchIndex);

        for (const proof of proofs) {
            if (voters.get(proof.account) !== undefined) {
                voters.set(proof.account, true);
            }
        }

        let count = 0;
        for (const value of voters.values()) if (value) count++;

        if (Math.floor((count * 1000) / validators.length) >= Math.floor(2000 / 3)) {
            logger.info("Verification Exchange Rate Approved");
            await this.node.approved({
                height: prevBlock.header.height,
                type: BlockElementType.EXCHANGE_RATE,
                branchIndex,
            });
        }
    }

    private async verifyBurnPoints(prevBlock: Block, branchIndex: number) {
        const validators = this.getValidators();
        const voters = new Map<string, boolean>();
        for (const validator of validators) {
            voters.set(validator.address.toLowerCase(), false);
        }

        const signatures = this.node.signatureStorage.load(prevBlock.header.height, BlockElementType.BURN_POINT);
        if (signatures === undefined) return;

        const proofs = signatures.filter((m) => m.branchIndex === branchIndex);

        for (const proof of proofs) {
            if (voters.get(proof.account) !== undefined) {
                voters.set(proof.account, true);
            }
        }

        let count = 0;
        for (const value of voters.values()) if (value) count++;

        if (Math.floor((count * 1000) / validators.length) >= Math.floor(2000 / 3)) {
            logger.info("Verification Burn Point Approved");
            await this.node.approved({
                height: prevBlock.header.height,
                type: BlockElementType.BURN_POINT,
                branchIndex,
            });
        }
    }

    public async work() {
        await this.dispatcher();
    }
}
