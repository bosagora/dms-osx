import {
    AddedShop as AddedShopEvent,
    ChangedShopStatus as ChangedShopStatusEvent,
    IncreasedProvidedAmount as IncreasedProvidedAmountEvent,
    IncreasedUsedAmount as IncreasedUsedAmountEvent,
    DecreasedUsedAmount as DecreasedUsedAmountEvent,
    UpdatedShop as UpdatedShopEvent,
    Refunded as RefundedEvent,
} from "../generated/Shop/Shop";
import { Shop, ShopTradeHistory } from "../generated/schema";
import { BigInt } from "@graphprotocol/graph-ts";
import { AmountUnit } from "./utils";

enum ShopAction {
    NONE = 0,
    PROVIDED = 1,
    USED = 2,
    REFUNDED = 3,
}

enum ShopDataAction {
    CREATED,
    UPDATED,
}

export function handleAddedShop(event: AddedShopEvent): void {
    let entity = new Shop(event.params.shopId);

    entity.name = event.params.name;
    entity.currency = event.params.currency;
    entity.status = event.params.status;
    entity.account = event.params.account;
    entity.action = ShopDataAction.CREATED;

    entity.providedAmount = BigInt.fromI32(0);
    entity.usedAmount = BigInt.fromI32(0);
    entity.refundedAmount = BigInt.fromI32(0);

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();
}

export function handleUpdatedShop(event: UpdatedShopEvent): void {
    let shopEntity = Shop.load(event.params.shopId);
    if (shopEntity !== null) {
        shopEntity.name = event.params.name;
        shopEntity.currency = event.params.currency;
        shopEntity.status = event.params.status;
        shopEntity.action = ShopDataAction.UPDATED;

        shopEntity.blockNumber = event.block.number;
        shopEntity.blockTimestamp = event.block.timestamp;
        shopEntity.transactionHash = event.transaction.hash;
        shopEntity.save();
    }
}

export function handleChangedShopStatus(event: ChangedShopStatusEvent): void {
    let shopEntity = Shop.load(event.params.shopId);
    if (shopEntity !== null) {
        shopEntity.status = event.params.status;
        shopEntity.action = ShopDataAction.UPDATED;

        shopEntity.blockNumber = event.block.number;
        shopEntity.blockTimestamp = event.block.timestamp;
        shopEntity.transactionHash = event.transaction.hash;
        shopEntity.save();
    }
}

export function handleIncreasedProvidedAmount(event: IncreasedProvidedAmountEvent): void {
    let entity = new ShopTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));

    entity.shopId = event.params.shopId;
    entity.action = ShopAction.PROVIDED;
    entity.cancel = false;
    entity.increase = event.params.increase.div(AmountUnit);
    entity.providedAmount = event.params.total.div(AmountUnit);
    entity.currency = event.params.currency;
    entity.purchaseId = event.params.purchaseId;

    let shopEntity = Shop.load(event.params.shopId);
    if (shopEntity !== null) {
        entity.usedAmount = shopEntity.usedAmount;
        entity.refundedAmount = shopEntity.refundedAmount;
        shopEntity.providedAmount = entity.providedAmount;
        shopEntity.blockNumber = event.block.number;
        shopEntity.blockTimestamp = event.block.timestamp;
        shopEntity.transactionHash = event.transaction.hash;
        shopEntity.save();
    } else {
        entity.usedAmount = BigInt.fromI32(0);
        entity.refundedAmount = BigInt.fromI32(0);
    }

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();
}

export function handleIncreasedUsedAmount(event: IncreasedUsedAmountEvent): void {
    let entity = new ShopTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.shopId = event.params.shopId;
    entity.action = ShopAction.USED;
    entity.cancel = false;
    entity.increase = event.params.increase.div(AmountUnit);
    entity.usedAmount = event.params.total.div(AmountUnit);
    entity.currency = event.params.currency;
    entity.purchaseId = event.params.purchaseId;
    entity.paymentId = event.params.paymentId;

    let shopEntity = Shop.load(event.params.shopId);
    if (shopEntity !== null) {
        entity.providedAmount = shopEntity.providedAmount;
        entity.refundedAmount = shopEntity.refundedAmount;
        shopEntity.usedAmount = entity.usedAmount;
        shopEntity.blockNumber = event.block.number;
        shopEntity.blockTimestamp = event.block.timestamp;
        shopEntity.transactionHash = event.transaction.hash;
        shopEntity.save();
    } else {
        entity.providedAmount = BigInt.fromI32(0);
        entity.refundedAmount = BigInt.fromI32(0);
    }

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();
}

export function handleDecreasedUsedAmount(event: DecreasedUsedAmountEvent): void {
    let entity = new ShopTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.shopId = event.params.shopId;
    entity.action = ShopAction.USED;
    entity.cancel = true;
    entity.increase = event.params.increase.div(AmountUnit);
    entity.usedAmount = event.params.total.div(AmountUnit);
    entity.currency = event.params.currency;
    entity.purchaseId = event.params.purchaseId;
    entity.paymentId = event.params.paymentId;

    let shopEntity = Shop.load(event.params.shopId);
    if (shopEntity !== null) {
        entity.providedAmount = shopEntity.providedAmount;
        entity.refundedAmount = shopEntity.refundedAmount;
        shopEntity.usedAmount = entity.usedAmount;
        shopEntity.blockNumber = event.block.number;
        shopEntity.blockTimestamp = event.block.timestamp;
        shopEntity.transactionHash = event.transaction.hash;
        shopEntity.save();
    } else {
        entity.providedAmount = BigInt.fromI32(0);
        entity.refundedAmount = BigInt.fromI32(0);
    }

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();
}

export function handleRefunded(event: RefundedEvent): void {
    let entity = new ShopTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.shopId = event.params.shopId;
    entity.action = ShopAction.REFUNDED;
    entity.cancel = false;
    entity.increase = event.params.refundAmount.div(AmountUnit);
    entity.currency = event.params.currency;

    let shopEntity = Shop.load(event.params.shopId);
    if (shopEntity !== null) {
        entity.providedAmount = shopEntity.providedAmount;
        entity.usedAmount = shopEntity.usedAmount;
        entity.refundedAmount = event.params.refundedTotal.div(AmountUnit);
        shopEntity.blockNumber = event.block.number;
        shopEntity.blockTimestamp = event.block.timestamp;
        shopEntity.transactionHash = event.transaction.hash;
        shopEntity.save();
    } else {
        entity.providedAmount = BigInt.fromI32(0);
        entity.usedAmount = BigInt.fromI32(0);
        entity.refundedAmount = event.params.refundedTotal.div(AmountUnit);
    }

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();
}
