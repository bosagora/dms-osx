export enum BlockElementType {
    PURCHASE = 0,
    EXCHANGE_RATE = 1,
    BURN_POINT = 2,
}

export interface IBlockElement {
    height: bigint;
    type: BlockElementType;
    branchIndex: number;
}

export interface IBlockElementProof extends IBlockElement {
    account: string;
    signature: string;
}
