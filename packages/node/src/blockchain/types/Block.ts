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

    public static createBlock(
        prevHash: string,
        prevHeight: bigint,
        purchases: PurchaseRoot,
        exchangeRates: ExchangeRateRoot,
        burnPoints: BurnPointRoot
    ): Block {
        const height = prevHeight + 1n;
        const purchaseHash = purchases.computeHash(height);
        const exchangeRateHash = exchangeRates.computeHash(height);
        const burnPointHash = burnPoints.computeHash(height);

        const blockHeader = new BlockHeader(
            prevHash,
            height,
            BigInt(ContractUtils.getTimeStamp()),
            purchaseHash,
            exchangeRateHash,
            burnPointHash
        );
        return new Block(blockHeader, purchases, exchangeRates, burnPoints);
    }

    public static createBlankBlock(prevHash: string, prevHeight: bigint): Block {
        const height = prevHeight + 1n;

        const blockHeader = new BlockHeader(prevHash, height, BigInt(ContractUtils.getTimeStamp()));
        return new Block(blockHeader, new PurchaseRoot(), new ExchangeRateRoot(), new BurnPointRoot());
    }

    public computeHash(): string {
        return this.header.computeHash();
    }
}
