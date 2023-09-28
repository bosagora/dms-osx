import "@nomiclabs/hardhat-ethers";
import { Amount } from "../common/Amount";
import { Config } from "../common/Config";
import { logger } from "../common/Logger";
import { GasPriceManager } from "../contract/GasPriceManager";
import { IShopData, IPurchaseData, IUserData } from "../types/index";
import { ContractUtils } from "../utils/ContractUtils";
import { Utils } from "../utils/Utils";
import { Scheduler } from "./Scheduler";

import { Ledger, EmailLinkCollection, Token } from "../../typechain-types";

import { NonceManager } from "@ethersproject/experimental";
import { Signer, Wallet } from "ethers";

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

    /**
     * 이메일 지갑주소 링크 컨트랙트
     * @private
     */
    private _emailLinkerContract: EmailLinkCollection | undefined;

    private _purchaseIdx: number = 0;

    private _users: IUserData[];
    private _shops: IShopData[];

    constructor(expression: string) {
        super(expression);
        this._users = JSON.parse(fs.readFileSync("./src/data/users.json", "utf8")) as IUserData[];
        this._shops = JSON.parse(fs.readFileSync("./src/data/shops.json", "utf8")) as IShopData[];
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

    /**
     * 이메일 지갑주소 링크 컨트랙트를 리턴한다.
     * 컨트랙트의 객체가 생성되지 않았다면 컨트랙트 주소를 이용하여 컨트랙트 객체를 생성한 후 반환한다.
     * @private
     */
    private async getEmailLinkerContract(): Promise<EmailLinkCollection> {
        if (this._emailLinkerContract === undefined) {
            const linkCollectionFactory = await hre.ethers.getContractFactory("EmailLinkCollection");
            this._emailLinkerContract = linkCollectionFactory.attach(
                this._config.contracts.emailLinkerAddress
            ) as EmailLinkCollection;
        }
        return this._emailLinkerContract;
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
                const data: IPurchaseData = {
                    purchaseId: `P${this._purchaseIdx.toString().padStart(6, "0")}`,
                    timestamp: Utils.getTimeStamp(),
                    amount: amount.value,
                    userEmail:
                        Math.random() < 0.1 ? "" : this._users[Math.floor(Math.random() * this._users.length)].email,
                    shopId: this._shops[Math.floor(Math.random() * this._shops.length)].shopId,
                };
                const emailHash = ContractUtils.sha256String(data.userEmail);
                const tx = await (await this.getLedgerContract())
                    .connect(await this.getSigner())
                    .savePurchase(data.purchaseId, data.timestamp, data.amount, emailHash, data.shopId, 0);

                console.log(
                    `Send purchase data (purchaseId: ${
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
