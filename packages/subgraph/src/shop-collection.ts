import {
    AddedShop as AddedShopEvent,
    ChangedShopStatus as ChangedShopStatusEvent,
    IncreasedSettledPoint as IncreasedSettledPointEvent,
    IncreasedProvidedPoint as IncreasedProvidedPointEvent,
    IncreasedUsedPoint as IncreasedUsedPointEvent,
    DecreasedUsedPoint as DecreasedUsedPointEvent,
    UpdatedShop as UpdatedShopEvent,
    ClosedWithdrawal as ClosedWithdrawalEvent,
    OpenedWithdrawal as OpenedWithdrawalEvent,
} from "../generated/ShopCollection/ShopCollection";
import { Shop, ShopTradeHistory } from "../generated/schema";
import { BigInt } from "@graphprotocol/graph-ts";
import { AmountUnit, NullBytes32 } from "./utils";

enum PageType {
    NONE = 0,
    PROVIDE_USE = 1,
    SETTLEMENT = 2,
    WITHDRAW = 3,
}

enum ShopAction {
    NONE = 0,
    PROVIDED = 1,
    USED = 2,
    SETTLED = 3,
    OPEN_WITHDRAWN = 11,
    CLOSE_WITHDRAWN = 12,
}

enum ShopDataAction {
    CREATED,
    UPDATED,
    REMOVED,
}

export function handleAddedShop(event: AddedShopEvent): void {
    let entity = new Shop(event.params.shopId);

    entity.name = event.params.name;
    entity.provideWaitTime = event.params.provideWaitTime;
    entity.providePercent = event.params.providePercent;
    entity.status = event.params.status;
    entity.account = event.params.account;
    entity.action = ShopDataAction.CREATED;

    entity.providedPoint = BigInt.fromI32(0);
    entity.usedPoint = BigInt.fromI32(0);
    entity.settledPoint = BigInt.fromI32(0);
    entity.withdrawnPoint = BigInt.fromI32(0);

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();
}

export function handleUpdatedShop(event: UpdatedShopEvent): void {
    let shopEntity = Shop.load(event.params.shopId);
    if (shopEntity !== null) {
        shopEntity.name = event.params.name;
        shopEntity.provideWaitTime = event.params.provideWaitTime;
        shopEntity.providePercent = event.params.providePercent;
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

export function handleIncreasedSettledPoint(event: IncreasedSettledPointEvent): void {
    let entity = new ShopTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.shopId = event.params.shopId;
    entity.pageType = PageType.SETTLEMENT;
    entity.action = ShopAction.SETTLED;
    entity.cancel = false;
    entity.increase = event.params.increase.div(AmountUnit);
    entity.settledPoint = event.params.total.div(AmountUnit);
    entity.purchaseId = event.params.purchaseId;

    let shopEntity = Shop.load(event.params.shopId);
    if (shopEntity !== null) {
        entity.providedPoint = shopEntity.providedPoint;
        entity.usedPoint = shopEntity.usedPoint;
        entity.withdrawnPoint = shopEntity.withdrawnPoint;
        shopEntity.settledPoint = entity.settledPoint;
        shopEntity.blockNumber = event.block.number;
        shopEntity.blockTimestamp = event.block.timestamp;
        shopEntity.transactionHash = event.transaction.hash;
        shopEntity.save();
    } else {
        entity.providedPoint = BigInt.fromI32(0);
        entity.usedPoint = BigInt.fromI32(0);
        entity.withdrawnPoint = BigInt.fromI32(0);
    }

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();
}

export function handleIncreasedProvidedPoint(event: IncreasedProvidedPointEvent): void {
    let entity = new ShopTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));

    entity.shopId = event.params.shopId;
    entity.pageType = PageType.PROVIDE_USE;
    entity.action = ShopAction.PROVIDED;
    entity.cancel = false;
    entity.increase = event.params.increase.div(AmountUnit);
    entity.providedPoint = event.params.total.div(AmountUnit);
    entity.purchaseId = event.params.purchaseId;

    let shopEntity = Shop.load(event.params.shopId);
    if (shopEntity !== null) {
        entity.usedPoint = shopEntity.usedPoint;
        entity.settledPoint = shopEntity.settledPoint;
        entity.withdrawnPoint = shopEntity.withdrawnPoint;
        shopEntity.providedPoint = entity.providedPoint;
        shopEntity.blockNumber = event.block.number;
        shopEntity.blockTimestamp = event.block.timestamp;
        shopEntity.transactionHash = event.transaction.hash;
        shopEntity.save();
    } else {
        entity.usedPoint = BigInt.fromI32(0);
        entity.settledPoint = BigInt.fromI32(0);
        entity.withdrawnPoint = BigInt.fromI32(0);
    }

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();
}

export function handleIncreasedUsedPoint(event: IncreasedUsedPointEvent): void {
    let entity = new ShopTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.shopId = event.params.shopId;
    entity.pageType = PageType.PROVIDE_USE;
    entity.action = ShopAction.USED;
    entity.cancel = false;
    entity.increase = event.params.increase.div(AmountUnit);
    entity.usedPoint = event.params.total.div(AmountUnit);
    entity.purchaseId = event.params.purchaseId;
    entity.paymentId = event.params.paymentId;

    let shopEntity = Shop.load(event.params.shopId);
    if (shopEntity !== null) {
        entity.providedPoint = shopEntity.providedPoint;
        entity.settledPoint = shopEntity.settledPoint;
        entity.withdrawnPoint = shopEntity.withdrawnPoint;
        shopEntity.usedPoint = entity.usedPoint;
        shopEntity.blockNumber = event.block.number;
        shopEntity.blockTimestamp = event.block.timestamp;
        shopEntity.transactionHash = event.transaction.hash;
        shopEntity.save();
    } else {
        entity.providedPoint = BigInt.fromI32(0);
        entity.settledPoint = BigInt.fromI32(0);
        entity.withdrawnPoint = BigInt.fromI32(0);
    }

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();
}

export function handleDecreasedUsedPoint(event: DecreasedUsedPointEvent): void {
    let entity = new ShopTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.shopId = event.params.shopId;
    entity.pageType = PageType.PROVIDE_USE;
    entity.action = ShopAction.USED;
    entity.cancel = true;
    entity.increase = event.params.increase.div(AmountUnit);
    entity.usedPoint = event.params.total.div(AmountUnit);
    entity.purchaseId = event.params.purchaseId;
    entity.paymentId = event.params.paymentId;

    let shopEntity = Shop.load(event.params.shopId);
    if (shopEntity !== null) {
        entity.providedPoint = shopEntity.providedPoint;
        entity.settledPoint = shopEntity.settledPoint;
        entity.withdrawnPoint = shopEntity.withdrawnPoint;
        shopEntity.usedPoint = entity.usedPoint;
        shopEntity.blockNumber = event.block.number;
        shopEntity.blockTimestamp = event.block.timestamp;
        shopEntity.transactionHash = event.transaction.hash;
        shopEntity.save();
    } else {
        entity.providedPoint = BigInt.fromI32(0);
        entity.settledPoint = BigInt.fromI32(0);
        entity.withdrawnPoint = BigInt.fromI32(0);
    }

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();
}

export function handleOpenedWithdrawal(event: OpenedWithdrawalEvent): void {
    let entity = new ShopTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.shopId = event.params.shopId;
    entity.pageType = PageType.WITHDRAW;
    entity.action = ShopAction.OPEN_WITHDRAWN;
    entity.cancel = false;
    entity.increase = event.params.amount.div(AmountUnit);

    let shopEntity = Shop.load(event.params.shopId);
    if (shopEntity !== null) {
        entity.providedPoint = shopEntity.providedPoint;
        entity.usedPoint = shopEntity.usedPoint;
        entity.settledPoint = shopEntity.settledPoint;
        entity.withdrawnPoint = shopEntity.withdrawnPoint;
        shopEntity.blockNumber = event.block.number;
        shopEntity.blockTimestamp = event.block.timestamp;
        shopEntity.transactionHash = event.transaction.hash;
        shopEntity.save();
    } else {
        entity.providedPoint = BigInt.fromI32(0);
        entity.settledPoint = BigInt.fromI32(0);
        entity.usedPoint = BigInt.fromI32(0);
        entity.withdrawnPoint = BigInt.fromI32(0);
    }

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();
}

export function handleClosedWithdrawal(event: ClosedWithdrawalEvent): void {
    let entity = new ShopTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.shopId = event.params.shopId;
    entity.pageType = PageType.WITHDRAW;
    entity.action = ShopAction.CLOSE_WITHDRAWN;
    entity.cancel = false;
    entity.increase = event.params.amount.div(AmountUnit);
    entity.withdrawnPoint = event.params.total.div(AmountUnit);

    let shopEntity = Shop.load(event.params.shopId);
    if (shopEntity !== null) {
        entity.providedPoint = shopEntity.providedPoint;
        entity.settledPoint = shopEntity.settledPoint;
        entity.usedPoint = shopEntity.usedPoint;
        shopEntity.withdrawnPoint = entity.withdrawnPoint;
        shopEntity.blockNumber = event.block.number;
        shopEntity.blockTimestamp = event.block.timestamp;
        shopEntity.transactionHash = event.transaction.hash;
        shopEntity.save();
    } else {
        entity.providedPoint = BigInt.fromI32(0);
        entity.settledPoint = BigInt.fromI32(0);
        entity.usedPoint = BigInt.fromI32(0);
    }

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();
}
