import "@nomiclabs/hardhat-ethers";
import { Amount } from "../common/Amount";
import { Config } from "../common/Config";
import { logger } from "../common/Logger";
import { GasPriceManager } from "../contract/GasPriceManager";
import { IPurchaseData, IShopData, IUserData } from "../types/index";
import { ContractUtils } from "../utils/ContractUtils";
import { Utils } from "../utils/Utils";
import { Scheduler } from "./Scheduler";

import { Ledger, LoyaltyProvider, Token } from "../../typechain-types";

import { NonceManager } from "@ethersproject/experimental";
import { Signer, Wallet } from "ethers";

// tslint:disable-next-line:no-implicit-dependencies
import { AddressZero } from "@ethersproject/constants";

import * as fs from "fs";
import * as hre from "hardhat";

/**
 * Creates blocks at regular intervals and stores them in IPFS and databases.
 */
export class DefaultScheduler extends Scheduler {
    /**
     * The object containing the settings required to run
     */
    private _config: Config | undefined;

    /**
     * ERC20 토큰 컨트랙트
     * @private
     */
    private _tokenContract: Token | undefined;

    /**
     * 사용자의 원장 컨트랙트
     * @private
     */
    private _ledgerContract: Ledger | undefined;

    private _providerContract: LoyaltyProvider | undefined;

    private _purchaseIdx: number = 0;

    private _users: IUserData[] = [];
    private _shops: IShopData[] = [];

    constructor(expression: string) {
        super(expression);
        this._users.push(...(JSON.parse(fs.readFileSync("./src/data/users.json", "utf8")) as IUserData[]));
        this._users.push(...(JSON.parse(fs.readFileSync("./src/data/users_mobile.json", "utf8")) as IUserData[]));
        this._shops.push(...(JSON.parse(fs.readFileSync("./src/data/shops.json", "utf8")) as IShopData[]));
    }

    /**
     * Returns the value if this._config is defined.
     * Otherwise, exit the process.
     */
    private get config(): Config {
        if (this._config !== undefined) return this._config;
        else {
            logger.error("Config is not ready yet.");
            process.exit(1);
        }
    }

    /**
     * Set up multiple objects for execution
     * @param options objects for execution
     */
    public setOption(options: any) {
        if (options) {
            if (options.config && options.config instanceof Config) this._config = options.config;
        }
    }

    /**
     * Called when the scheduler starts.
     */
    public async onStart() {
        //
    }

    /**
     * ERC20 토큰 컨트랙트를 리턴한다.
     * 컨트랙트의 객체가 생성되지 않았다면 컨트랙트 주소를 이용하여 컨트랙트 객체를 생성한 후 반환한다.
     * @private
     */
    private async getTokenContract(): Promise<Token> {
        if (this._tokenContract === undefined) {
            const tokenFactory = await hre.ethers.getContractFactory("Token");
            this._tokenContract = tokenFactory.attach(this._config.contracts.tokenAddress) as Token;
        }
        return this._tokenContract;
    }

    /**
     * 사용자의 원장 컨트랙트를 리턴한다.
     * 컨트랙트의 객체가 생성되지 않았다면 컨트랙트 주소를 이용하여 컨트랙트 객체를 생성한 후 반환한다.
     * @private
     */
    private async getLedgerContract(): Promise<Ledger> {
        if (this._ledgerContract === undefined) {
            const ledgerFactory = await hre.ethers.getContractFactory("Ledger");
            this._ledgerContract = ledgerFactory.attach(this._config.contracts.ledgerAddress) as Ledger;
        }
        return this._ledgerContract;
    }

    private async getProviderContract(): Promise<LoyaltyProvider> {
        if (this._providerContract === undefined) {
            const factory = await hre.ethers.getContractFactory("LoyaltyProvider");
            this._providerContract = factory.attach(this._config.contracts.providerAddress) as LoyaltyProvider;
        }
        return this._providerContract;
    }

    /***
     * 서명자
     * @private
     */
    private getSigner(): Signer {
        const wallet = new Wallet(this._config.setting.validator_key);
        return new NonceManager(new GasPriceManager(hre.ethers.provider.getSigner(wallet.address)));
    }

    /**
     * This function is repeatedly executed by the scheduler.
     * @protected
     */
    protected async work() {
        try {
            const enable = Math.random() < 0.7;
            if (enable) {
                this._purchaseIdx += 100;
                const amount = Amount.make((Math.floor(Math.random() * 10) + 1) * 1_000, 18);
                const userIdx = Math.floor(Math.random() * this._users.length);
                const phoneHash = ContractUtils.getPhoneHash(this._users[userIdx].phone);
                const data: IPurchaseData = {
                    purchaseId: `P${this._purchaseIdx.toString().padStart(6, "0")}`,
                    timestamp: Utils.getTimeStamp(),
                    amount: amount.value,
                    currency: "krw",
                    shopId: this._shops[Math.floor(Math.random() * this._shops.length)].shopId,
                    method: 0,
                    account: Math.random() < 0.1 ? AddressZero : this._users[userIdx].address,
                    phone: phoneHash,
                };
                const tx = await (await this.getProviderContract()).connect(await this.getSigner()).savePurchase(data);

                console.log(
                    `Send purchase data (account: ${data.account}, phone: ${data.phone}, purchaseId: ${
                        data.purchaseId
                    }, amount: ${amount.toIntegralString()}, shopId: ${data.shopId}, tx: ${tx.hash})...`
                );

                await tx.wait();
            }
        } catch (error) {
            logger.error(`Failed to execute the DefaultScheduler: ${error}`);
        }
    }
}
