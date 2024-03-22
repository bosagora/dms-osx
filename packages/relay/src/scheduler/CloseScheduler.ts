import "@nomiclabs/hardhat-ethers";
import { Ledger, LoyaltyConsumer } from "../../typechain-types";
import { Config } from "../common/Config";
import { logger } from "../common/Logger";
import { RelayStorage } from "../storage/RelayStorage";
import { ContractLoyaltyPaymentStatus, LoyaltyPaymentTaskStatus } from "../types";
import { ContractUtils } from "../utils/ContractUtils";
import { Scheduler } from "./Scheduler";

import URI from "urijs";

import * as hre from "hardhat";
import { HTTPClient } from "../utils/Utils";

/**
 * Creates blocks at regular intervals and stores them in IPFS and databases.
 */
export class CloseScheduler extends Scheduler {
    private _config: Config | undefined;

    private _storage: RelayStorage | undefined;

    /**
     * 사용자의 원장 컨트랙트
     * @private
     */
    private _ledgerContract: Ledger | undefined;

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

    protected async work() {
        try {
            await this.onNewPayment();
            await this.onCancelPayment();
            await this.onCheckConsistencyOfNewPayment();
            await this.onCheckConsistencyOfCancelPayment();
            await this.onRemoveExpiredAccount();
        } catch (error) {
            logger.error(`Failed to execute the CloseScheduler: ${error}`);
        }
    }

    private async onNewPayment() {
        const payments = await this.storage.getPaymentsStatusOf([
            LoyaltyPaymentTaskStatus.OPENED_NEW,
            LoyaltyPaymentTaskStatus.APPROVED_NEW_FAILED_TX,
            LoyaltyPaymentTaskStatus.APPROVED_NEW_SENT_TX,
            LoyaltyPaymentTaskStatus.APPROVED_NEW_CONFIRMED_TX,
            LoyaltyPaymentTaskStatus.APPROVED_NEW_REVERTED_TX,
            LoyaltyPaymentTaskStatus.DENIED_NEW,
            LoyaltyPaymentTaskStatus.REPLY_COMPLETED_NEW,
        ]);
        for (const payment of payments) {
            if (ContractUtils.getTimeStamp() - payment.openNewTimestamp < this.config.relay.forcedCloseSecond) continue;
            logger.info(`CloseScheduler.onNewPayment ${payment.paymentId}`);

            const serverURL = this.config.relay.relayEndpoint;
            const client = new HTTPClient({
                headers: {
                    Authorization: this.config.relay.accessKey,
                },
            });

            try {
                const response = await client.post(
                    URI(serverURL).directory("/v1/payment/new").filename("close").toString(),
                    {
                        confirm: false,
                        paymentId: payment.paymentId,
                    }
                );
                if (response.data.error !== undefined) {
                    logger.warn(`CloseScheduler.onNewPayment: ${response.data.code} - ${response.data.error.message}`);
                }
            } catch (e) {
                //
            }
        }
    }

    private async onCancelPayment() {
        const payments = await this.storage.getPaymentsStatusOf([
            LoyaltyPaymentTaskStatus.OPENED_CANCEL,
            LoyaltyPaymentTaskStatus.APPROVED_CANCEL_FAILED_TX,
            LoyaltyPaymentTaskStatus.APPROVED_CANCEL_SENT_TX,
            LoyaltyPaymentTaskStatus.APPROVED_CANCEL_CONFIRMED_TX,
            LoyaltyPaymentTaskStatus.APPROVED_CANCEL_REVERTED_TX,
            LoyaltyPaymentTaskStatus.DENIED_CANCEL,
            LoyaltyPaymentTaskStatus.REPLY_COMPLETED_CANCEL,
        ]);
        for (const payment of payments) {
            if (ContractUtils.getTimeStamp() - payment.openCancelTimestamp < this.config.relay.forcedCloseSecond)
                continue;
            logger.info(`CloseScheduler.onCancelPayment ${payment.paymentId}`);

            const serverURL = this.config.relay.relayEndpoint;
            const client = new HTTPClient({
                headers: {
                    Authorization: this.config.relay.accessKey,
                },
            });
            try {
                const response = await client.post(
                    URI(serverURL).directory("/v1/payment/cancel").filename("close").toString(),
                    {
                        confirm: false,
                        paymentId: payment.paymentId,
                    }
                );
                if (response.data.error !== undefined) {
                    logger.warn(
                        `CloseScheduler.onCancelPayment: ${response.data.code} - ${response.data.error.message}`
                    );
                }
            } catch (e) {
                //
            }
        }
    }

    private async getLedgerContract(): Promise<Ledger> {
        if (this._ledgerContract === undefined) {
            const ledgerFactory = await hre.ethers.getContractFactory("Ledger");
            this._ledgerContract = ledgerFactory.attach(this.config.contracts.ledgerAddress);
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

    private async onCheckConsistencyOfNewPayment() {
        const payments = await this.storage.getContractPaymentsStatusOf(
            [ContractLoyaltyPaymentStatus.OPENED_PAYMENT],
            [LoyaltyPaymentTaskStatus.CLOSED_NEW, LoyaltyPaymentTaskStatus.FAILED_NEW]
        );
        for (const payment of payments) {
            logger.info(`CloseScheduler.onCheckConsistencyOfNewPayment ${payment.paymentId}`);

            const contract = await this.getConsumerContract();
            const loyaltyPaymentData = await contract.loyaltyPaymentOf(payment.paymentId);

            if (loyaltyPaymentData.status === ContractLoyaltyPaymentStatus.OPENED_PAYMENT) {
                const serverURL = this.config.relay.relayEndpoint;
                const client = new HTTPClient({
                    headers: {
                        Authorization: this.config.relay.accessKey,
                    },
                });
                try {
                    const response = await client.post(
                        URI(serverURL).directory("/v1/payment/new").filename("close").toString(),
                        {
                            confirm: payment.paymentStatus === LoyaltyPaymentTaskStatus.CLOSED_NEW,
                            paymentId: payment.paymentId,
                        }
                    );
                    if (response.data.error !== undefined) {
                        logger.warn(
                            `CloseScheduler.onCheckConsistencyOfNewPayment: ${response.data.code} - ${response.data.error.message}`
                        );
                    }
                } catch (e) {
                    //
                }
            } else {
                await this.storage.updatePaymentContractStatus(payment.paymentId, loyaltyPaymentData.status);
            }
        }
    }

    private async onCheckConsistencyOfCancelPayment() {
        const payments = await this.storage.getContractPaymentsStatusOf(
            [ContractLoyaltyPaymentStatus.OPENED_CANCEL],
            [LoyaltyPaymentTaskStatus.CLOSED_CANCEL, LoyaltyPaymentTaskStatus.FAILED_CANCEL]
        );
        for (const payment of payments) {
            logger.info(`CloseScheduler.onCheckConsistencyOfCancelPayment ${payment.paymentId}`);

            const contract = await this.getConsumerContract();
            const loyaltyPaymentData = await contract.loyaltyPaymentOf(payment.paymentId);

            if (loyaltyPaymentData.status === ContractLoyaltyPaymentStatus.OPENED_CANCEL) {
                const serverURL = this.config.relay.relayEndpoint;
                const client = new HTTPClient({
                    headers: {
                        Authorization: this.config.relay.accessKey,
                    },
                });
                try {
                    const response = await client.post(
                        URI(serverURL).directory("/v1/payment/cancel").filename("close").toString(),
                        {
                            confirm: payment.paymentStatus === LoyaltyPaymentTaskStatus.CLOSED_CANCEL,
                            paymentId: payment.paymentId,
                        }
                    );
                    if (response.data.error !== undefined) {
                        logger.warn(
                            `CloseScheduler.onCheckConsistencyOfCancelPayment: ${response.data.code} - ${response.data.error.message}`
                        );
                    }
                } catch (e) {
                    //
                }
            } else {
                await this.storage.updatePaymentContractStatus(payment.paymentId, loyaltyPaymentData.status);
            }
        }
    }

    private async onRemoveExpiredAccount() {
        await this.storage.removeExpiredAccount();
    }
}
