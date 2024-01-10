import { Config } from "../../../common/Config";
import { logger } from "../../../common/Logger";
import { GasPriceManager } from "../../../contract/GasPriceManager";
import { NodeStorage } from "../../../storage/NodeStorage";
import { PurchaseTransactionStep } from "../../../types";
import { ResponseMessage } from "../../../utils/Errors";
import { Event } from "../../event/EventDispatcher";
import { BranchStatus } from "../../storage/BranchStatusStorage";
import { Block } from "../../types";
import { Node } from "../Node";
import { NodeTask } from "./NodeTask";
import { BlockElementType, IBlockElement } from "./Types";

import { NonceManager } from "@ethersproject/experimental";

export class Execution extends NodeTask {
    constructor(config: Config, storage: NodeStorage, node: Node) {
        super(config, storage, node);
        this.node.addEventListener(Event.APPROVED, this.execute.bind(this));
    }

    private async execute(event: string, data: IBlockElement) {
        logger.info(`execute`);
        const status = this.node.branchStatusStorage.get(data);

        if (status !== undefined && status === BranchStatus.APPROVED) {
            if (data.type === BlockElementType.PURCHASE) {
                const approvedBlock = this.node.getBlock(data.height);
                const proofedBlock = this.node.getBlock(data.height + 1n);
                if (
                    approvedBlock !== undefined &&
                    proofedBlock !== undefined &&
                    data.branch < approvedBlock.purchases.branches.length
                ) {
                    await this.savePurchaseToContract(approvedBlock, proofedBlock, data);
                }
            } else if (data.type === BlockElementType.EXCHANGE_RATE) {
                const approvedBlock = this.node.getBlock(data.height);
                const proofedBlock = this.node.getBlock(data.height + 1n);
                if (
                    approvedBlock !== undefined &&
                    proofedBlock !== undefined &&
                    data.branch < approvedBlock.exchangeRates.branches.length
                ) {
                    await this.saveExchangeRateToContract(approvedBlock, proofedBlock, data);
                }
            }
        }
    }

    private async savePurchaseToContract(approvedBlock: Block, proofedBlock: Block, data: IBlockElement) {
        const contract = await this.getLoyaltyProviderContract();
        const validators = this.getValidators();
        const sender = new NonceManager(new GasPriceManager(validators[0]));
        const branch = approvedBlock.purchases.branches[data.branch];
        try {
            const signatures = proofedBlock.purchases.signatures
                .filter((m) => m.index === data.branch)
                .map((m) => m.signature);
            const contactTx = await contract
                .connect(sender)
                .savePurchase(approvedBlock.header.height, branch.items, signatures);
            await contactTx.wait();
            await this.storage.updateStep(
                branch.items.map((m) => m.purchaseId),
                PurchaseTransactionStep.EXECUTED
            );
            await this.node.branchStatusStorage.set(data, BranchStatus.EXECUTED);
            logger.info("Execution Purchase Success");
        } catch (error) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.info(`Execution Purchase Fail - ${msg.code}, ${msg.error.message}`);
        }
    }

    private async saveExchangeRateToContract(approvedBlock: Block, proofedBlock: Block, data: IBlockElement) {
        const latestHeight = this.node.blockStorage.getLatestBlockHeight();
        logger.info(
            `latestHeight: ${latestHeight.toString()}, block.header.height: ${approvedBlock.header.height.toString()}`
        );
        if (approvedBlock.header.height >= latestHeight - 1n) {
            const contract = await this.getCurrencyRateContract();
            const validators = this.getValidators();
            const sender = new NonceManager(new GasPriceManager(validators[0]));
            const branch = approvedBlock.exchangeRates.branches[data.branch];
            try {
                const signatures = proofedBlock.exchangeRates.signatures
                    .filter((m) => m.index === data.branch)
                    .map((m) => m.signature);
                const contactTx = await contract
                    .connect(sender)
                    .set(approvedBlock.header.height, branch.items, signatures);
                await contactTx.wait();
                await this.node.branchStatusStorage.set(data, BranchStatus.EXECUTED);
                logger.info("Execution Exchange Rate Success");
            } catch (error) {
                const msg = ResponseMessage.getEVMErrorMessage(error);
                logger.info(`Execution Exchange Rate Fail - ${msg.code}, ${msg.error.message}`);
            }
        } else {
            await this.node.branchStatusStorage.set(data, BranchStatus.EXECUTED);
            logger.info("Execution Exchange Rate Passed");
        }
    }

    public async work() {
        await this.dispatcher();
    }
}
