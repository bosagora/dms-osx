import { Config } from "../../../common/Config";
import { logger } from "../../../common/Logger";
import { NodeStorage } from "../../../storage/NodeStorage";
import { PurchaseTransactionStep } from "../../../types";
import { ContractUtils } from "../../../utils/ContractUtils";
import { Block, BranchSignature, ExchangeRate, ExchangeRateRoot, Purchase, PurchaseRoot } from "../../types";
import { Node } from "../Node";
import { NodeTask } from "./NodeTask";
import { BlockElementType } from "./Types";

import { NewTransaction } from "dms-store-purchase-sdk";

import { BigNumber } from "ethers";

export class Proposal extends NodeTask {
    constructor(config: Config, storage: NodeStorage, node: Node) {
        super(config, storage, node);
    }

    public async work() {
        await this.dispatcher();
        const current = ContractUtils.getTimeStampBigInt();
        if (this.node.getLatestSlot() < this.node.getExpectedSlot(current)) {
            const latestHash = this.node.getLatestBlockHash();
            const latestSlot = this.node.getLatestSlot();
            const timestamp =
                this.node.blockConfig.GENESIS_TIME + BigInt(this.node.blockConfig.SECONDS_PER_SLOT) * (latestSlot + 1n);
            const block = Block.createBlankBlock(latestHash, latestSlot, timestamp);
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
                        tx.userPhoneHash,
                        tx.sender
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
        return ContractUtils.zeroGWEI(sum.mul(tx.cashAmount).div(tx.totalAmount).div(10000));
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
        let signatures = await this.node.signatureStorage.load(block.header.slot - 1n, BlockElementType.PURCHASE);
        if (signatures !== undefined) {
            block.purchases.signatures.push(
                ...signatures.map((m) => {
                    return new BranchSignature(m.branchIndex, m.signature);
                })
            );
        }
        signatures = await this.node.signatureStorage.load(block.header.slot - 1n, BlockElementType.EXCHANGE_RATE);
        if (signatures !== undefined) {
            block.exchangeRates.signatures.push(
                ...signatures.map((m) => {
                    return new BranchSignature(m.branchIndex, m.signature);
                })
            );
        }
        signatures = await this.node.signatureStorage.load(block.header.slot - 1n, BlockElementType.BURN_POINT);
        if (signatures !== undefined) {
            block.burnPoints.signatures.push(
                ...signatures.map((m) => {
                    return new BranchSignature(m.branchIndex, m.signature);
                })
            );
        }
    }

    private async makeHash(block: Block) {
        block.header.purchaseHash = block.purchases.computeHash(block.header.slot);
        block.header.exchangeRateHash = block.exchangeRates.computeHash(block.header.slot);
        block.header.burnPointHash = block.burnPoints.computeHash(block.header.slot);
    }

    private async signFromProposer(block: Block) {
        const validators = this.getValidators();
        const size = BigInt(validators.length);
        const idx = Number(block.header.slot - (block.header.slot / size) * size);
        const proposer = validators[idx];
        await block.header.sign(proposer);
    }
}
