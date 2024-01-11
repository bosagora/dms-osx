import { ContractUtils } from "../../utils/ContractUtils";
import { BlockHeader, BurnPointRoot, ExchangeRateRoot, PurchaseRoot } from "./";
import { JSONValidator } from "./JSONValidator";

export class Block {
    public header: BlockHeader;
    public purchases: PurchaseRoot;
    public exchangeRates: ExchangeRateRoot;
    public burnPoints: BurnPointRoot;

    constructor(
        header: BlockHeader,
        purchases: PurchaseRoot,
        exchangeRates: ExchangeRateRoot,
        burnPoints: BurnPointRoot
    ) {
        this.header = header;
        this.purchases = purchases;
        this.exchangeRates = exchangeRates;
        this.burnPoints = burnPoints;
    }

    public static reviver(key: string, value: any): any {
        if (key !== "") return value;
        JSONValidator.isValidOtherwiseThrow("Block", value);
        return new Block(
            BlockHeader.reviver("", value.header),
            PurchaseRoot.reviver("", value.purchases),
            ExchangeRateRoot.reviver("", value.exchangeRates),
            BurnPointRoot.reviver("", value.burnPoints)
        );
    }

    public toJSON(): any {
        return {
            header: this.header,
            purchases: this.purchases,
            exchangeRates: this.exchangeRates,
            burnPoints: this.burnPoints,
        };
    }

    public static createBlock(
        prevHash: string,
        prevSlot: bigint,
        purchases: PurchaseRoot,
        exchangeRates: ExchangeRateRoot,
        burnPoints: BurnPointRoot
    ): Block {
        const slot = prevSlot + 1n;
        const purchaseHash = purchases.computeHash(slot);
        const exchangeRateHash = exchangeRates.computeHash(slot);
        const burnPointHash = burnPoints.computeHash(slot);

        const blockHeader = new BlockHeader(
            prevHash,
            slot,
            BigInt(ContractUtils.getTimeStamp()),
            purchaseHash,
            exchangeRateHash,
            burnPointHash
        );
        return new Block(blockHeader, purchases, exchangeRates, burnPoints);
    }

    public static createBlankBlock(prevHash: string, prevSlot: bigint, timestamp: bigint): Block {
        const slot = prevSlot + 1n;

        const blockHeader = new BlockHeader(prevHash, slot, timestamp);
        return new Block(blockHeader, new PurchaseRoot(), new ExchangeRateRoot(), new BurnPointRoot());
    }

    public computeHash(): string {
        return this.header.computeHash();
    }
}
