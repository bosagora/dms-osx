import "@nomiclabs/hardhat-ethers";
import { Config } from "../common/Config";
import { logger } from "../common/Logger";
import { ContractLoyaltyPaymentStatus, LoyaltyPaymentTaskStatus, ShopTaskStatus, TaskResultType } from "../types/index";
import { Scheduler } from "./Scheduler";

import { BIP20DelegatedTransfer, Ledger, LoyaltyConsumer, Shop } from "../../typechain-types";

import * as hre from "hardhat";
import { RelayStorage } from "../storage/RelayStorage";
import { ContractUtils } from "../utils/ContractUtils";

import axios from "axios";
import URI from "urijs";

// tslint:disable-next-line:no-implicit-dependencies
import { AddressZero } from "@ethersproject/constants";

export interface IWalletData {
    address: string;
    privateKey: string;
}

/**
 * Creates blocks at regular intervals and stores them in IPFS and databases.
 */
export class DelegatorApprovalScheduler extends Scheduler {
    private _config: Config | undefined;

    private _storage: RelayStorage | undefined;

    private _tokenContract: BIP20DelegatedTransfer | undefined;

    private _ledgerContract: Ledger | undefined;

    private _shopContract: Shop | undefined;

    constructor(expression: string) {
        super(expression);
    }

    private get config(): Config {
        if (this._config !== undefined) return this._config;
        else {
            logger.error("Config is not ready yet.");
            process.exit(1);
        }
    }

    private get storage(): RelayStorage {
        if (this._storage !== undefined) return this._storage;
        else {
            logger.error("Storage is not ready yet.");
            process.exit(1);
        }
    }

    public setOption(options: any) {
        if (options) {
            if (options.config && options.config instanceof Config) this._config = options.config;
            if (options.storage && options.storage instanceof RelayStorage) this._storage = options.storage;
        }
    }

    public async onStart() {
        //
    }

    private async getTokenContract(): Promise<BIP20DelegatedTransfer> {
        if (this._tokenContract === undefined) {
            const factory = await hre.ethers.getContractFactory("BIP20DelegatedTransfer");
            this._tokenContract = factory.attach(this.config.contracts.tokenAddress) as BIP20DelegatedTransfer;
        }
        return this._tokenContract;
    }

    private async getLedgerContract(): Promise<Ledger> {
        if (this._ledgerContract === undefined) {
            const factory = await hre.ethers.getContractFactory("Ledger");
            this._ledgerContract = factory.attach(this.config.contracts.ledgerAddress) as Ledger;
        }
        return this._ledgerContract;
    }

    private _consumerContract: LoyaltyConsumer | undefined;
    private async getConsumerContract(): Promise<LoyaltyConsumer> {
        if (this._consumerContract === undefined) {
            const factory = await hre.ethers.getContractFactory("LoyaltyConsumer");
            this._consumerContract = factory.attach(this.config.contracts.loyaltyConsumerAddress);
        }
        return this._consumerContract;
    }

    private async getShopContract(): Promise<Shop> {
        if (this._shopContract === undefined) {
            const factory = await hre.ethers.getContractFactory("Shop");
            this._shopContract = factory.attach(this.config.contracts.shopAddress) as Shop;
        }
        return this._shopContract;
    }

    protected async work() {
        try {
            await this.onCancelPayment();
            await this.onUpdateTask();
            await this.onStatusTask();
        } catch (error) {
            logger.error(`Failed to execute the DefaultScheduler: ${error}`);
        }
    }

    private async onCancelPayment() {
        const payments = await this.storage.getPaymentsStatusOf([
            LoyaltyPaymentTaskStatus.OPENED_CANCEL,
            LoyaltyPaymentTaskStatus.APPROVED_CANCEL_FAILED_TX,
            LoyaltyPaymentTaskStatus.APPROVED_CANCEL_REVERTED_TX,
        ]);
        for (const payment of payments) {
            const ledgerContract = await this.getLedgerContract();
            const consumerContract = await this.getConsumerContract();
            const loyaltyPaymentData = await consumerContract.loyaltyPaymentOf(payment.paymentId);
            if (loyaltyPaymentData.status === ContractLoyaltyPaymentStatus.OPENED_CANCEL) continue;

            const shopInfo = await (await this.getShopContract()).shopOf(payment.shopId);
            if (shopInfo.delegator !== AddressZero) {
                const wallet = await this.storage.getDelegator(shopInfo.account, this.config.relay.encryptKey);
                if (wallet !== undefined && wallet.address.toLowerCase() === shopInfo.delegator.toLowerCase()) {
                    logger.info(`DelegatorApprovalScheduler.onCancelPayment ${payment.paymentId}`);
                    const nonce = await ledgerContract.nonceOf(wallet.address);
                    const signature = await ContractUtils.signLoyaltyCancelPayment(
                        wallet,
                        payment.paymentId,
                        payment.purchaseId,
                        nonce
                    );

                    const serverURL = this.config.relay.relayEndpoint;
                    const client = axios.create();
                    try {
                        const response1 = await client.get(
                            URI(serverURL)
                                .directory("/v1/payment/item")
                                .addQuery("paymentId", payment.paymentId)
                                .toString()
                        );

                        if (
                            response1.data.data.paymentStatus === LoyaltyPaymentTaskStatus.OPENED_CANCEL ||
                            response1.data.data.paymentStatus === LoyaltyPaymentTaskStatus.APPROVED_CANCEL_FAILED_TX ||
                            response1.data.data.paymentStatus === LoyaltyPaymentTaskStatus.APPROVED_CANCEL_REVERTED_TX
                        ) {
                            const response = await client.post(
                                URI(serverURL).directory("/v1/payment/cancel").filename("approval").toString(),
                                {
                                    paymentId: payment.paymentId,
                                    approval: true,
                                    signature,
                                }
                            );
                            if (response.data.error !== undefined) {
                                logger.warn(
                                    `DelegatorApprovalScheduler.onCancelPayment: ${response.data.code} - ${response.data.error.message}`
                                );
                            }
                        }
                    } catch (e) {
                        //
                    }
                }
            }
        }
    }

    private async onUpdateTask() {
        const tasks = await this.storage.getTasksStatusOf([TaskResultType.UPDATE], [ShopTaskStatus.OPENED]);
        for (const task of tasks) {
            const shopInfo = await (await this.getShopContract()).shopOf(task.shopId);
            if (shopInfo.delegator !== AddressZero) {
                const wallet = await this.storage.getDelegator(shopInfo.account, this.config.relay.encryptKey);
                if (wallet !== undefined && wallet.address.toLowerCase() === shopInfo.delegator.toLowerCase()) {
                    logger.info(`DelegatorApprovalScheduler.onUpdateTask ${task.taskId}`);
                    const nonce = await (await this.getShopContract()).nonceOf(shopInfo.delegator);
                    const message = ContractUtils.getShopAccountMessage(task.shopId, shopInfo.delegator, nonce);
                    const signature = await ContractUtils.signMessage(wallet, message);

                    const serverURL = this.config.relay.relayEndpoint;
                    const client = axios.create();
                    try {
                        const response = await client.post(
                            URI(serverURL).directory("/v1/shop/update").filename("approval").toString(),
                            {
                                taskId: task.taskId,
                                approval: true,
                                signature,
                            }
                        );
                        if (response.data.error !== undefined) {
                            logger.warn(
                                `DelegatorApprovalScheduler.onUpdateTask: ${response.data.code} - ${response.data.error.message}`
                            );
                        }
                    } catch (e) {
                        //
                    }
                }
            }
        }
    }

    private async onStatusTask() {
        const tasks = await this.storage.getTasksStatusOf([TaskResultType.STATUS], [ShopTaskStatus.OPENED]);
        for (const task of tasks) {
            const shopInfo = await (await this.getShopContract()).shopOf(task.shopId);
            if (shopInfo.delegator !== AddressZero) {
                const wallet = await this.storage.getDelegator(shopInfo.account, this.config.relay.encryptKey);
                if (wallet !== undefined && wallet.address.toLowerCase() === shopInfo.delegator.toLowerCase()) {
                    logger.info(`DelegatorApprovalScheduler.onStatusTask ${task.taskId}`);
                    const nonce = await (await this.getShopContract()).nonceOf(shopInfo.delegator);
                    const message = ContractUtils.getShopAccountMessage(task.shopId, shopInfo.delegator, nonce);
                    const signature = await ContractUtils.signMessage(wallet, message);

                    const serverURL = this.config.relay.relayEndpoint;
                    const client = axios.create();
                    try {
                        const response = await client.post(
                            URI(serverURL).directory("/v1/shop/status").filename("approval").toString(),
                            {
                                taskId: task.taskId,
                                approval: true,
                                signature,
                            }
                        );
                        if (response.data.error !== undefined) {
                            logger.warn(
                                `DelegatorApprovalScheduler.onStatusTask: ${response.data.code} - ${response.data.error.message}`
                            );
                        }
                    } catch (e) {
                        //
                    }
                }
            }
        }
    }
}
