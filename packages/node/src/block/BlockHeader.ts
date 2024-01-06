import { JSONValidator } from "./JSONValidator";

import { defaultAbiCoder } from "@ethersproject/abi";
import { Signer } from "@ethersproject/abstract-signer";
import { arrayify } from "@ethersproject/bytes";
import { HashZero } from "@ethersproject/constants";
import { keccak256 } from "@ethersproject/keccak256";

export class BlockHeader {
    public prevBlockHash: string;
    public purchaseHash: string;
    public exchangeRateHash: string;
    public burnPointHash: string;
    public height: bigint;
    public timestamp: bigint;
    public signature: string;

    constructor(
        prevBlockHash: string,
        height: bigint,
        timestamp: bigint,
        purchaseHash?: string,
        exchangeRateHash?: string,
        burnPointHash?: string,
        signature?: string
    ) {
        this.prevBlockHash = prevBlockHash;
        this.height = height;
        this.timestamp = timestamp;
        this.purchaseHash = purchaseHash !== undefined ? purchaseHash : HashZero;
        this.exchangeRateHash = exchangeRateHash !== undefined ? exchangeRateHash : HashZero;
        this.burnPointHash = burnPointHash !== undefined ? burnPointHash : HashZero;
        this.signature = signature !== undefined ? signature : HashZero;
    }

    public static reviver(key: string, value: any): any {
        if (key !== "") return value;

        JSONValidator.isValidOtherwiseThrow("BlockHeader", value);

        return new BlockHeader(
            value.prevBlockHash,
            BigInt(value.height),
            BigInt(value.timestamp),
            value.purchaseHash,
            value.exchangeRateHash,
            value.burnPointHash
        );
    }

    public toJSON(): any {
        return {
            prevBlockHash: this.prevBlockHash,
            height: this.height.toString(),
            timestamp: this.timestamp.toString(),
            purchaseHash: this.purchaseHash,
            exchangeRateHash: this.exchangeRateHash,
            burnPointHash: this.burnPointHash,
            signature: this.signature,
        };
    }

    public computeHash(): string {
        const encodedData = defaultAbiCoder.encode(
            ["bytes32", "uint256", "uint256", "bytes32", "bytes32", "bytes32"],
            [
                this.prevBlockHash,
                this.height,
                this.timestamp,
                this.purchaseHash,
                this.exchangeRateHash,
                this.burnPointHash,
            ]
        );
        return keccak256(encodedData);
    }

    public async sign(signer: Signer) {
        this.signature = await signer.signMessage(arrayify(this.computeHash()));
    }
}
