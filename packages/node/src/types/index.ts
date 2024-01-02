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
