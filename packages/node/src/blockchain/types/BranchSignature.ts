export interface BranchSignature {
    branchIndex: number;
    signature: string;
}

export interface BranchSignatureWithAccount extends BranchSignature {
    account: string;
}
