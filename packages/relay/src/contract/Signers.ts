import "@nomiclabs/hardhat-ethers";

import { Signer, Wallet } from "ethers";
import { Config } from "../common/Config";

import { NonceManager } from "@ethersproject/experimental";
import { ContractUtils } from "../utils/ContractUtils";
import { GasPriceManager } from "./GasPriceManager";

import { ethers } from "ethers";
import * as hre from "hardhat";

export interface ISignerItem {
    wallet: Wallet;
    signer: Signer;
    using: boolean;
}

export class RelaySigners {
    private readonly _config: Config;
    private readonly _signers: ISignerItem[];

    constructor(config: Config) {
        this._config = config;

        this._signers = this._config.relay.managerKeys.map((m) => {
            return {
                wallet: new Wallet(m),
                signer: new Wallet(m) as Signer,
                using: false,
            };
        });
    }

    /***
     * 트팬잭션을 중계할 때 사용될 서명자
     * @private
     */
    public async getSigner(provider?: ethers.providers.Provider): Promise<ISignerItem> {
        let signerItem: ISignerItem | undefined;

        if (provider === undefined) provider = hre.ethers.provider;

        const startTime = ContractUtils.getTimeStamp();
        while (true) {
            const findIndex = this._signers.findIndex((m) => !m.using);
            if (findIndex >= 0) {
                this._signers.push(...this._signers.splice(findIndex, 1));
                signerItem = this._signers[this._signers.length - 1];
                signerItem.using = true;
                break;
            }
            if (ContractUtils.getTimeStamp() - startTime > 10) break;
            await ContractUtils.delay(1000);
        }

        if (signerItem !== undefined) {
            signerItem.using = true;
            signerItem.signer = new NonceManager(new GasPriceManager(signerItem.wallet.connect(provider)));
        } else {
            signerItem = this._signers[0];
            signerItem.using = true;
            signerItem.signer = new NonceManager(new GasPriceManager(signerItem.wallet.connect(provider)));
        }

        return signerItem;
    }

    /***
     * 트팬잭션을 중계할 때 사용될 서명자
     * @private
     */
    public releaseSigner(signer: ISignerItem) {
        setTimeout(() => {
            signer.using = false;
        }, 200);
    }
}
