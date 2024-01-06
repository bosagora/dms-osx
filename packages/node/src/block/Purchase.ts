import { JSONValidator } from "./JSONValidator";

import { defaultAbiCoder } from "@ethersproject/abi";
import { Signer } from "@ethersproject/abstract-signer";
import { BigNumber } from "@ethersproject/bignumber";
import { arrayify } from "@ethersproject/bytes";
import { HashZero } from "@ethersproject/constants";
import { keccak256 } from "@ethersproject/keccak256";
import { BranchSignature } from "./Types";

export class Purchase {
    public purchaseId: string;
    public amount: BigNumber;
    public loyalty: BigNumber;
    public currency: string;
    public shopId: string;
    public account: string;
    public phone: string;

    constructor(
        purchaseId: string,
        amount: BigNumber,
        loyalty: BigNumber,
        currency: string,
        shopId: string,
        account: string,
        phone: string
    ) {
        this.purchaseId = purchaseId;
        this.amount = BigNumber.from(amount);
        this.loyalty = BigNumber.from(loyalty);
        this.currency = currency;
        this.shopId = shopId;
        this.account = account;
        this.phone = phone;
    }

    public static reviver(key: string, value: any): any {
        if (key !== "") return value;

        JSONValidator.isValidOtherwiseThrow("Purchase", value);

        return new Purchase(
            value.purchaseId,
            BigNumber.from(value.amount),
            BigNumber.from(value.loyalty),
            value.currency,
            value.shopId,
            value.account,
            value.phone
        );
    }

    public toJSON(): any {
        return {
            purchaseId: this.purchaseId,
            amount: this.amount.toString(),
            loyalty: this.loyalty.toString(),
            currency: this.currency,
            shopId: this.shopId,
            account: this.account,
            phone: this.phone,
        };
    }

    public clone(): Purchase {
        return new Purchase(
            this.purchaseId,
            this.amount,
            this.loyalty,
            this.currency,
            this.shopId,
            this.account,
            this.phone
        );
    }

    public computeHash(): string {
        const encodedData = defaultAbiCoder.encode(
            ["string", "uint256", "uint256", "string", "bytes32", "address", "bytes32"],
            [this.purchaseId, this.amount, this.loyalty, this.currency, this.shopId, this.account, this.phone]
        );
        return keccak256(encodedData);
    }
}

export class PurchaseBranch {
    static MAX_ITEM_COUNT: number = 64;
    public items: Purchase[];

    constructor(items?: Purchase[], signature?: string[]) {
        this.items = items !== undefined ? items : [];
    }

    public static reviver(key: string, value: any): any {
        if (key !== "") return value;
        JSONValidator.isValidOtherwiseThrow("PurchaseBranch", value);
        const purchases: Purchase[] = [];
        for (const elem of value.purchases) {
            purchases.push(Purchase.reviver("", elem));
        }
        return new PurchaseBranch(purchases);
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

export class PurchaseRoot {
    public branches: PurchaseBranch[];
    public signatures: BranchSignature[];

    constructor(branches?: PurchaseBranch[], signatures?: BranchSignature[]) {
        this.branches = branches !== undefined ? branches : [];
        this.signatures = signatures !== undefined ? signatures : [];
    }

    public static reviver(key: string, value: any): any {
        if (key !== "") return value;
        JSONValidator.isValidOtherwiseThrow("PurchaseRoot", value);
        const branches: PurchaseBranch[] = [];
        for (const elem of value.branches) {
            branches.push(PurchaseBranch.reviver("", elem));
        }
        return new PurchaseRoot(branches);
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

    public addItem(data: Purchase) {
        let branch = this.branches.find((m) => m.items.length < PurchaseBranch.MAX_ITEM_COUNT);
        if (branch === undefined) {
            branch = new PurchaseBranch();
            this.branches.push(branch);
        }
        branch.items.push(data);
    }
}
