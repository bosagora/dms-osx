import { JSONValidator } from "./JSONValidator";

import { defaultAbiCoder } from "@ethersproject/abi";
import { Signer } from "@ethersproject/abstract-signer";
import { BigNumber } from "@ethersproject/bignumber";
import { arrayify } from "@ethersproject/bytes";
import { HashZero } from "@ethersproject/constants";
import { keccak256 } from "@ethersproject/keccak256";
import { BranchSignature } from "./BranchSignature";

export class ExchangeRate {
    public symbol: string;
    public rate: BigNumber;

    constructor(symbol: string, rate: BigNumber) {
        this.symbol = symbol;
        this.rate = BigNumber.from(rate);
    }

    public static reviver(key: string, value: any): any {
        if (key !== "") return value;
        JSONValidator.isValidOtherwiseThrow("ExchangeRate", value);
        return new ExchangeRate(value.symbol, BigNumber.from(value.rate));
    }

    public toJSON(): any {
        return {
            symbol: this.symbol,
            rate: this.rate.toString(),
        };
    }

    public clone(): ExchangeRate {
        return new ExchangeRate(this.symbol, this.rate);
    }

    public computeHash(): string {
        const encodedData = defaultAbiCoder.encode(["string", "uint256"], [this.symbol, this.rate]);
        return keccak256(encodedData);
    }
}

export class ExchangeRateBranch {
    static MAX_ITEM_COUNT: number = 64;
    public items: ExchangeRate[];

    constructor(items?: ExchangeRate[], signature?: string[]) {
        this.items = items !== undefined ? items : [];
    }

    public static reviver(key: string, value: any): any {
        if (key !== "") return value;
        JSONValidator.isValidOtherwiseThrow("ExchangeRateBranch", value);
        const purchases: ExchangeRate[] = [];
        for (const elem of value.items) {
            purchases.push(ExchangeRate.reviver("", elem));
        }
        return new ExchangeRateBranch(purchases, value.signatures);
    }

    public toJSON(): any {
        return {
            items: this.items,
        };
    }

    public computeHash(height: bigint): string {
        if (this.items.length > 0)
            return keccak256(
                defaultAbiCoder.encode(
                    ["uint256", "uint256", "bytes32[]"],
                    [height, this.items.length, this.items.map((m) => m.computeHash())]
                )
            );
        else return HashZero;
    }

    public async sign(signer: Signer, height: bigint): Promise<string> {
        return signer.signMessage(arrayify(this.computeHash(height)));
    }
}

export class ExchangeRateRoot {
    public branches: ExchangeRateBranch[];
    public signatures: BranchSignature[];

    constructor(branches?: ExchangeRateBranch[], signatures?: BranchSignature[]) {
        this.branches = branches !== undefined ? branches : [];
        this.signatures = signatures !== undefined ? signatures : [];
    }

    public static reviver(key: string, value: any): any {
        if (key !== "") return value;
        JSONValidator.isValidOtherwiseThrow("ExchangeRateRoot", value);
        const branches: ExchangeRateBranch[] = [];
        for (const elem of value.branches) {
            branches.push(ExchangeRateBranch.reviver("", elem));
        }
        return new ExchangeRateRoot(branches);
    }

    public toJSON(): any {
        return {
            branches: this.branches,
            signatures: this.signatures,
        };
    }

    public computeHash(height: bigint): string {
        if (this.branches.length > 0)
            return keccak256(
                defaultAbiCoder.encode(
                    ["uint256", "uint256", "bytes32[]"],
                    [height, this.branches.length, this.branches.map((m) => m.computeHash(height))]
                )
            );
        else return HashZero;
    }

    public addItem(data: ExchangeRate) {
        let branch = this.branches.find((m) => m.items.length < ExchangeRateBranch.MAX_ITEM_COUNT);
        if (branch === undefined) {
            branch = new ExchangeRateBranch();
            this.branches.push(branch);
        }
        branch.items.push(data);
    }
}
