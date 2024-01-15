export interface ContractPurchaseBlockHeader {
    height: bigint;
    currentBlockHash: string;
    previousBlockHash: string;
    merkelRootHash: string;
    timestamp: bigint;
    CID: string;
}

export interface IExchangeRate {
    symbol: string;
    rate: bigint;
}

export enum PurchaseTransactionStep {
    RECEIVED = 0,
    INCLUDED = 1,
    APPROVED = 2,
    EXECUTED = 3,
    CANCELED = 4,
}
