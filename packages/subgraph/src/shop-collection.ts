import {
    AddedShop as AddedShopEvent,
    IncreasedSettledPoint as IncreasedSettledPointEvent,
    IncreasedProvidedPoint as IncreasedProvidedPointEvent,
    IncreasedUsedPoint as IncreasedUsedPointEvent,
    UpdatedShop as UpdatedShopEvent,
} from "../generated/ShopCollection/ShopCollection";
import { Shop, ShopTradeHistory } from "../generated/schema";
import { BigInt } from "@graphprotocol/graph-ts";
import { AmountUnit } from "./utils";

export function handleAddedShop(event: AddedShopEvent): void {
    let entity = new Shop(event.params.shopId);

    entity.provideWaitTime = event.params.provideWaitTime;
    entity.providePercent = event.params.providePercent;
    entity.phone = event.params.phone;

    entity.providedPoint = BigInt.fromI32(0);
    entity.usedPoint = BigInt.fromI32(0);
    entity.settledPoint = BigInt.fromI32(0);

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();
}

export function handleUpdatedShop(event: UpdatedShopEvent): void {
    let shopEntity = Shop.load(event.params.shopId);
    if (shopEntity !== null) {
        shopEntity.phone = event.params.phone;
        shopEntity.provideWaitTime = event.params.provideWaitTime;
        shopEntity.providePercent = event.params.providePercent;

        shopEntity.blockNumber = event.block.number;
        shopEntity.blockTimestamp = event.block.timestamp;
        shopEntity.transactionHash = event.transaction.hash;
        shopEntity.save();
    }
}

export function handleIncreasedSettledPoint(event: IncreasedSettledPointEvent): void {
    let entity = new ShopTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.action = "SettledPoint";
    entity.shopId = event.params.shopId;
    entity.purchaseId = event.params.purchaseId;
    entity.increase = event.params.increase.div(AmountUnit);
    entity.settledPoint = event.params.total.div(AmountUnit);

    let shopEntity = Shop.load(event.params.shopId);
    if (shopEntity !== null) {
        entity.providedPoint = shopEntity.providedPoint;
        entity.usedPoint = shopEntity.usedPoint;
        shopEntity.settledPoint = entity.settledPoint;
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
        entity.settledPoint = shopEntity.settledPoint;
        shopEntity.providedPoint = entity.providedPoint;
        shopEntity.blockNumber = event.block.number;
        shopEntity.blockTimestamp = event.block.timestamp;
        shopEntity.transactionHash = event.transaction.hash;
        shopEntity.save();
    } else {
        entity.usedPoint = BigInt.fromI32(0);
        entity.settledPoint = BigInt.fromI32(0);
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
        entity.settledPoint = shopEntity.settledPoint;
        shopEntity.usedPoint = entity.usedPoint;
        shopEntity.blockNumber = event.block.number;
        shopEntity.blockTimestamp = event.block.timestamp;
        shopEntity.transactionHash = event.transaction.hash;
        shopEntity.save();
    } else {
        entity.providedPoint = BigInt.fromI32(0);
        entity.settledPoint = BigInt.fromI32(0);
    }

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();
}
