import { JSONValidator } from "./JSONValidator";

export interface IBranchSignature {
    branchIndex: number;
    signature: string;
}

export interface IBranchSignatureWithAccount extends IBranchSignature {
    account: string;
}

export class BranchSignature implements IBranchSignature {
    public branchIndex: number;
    public signature: string;

    constructor(branchIndex: number, signature: string) {
        this.branchIndex = branchIndex;
        this.signature = signature;
    }

    public static reviver(key: string, value: any): any {
        if (key !== "") return value;
        JSONValidator.isValidOtherwiseThrow("BranchSignature", value);
        return new BranchSignature(value.branchIndex, value.signature);
    }

    public toJSON(): any {
        return {
            branchIndex: this.branchIndex,
            signature: this.signature,
        };
    }
}
