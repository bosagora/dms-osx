import { Config } from "../../../common/Config";
import { logger } from "../../../common/Logger";
import { NodeStorage } from "../../../storage/NodeStorage";
import { ContractUtils } from "../../../utils/ContractUtils";
import { Block, ExchangeRate, ExchangeRateRoot, Purchase, PurchaseRoot } from "../../types";
import { Node } from "../Node";
import { NodeTask } from "./NodeTask";
import { BlockElementType } from "./Types";

import { NewTransaction } from "dms-store-purchase-sdk";

import { BigNumber } from "ethers";
import { PurchaseTransactionStep } from "../../../types";

export class Proposal extends NodeTask {
    constructor(config: Config, storage: NodeStorage, node: Node) {
        super(config, storage, node);
    }

    public async work() {
        await this.dispatcher();
        const current = ContractUtils.getTimeStampBigInt();
        if (this.node.getLatestBlockHeight() < this.node.getExpectedHeight(current)) {
            const latestHash = this.node.getLatestBlockHash();
            const latestHeight = this.node.getLatestBlockHeight();
            const block = Block.createBlankBlock(latestHash, latestHeight);
            try {
                await this.loadPurchase(block.purchases);
                await this.loadExchangeRate(block.exchangeRates);
                await this.loadProof(block);
                await this.makeHash(block);
                await this.signFromProposer(block);
                await this.node.proposed(block);
            } catch (error) {
                logger.error(`Failed to execute the Proposal: ${error}`);
            }
        }
    }

    private async loadPurchase(purchases: PurchaseRoot) {
        const contract = await this.getLoyaltyProviderContract();
        const txs = await this.storage.getPurchaseTransaction(this.node.blockConfig.waitedProvide);
        if (txs.length > 0) {
            logger.info(`Proposal Purchase - Length : ${txs.length}`);
            const ids = [];
            for (const tx of txs) {
                if (await contract.purchasesOf(tx.purchaseId)) {
                    await this.storage.updateStep([tx.purchaseId], PurchaseTransactionStep.EXECUTED);
                } else {
                    const loyalty = this.getLoyaltyInTransaction(tx);
                    const purchase = new Purchase(
                        tx.purchaseId,
                        tx.cashAmount,
                        loyalty,
                        tx.currency.toLowerCase(),
                        tx.shopId,
                        tx.userAccount,
                        tx.userPhoneHash
                    );
                    purchases.addItem(purchase);
                    ids.push(tx.purchaseId);
                }
            }
            await this.storage.updateStep(ids, PurchaseTransactionStep.INCLUDED);
        }
    }

    private getLoyaltyInTransaction(tx: NewTransaction): BigNumber {
        if (tx.totalAmount.eq(0)) return BigNumber.from(0);
        if (tx.cashAmount.eq(0)) return BigNumber.from(0);
        let sum: BigNumber = BigNumber.from(0);
        for (const elem of tx.details) {
            sum = sum.add(elem.amount.mul(elem.providePercent));
        }
        return sum.mul(tx.cashAmount).div(tx.totalAmount).div(10000);
    }

    private async loadExchangeRate(exchangeRates: ExchangeRateRoot) {
        const records = await this.storage.getExchangeRate();
        if (records.length > 0) {
            logger.info(`Proposal Exchange Rate - Length : ${records.length}`);
            for (const elem of records) exchangeRates.addItem(new ExchangeRate(elem.symbol, BigNumber.from(elem.rate)));
        }
    }

    private async loadProof(block: Block) {
        block.purchases.signatures.length = 0;
        block.exchangeRates.signatures.length = 0;
        block.burnPoints.signatures.length = 0;
        let signatures = this.node.signatureStorage.load(block.header.height - 1n, BlockElementType.PURCHASE);
        if (signatures !== undefined) {
            block.purchases.signatures.push(...signatures);
        }
        signatures = this.node.signatureStorage.load(block.header.height - 1n, BlockElementType.EXCHANGE_RATE);
        if (signatures !== undefined) {
            block.exchangeRates.signatures.push(...signatures);
        }
        signatures = this.node.signatureStorage.load(block.header.height - 1n, BlockElementType.BURN_POINT);
        if (signatures !== undefined) {
            block.burnPoints.signatures.push(...signatures);
        }
    }

    private async makeHash(block: Block) {
        block.header.purchaseHash = block.purchases.computeHash(block.header.height);
        block.header.exchangeRateHash = block.exchangeRates.computeHash(block.header.height);
        block.header.burnPointHash = block.burnPoints.computeHash(block.header.height);
    }

    private async signFromProposer(block: Block) {
        const validators = this.getValidators();
        const idx = Number(block.header.height - block.header.height / BigInt(validators.length));
        const proposer = validators[idx];
        await block.header.sign(proposer);
    }
}
