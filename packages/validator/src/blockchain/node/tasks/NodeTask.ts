import { CurrencyRate, LoyaltyProvider } from "../../../../typechain-types";
import { Config } from "../../../common/Config";
import { NodeStorage } from "../../../storage/NodeStorage";
import { EventDispatcher } from "../../event/EventDispatcher";
import { Node } from "../Node";

import { Wallet } from "ethers";
import { ethers } from "hardhat";

export class NodeTask extends EventDispatcher {
    protected readonly config: Config;
    protected readonly storage: NodeStorage;
    protected node: Node;

    protected _loyaltyProviderContract: LoyaltyProvider | undefined;
    protected _currencyRateContract: CurrencyRate | undefined;
    protected _validators: Wallet[] | undefined;

    constructor(config: Config, storage: NodeStorage, node: Node) {
        super();
        this.config = config;
        this.storage = storage;
        this.node = node;
    }

    protected getValidators(): Wallet[] {
        if (this._validators === undefined) {
            this._validators = this.config.validator.keys.map((m) => new Wallet(m, ethers.provider));
        }
        return this._validators;
    }

    protected async getLoyaltyProviderContract(): Promise<LoyaltyProvider> {
        if (this._loyaltyProviderContract === undefined) {
            const factory = await ethers.getContractFactory("LoyaltyProvider");
            this._loyaltyProviderContract = factory.attach(this.config.contracts.providerAddress);
        }
        return this._loyaltyProviderContract;
    }

    protected async getCurrencyRateContract(): Promise<CurrencyRate> {
        if (this._currencyRateContract === undefined) {
            const factory = await ethers.getContractFactory("CurrencyRate");
            this._currencyRateContract = factory.attach(this.config.contracts.currencyRateAddress);
        }
        return this._currencyRateContract;
    }

    public async work() {
        await this.dispatcher();
    }
}
