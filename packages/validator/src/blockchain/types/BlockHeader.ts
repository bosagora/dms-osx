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
    public slot: bigint;
    public timestamp: bigint;
    public signature: string;

    constructor(
        prevBlockHash: string,
        slot: bigint,
        timestamp: bigint,
        purchaseHash?: string,
        exchangeRateHash?: string,
        burnPointHash?: string,
        signature?: string
    ) {
        this.prevBlockHash = prevBlockHash;
        this.slot = slot;
        this.timestamp = timestamp;
        this.purchaseHash = purchaseHash !== undefined ? purchaseHash : HashZero;
        this.exchangeRateHash = exchangeRateHash !== undefined ? exchangeRateHash : HashZero;
        this.burnPointHash = burnPointHash !== undefined ? burnPointHash : HashZero;
        this.signature = signature !== undefined ? signature : HashZero;
    }

    public static reviver(key: string, value: any): any {
        if (key !== "") return value;

        JSONValidator.isValidOtherwiseThrow("BlockHeader", value);
        JSONValidator.verifyHash(value.prevBlockHash);
        JSONValidator.verifyHash(value.purchaseHash);
        JSONValidator.verifyHash(value.exchangeRateHash);
        JSONValidator.verifyHash(value.burnPointHash);
        JSONValidator.verifySignature(value.signature);
        JSONValidator.verifyNumber(value.slot);
        JSONValidator.verifyNumber(value.timestamp);

        return new BlockHeader(
            value.prevBlockHash,
            BigInt(value.slot),
            BigInt(value.timestamp),
            value.purchaseHash,
            value.exchangeRateHash,
            value.burnPointHash,
            value.signature
        );
    }

    public toJSON(): any {
        return {
            prevBlockHash: this.prevBlockHash,
            slot: this.slot.toString(),
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
                this.slot,
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
