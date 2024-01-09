import { Config } from "../../../common/Config";
import { logger } from "../../../common/Logger";
import { GasPriceManager } from "../../../contract/GasPriceManager";
import { NodeStorage } from "../../../storage/NodeStorage";
import { ResponseMessage } from "../../../utils/Errors";
import { Event } from "../../event/EventDispatcher";
import { Block } from "../../types";
import { Node } from "../Node";
import { NodeTask } from "./NodeTask";
import { BlockElementType, IBlockElement } from "./Types";

import { NonceManager } from "@ethersproject/experimental";
import { PurchaseTransactionStep } from "../../../types";
import { BranchStatus } from "../../storage/BranchStatusStorage";

export class Execution extends NodeTask {
    constructor(config: Config, storage: NodeStorage, node: Node) {
        super(config, storage, node);
        this.node.addEventListener(Event.APPROVED, this.onApproved.bind(this));
    }

    private async onApproved(event: string, data: IBlockElement) {
        const status = this.node.branchStatusStorage.get(data);
        if (status !== undefined && status === BranchStatus.EXECUTED) return;

        if (data.type === BlockElementType.PURCHASE) {
            const block = this.node.getBlock(data.height);
            if (block !== undefined && data.branch < block.purchases.branches.length) {
                await this.savePurchaseToContract(block, data);
            }
        } else if (data.type === BlockElementType.EXCHANGE_RATE) {
            const block = this.node.getBlock(data.height);
            if (block !== undefined && data.branch < block.exchangeRates.branches.length) {
                await this.saveExchangeRateToContract(block, data);
            }
        }
    }

    private async savePurchaseToContract(block: Block, data: IBlockElement) {
        const contract = await this.getLoyaltyProviderContract();
        const validators = this.getValidators();
        const sender = new NonceManager(new GasPriceManager(validators[0]));
        const branch = block.purchases.branches[data.branch];
        try {
            const signatures = this.node.signatureStorage.load(block.header.height, BlockElementType.PURCHASE);
            if (signatures !== undefined) {
                const filtered = signatures.filter((m) => m.index === data.branch).map((m) => m.signature);
                const contactTx = await contract
                    .connect(sender)
                    .savePurchase(block.header.height, branch.items, filtered);
                await contactTx.wait();
                await this.storage.updateStep(
                    branch.items.map((m) => m.purchaseId),
                    PurchaseTransactionStep.EXECUTED
                );
                await this.node.branchStatusStorage.set(data, BranchStatus.EXECUTED);
                logger.info("Execution Purchase Success");
            }
        } catch (error) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.info(`Execution Purchase Fail - ${msg.code}, ${msg.error.message}`);
        }
    }

    private async saveExchangeRateToContract(block: Block, data: IBlockElement) {
        const latestHeight = this.node.blockStorage.getLatestBlockHeight();
        if (block.header.height - 1n === latestHeight) {
            const contract = await this.getCurrencyRateContract();
            const validators = this.getValidators();
            const sender = new NonceManager(new GasPriceManager(validators[0]));
            const branch = block.exchangeRates.branches[data.branch];
            try {
                const signatures = this.node.signatureStorage.load(block.header.height, BlockElementType.EXCHANGE_RATE);
                if (signatures !== undefined) {
                    const filtered = signatures.filter((m) => m.index === data.branch).map((m) => m.signature);
                    const contactTx = await contract.connect(sender).set(block.header.height, branch.items, filtered);
                    await contactTx.wait();
                    await this.node.branchStatusStorage.set(data, BranchStatus.EXECUTED);
                    logger.info("Execution Exchange Rate Success");
                }
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
