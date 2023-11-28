import "@nomiclabs/hardhat-ethers";
import { Config } from "../common/Config";
import { logger } from "../common/Logger";
import { IShopData, IUserData, LoyaltyPaymentTaskStatus, ShopTaskStatus, TaskResultType } from "../types/index";
import { Scheduler } from "./Scheduler";

import { Ledger, ShopCollection, Token } from "../../typechain-types";

import * as fs from "fs";
import * as hre from "hardhat";
import { RelayStorage } from "../storage/RelayStorage";
import { ContractUtils } from "../utils/ContractUtils";

import axios from "axios";
import { Wallet } from "ethers";
import URI from "urijs";

export interface IWalletData {
    address: string;
    privateKey: string;
}

/**
 * Creates blocks at regular intervals and stores them in IPFS and databases.
 */
export class ApprovalScheduler extends Scheduler {
    private _config: Config | undefined;

    private _storage: RelayStorage | undefined;

    private _tokenContract: Token | undefined;

    private _ledgerContract: Ledger | undefined;

    private _shopContract: ShopCollection | undefined;

    private _wallets: IWalletData[];

    constructor(expression: string) {
        super(expression);
        this._wallets = [];
        this._wallets.push(...(JSON.parse(fs.readFileSync("./src/data/users.json", "utf8")) as IUserData[]));
        this._wallets.push(...(JSON.parse(fs.readFileSync("./src/data/shops.json", "utf8")) as IShopData[]));
        for (const wallet of this._wallets) {
            wallet.address = wallet.address.toLowerCase();
        }
        this._wallets.sort((a, b) => a.address.localeCompare(b.address));
    }

    private findWallet(findAddress: string): IWalletData | undefined {
        let left: number = 0;
        let right: number = this._wallets.length - 1;
        let mid: number;
        const address = findAddress.toLowerCase();
        while (left <= right) {
            mid = Math.floor((left + right) / 2);
            if (this._wallets[mid].address === address) return this._wallets[mid];
            if (this._wallets[mid].address.localeCompare(address) < 0) left = mid + 1;
            else right = mid - 1;
        }
        return undefined;
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

    private async getTokenContract(): Promise<Token> {
        if (this._tokenContract === undefined) {
            const factory = await hre.ethers.getContractFactory("Token");
            this._tokenContract = factory.attach(this.config.contracts.tokenAddress) as Token;
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

    private async getShopContract(): Promise<ShopCollection> {
        if (this._shopContract === undefined) {
            const factory = await hre.ethers.getContractFactory("ShopCollection");
            this._shopContract = factory.attach(this.config.contracts.shopAddress) as ShopCollection;
        }
        return this._shopContract;
    }

    protected async work() {
        try {
            await this.onNewPayment();
            await this.onCancelPayment();
            await this.onUpdateTask();
            await this.onStatusTask();
        } catch (error) {
            logger.error(`Failed to execute the DefaultScheduler: ${error}`);
        }
    }

    private async onNewPayment() {
        const payments = await this.storage.getPaymentsStatusOf([LoyaltyPaymentTaskStatus.OPENED_NEW]);
        for (const payment of payments) {
            if (ContractUtils.getTimeStamp() - payment.openNewTimestamp < this.config.relay.approvalSecond) continue;
            const wallet = this.findWallet(payment.account);
            if (wallet !== undefined) {
                const nonce = await (await this.getLedgerContract()).nonceOf(wallet.address);
                const signature = await ContractUtils.signLoyaltyNewPayment(
                    new Wallet(wallet.privateKey),
                    payment.paymentId,
                    payment.purchaseId,
                    payment.amount,
                    payment.currency,
                    payment.shopId,
                    nonce
                );

                const serverURL = `http://localhost:${this.config.server.port}`;
                const client = axios.create();
                try {
                    const response1 = await client.get(
                        URI(serverURL).directory("/v1/payment/item").addQuery("paymentId", payment.paymentId).toString()
                    );
                    if (response1.data.data.paymentStatus === LoyaltyPaymentTaskStatus.OPENED_NEW) {
                        const response = await client.post(
                            URI(serverURL).directory("/v1/payment/new").filename("approval").toString(),
                            {
                                paymentId: payment.paymentId,
                                approval: true,
                                signature,
                            }
                        );
                        if (response.data.error !== undefined) {
                            logger.warn(
                                `ApprovalScheduler.onNewPayment: ${response.data.code} - ${response.data.error.message}`
                            );
                        }
                    }
                } catch (e) {
                    //
                }
            }
        }
    }

    private async onCancelPayment() {
        const payments = await this.storage.getPaymentsStatusOf([LoyaltyPaymentTaskStatus.OPENED_CANCEL]);
        for (const payment of payments) {
            if (ContractUtils.getTimeStamp() - payment.openCancelTimestamp < this.config.relay.approvalSecond) continue;
            const shopInfo = await (await this.getShopContract()).shopOf(payment.shopId);
            const wallet = this.findWallet(shopInfo.account);
            if (wallet !== undefined) {
                const nonce = await (await this.getLedgerContract()).nonceOf(wallet.address);
                const signature = await ContractUtils.signLoyaltyCancelPayment(
                    new Wallet(wallet.privateKey),
                    payment.paymentId,
                    payment.purchaseId,
                    nonce
                );

                const serverURL = `http://localhost:${this.config.server.port}`;
                const client = axios.create();
                try {
                    const response1 = await client.get(
                        URI(serverURL).directory("/v1/payment/item").addQuery("paymentId", payment.paymentId).toString()
                    );
                    if (response1.data.data.paymentStatus === LoyaltyPaymentTaskStatus.OPENED_CANCEL) {
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
                                `ApprovalScheduler.onCancelPayment: ${response.data.code} - ${response.data.error.message}`
                            );
                        }
                    }
                } catch (e) {
                    //
                }
            }
        }
    }

    private async onUpdateTask() {
        const tasks = await this.storage.getTasksStatusOf([TaskResultType.UPDATE], [ShopTaskStatus.OPENED]);
        for (const task of tasks) {
            if (ContractUtils.getTimeStamp() - task.timestamp < this.config.relay.approvalSecond) continue;
            const wallet = this.findWallet(task.account);
            if (wallet !== undefined) {
                const nonce = await (await this.getShopContract()).nonceOf(wallet.address);
                const signature = await ContractUtils.signShop(new Wallet(wallet.privateKey), task.shopId, nonce);

                const serverURL = `http://localhost:${this.config.server.port}`;
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
                            `ApprovalScheduler.onUpdateTask: ${response.data.code} - ${response.data.error.message}`
                        );
                    }
                } catch (e) {
                    //
                }
            }
        }
    }

    private async onStatusTask() {
        const tasks = await this.storage.getTasksStatusOf([TaskResultType.STATUS], [ShopTaskStatus.OPENED]);
        for (const task of tasks) {
            if (ContractUtils.getTimeStamp() - task.timestamp < this.config.relay.approvalSecond) continue;
            const wallet = this.findWallet(task.account);
            if (wallet !== undefined) {
                const nonce = await (await this.getShopContract()).nonceOf(wallet.address);
                const signature = await ContractUtils.signShop(new Wallet(wallet.privateKey), task.shopId, nonce);

                const serverURL = `http://localhost:${this.config.server.port}`;
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
                            `ApprovalScheduler.onStatusTask: ${response.data.code} - ${response.data.error.message}`
                        );
                    }
                } catch (e) {
                    //
                }
            }
        }
    }
}
