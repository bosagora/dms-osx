import "@nomiclabs/hardhat-ethers";

import { Signer, Wallet } from "ethers";
import { Config } from "../common/Config";

import { NonceManager } from "@ethersproject/experimental";
import { ContractUtils } from "../utils/ContractUtils";
import { GasPriceManager } from "./GasPriceManager";

import * as hre from "hardhat";

export interface ISignerItem {
    index: number;
    signer: Signer;
    using: boolean;
}

export class RelaySigners {
    private readonly _config: Config;
    private readonly _signers: ISignerItem[];
    constructor(config: Config) {
        this._config = config;

        let idx = 0;
        this._signers = this._config.relay.managerKeys.map((m) => {
            return {
                index: idx++,
                signer: new Wallet(m, hre.ethers.provider) as Signer,
                using: false,
            };
        });
    }

    /***
     * 트팬잭션을 중계할 때 사용될 서명자
     * @private
     */
    public async getSigner(): Promise<ISignerItem> {
        let signerItem: ISignerItem | undefined;
        let done = false;

        const startTime = ContractUtils.getTimeStamp();
        while (!done) {
            for (signerItem of this._signers) {
                if (!signerItem.using) {
                    signerItem.using = true;
                    done = true;
                    break;
                }
            }
            if (done) break;
            if (ContractUtils.getTimeStamp() - startTime > 10) break;
            await ContractUtils.delay(1000);
        }

        if (signerItem !== undefined) {
            signerItem.using = true;
            signerItem.signer = new NonceManager(
                new GasPriceManager(new Wallet(this._config.relay.managerKeys[signerItem.index], hre.ethers.provider))
            );
        } else {
            signerItem = this._signers[0];
            signerItem.using = true;
            signerItem.signer = new NonceManager(
                new GasPriceManager(new Wallet(this._config.relay.managerKeys[signerItem.index], hre.ethers.provider))
            );
        }

        return signerItem;
    }

    /***
     * 트팬잭션을 중계할 때 사용될 서명자
     * @private
     */
    public releaseSigner(signer: ISignerItem) {
        signer.using = false;
    }
}
