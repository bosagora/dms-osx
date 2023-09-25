import {
    AddedShop as AddedShopEvent,
    IncreasedClearedPoint as IncreasedClearedPointEvent,
    IncreasedProvidedPoint as IncreasedProvidedPointEvent,
    IncreasedUsedPoint as IncreasedUsedPointEvent,
} from "../generated/ShopCollection/ShopCollection";
import { Shop, ShopTradeHistory } from "../generated/schema";
import { BigInt } from "@graphprotocol/graph-ts";
import { AmountUnit } from "./utils";

export function handleAddedShop(event: AddedShopEvent): void {
    let entity = new Shop(event.params.shopId);

    entity.provideWaitTime = event.params.provideWaitTime;
    entity.email = event.params.email;

    entity.providedPoint = BigInt.fromI32(0);
    entity.usedPoint = BigInt.fromI32(0);
    entity.clearedPoint = BigInt.fromI32(0);

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();
}

export function handleIncreasedClearedPoint(event: IncreasedClearedPointEvent): void {
    let entity = new ShopTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.action = "ClearedPoint";
    entity.shopId = event.params.shopId;
    entity.purchaseId = event.params.purchaseId;
    entity.increase = event.params.increase.div(AmountUnit);
    entity.clearedPoint = event.params.total.div(AmountUnit);

    let shopEntity = Shop.load(event.params.shopId);
    if (shopEntity !== null) {
        entity.providedPoint = shopEntity.providedPoint;
        entity.usedPoint = shopEntity.usedPoint;
        shopEntity.clearedPoint = entity.clearedPoint;
        shopEntity.blockNumber = event.block.number;
        shopEntity.blockTimestamp = event.block.timestamp;
        shopEntity.transactionHash = event.transaction.hash;
        shopEntity.save();
    } else {
        entity.providedPoint = BigInt.fromI32(0);
        entity.usedPoint = BigInt.fromI32(0);
    }

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();
}

export function handleIncreasedProvidedPoint(event: IncreasedProvidedPointEvent): void {
    let entity = new ShopTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.action = "ProvidedPoint";
    entity.shopId = event.params.shopId;
    entity.purchaseId = event.params.purchaseId;
    entity.increase = event.params.increase.div(AmountUnit);
    entity.providedPoint = event.params.total.div(AmountUnit);

    let shopEntity = Shop.load(event.params.shopId);
    if (shopEntity !== null) {
        entity.usedPoint = shopEntity.usedPoint;
        entity.clearedPoint = shopEntity.clearedPoint;
        shopEntity.providedPoint = entity.providedPoint;
        shopEntity.blockNumber = event.block.number;
        shopEntity.blockTimestamp = event.block.timestamp;
        shopEntity.transactionHash = event.transaction.hash;
        shopEntity.save();
    } else {
        entity.usedPoint = BigInt.fromI32(0);
        entity.clearedPoint = BigInt.fromI32(0);
    }

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();
}

export function handleIncreasedUsedPoint(event: IncreasedUsedPointEvent): void {
    let entity = new ShopTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.action = "UsedPoint";
    entity.shopId = event.params.shopId;
    entity.purchaseId = event.params.purchaseId;
    entity.increase = event.params.increase.div(AmountUnit);
    entity.usedPoint = event.params.total.div(AmountUnit);

    let shopEntity = Shop.load(event.params.shopId);
    if (shopEntity !== null) {
        entity.providedPoint = shopEntity.providedPoint;
        entity.clearedPoint = shopEntity.clearedPoint;
        shopEntity.usedPoint = entity.usedPoint;
        shopEntity.blockNumber = event.block.number;
        shopEntity.blockTimestamp = event.block.timestamp;
        shopEntity.transactionHash = event.transaction.hash;
        shopEntity.save();
    } else {
        entity.providedPoint = BigInt.fromI32(0);
        entity.clearedPoint = BigInt.fromI32(0);
    }

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();
}
