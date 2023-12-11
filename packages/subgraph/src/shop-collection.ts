import {
    AddedShop as AddedShopEvent,
    ChangedShopStatus as ChangedShopStatusEvent,
    IncreasedSettledAmount as IncreasedSettledAmountEvent,
    IncreasedProvidedAmount as IncreasedProvidedAmountEvent,
    IncreasedUsedAmount as IncreasedUsedAmountEvent,
    DecreasedUsedAmount as DecreasedUsedAmountEvent,
    UpdatedShop as UpdatedShopEvent,
    ClosedWithdrawal as ClosedWithdrawalEvent,
    OpenedWithdrawal as OpenedWithdrawalEvent,
} from "../generated/Shop/Shop";
import { Shop, ShopTradeHistory, ShopWithdraw, UserBalance } from "../generated/schema";
import { BigInt } from "@graphprotocol/graph-ts";
import { AmountUnit } from "./utils";

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

enum ShopWithdrawStatus {
    CLOSE = 0,
    OPEN = 1,
}

export function handleAddedShop(event: AddedShopEvent): void {
    let entity = new Shop(event.params.shopId);

    entity.name = event.params.name;
    entity.currency = event.params.currency;
    entity.provideWaitTime = event.params.provideWaitTime;
    entity.providePercent = event.params.providePercent;
    entity.status = event.params.status;
    entity.account = event.params.account;
    entity.action = ShopDataAction.CREATED;

    entity.providedAmount = BigInt.fromI32(0);
    entity.usedAmount = BigInt.fromI32(0);
    entity.settledAmount = BigInt.fromI32(0);
    entity.withdrawnAmount = BigInt.fromI32(0);

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

export function handleIncreasedSettledAmount(event: IncreasedSettledAmountEvent): void {
    let entity = new ShopTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.shopId = event.params.shopId;
    entity.pageType = PageType.SETTLEMENT;
    entity.action = ShopAction.SETTLED;
    entity.cancel = false;
    entity.increase = event.params.increase.div(AmountUnit);
    entity.settledAmount = event.params.total.div(AmountUnit);
    entity.currency = event.params.currency;
    entity.purchaseId = event.params.purchaseId;

    let shopEntity = Shop.load(event.params.shopId);
    if (shopEntity !== null) {
        entity.providedAmount = shopEntity.providedAmount;
        entity.usedAmount = shopEntity.usedAmount;
        entity.withdrawnAmount = shopEntity.withdrawnAmount;
        shopEntity.settledAmount = entity.settledAmount;
        shopEntity.blockNumber = event.block.number;
        shopEntity.blockTimestamp = event.block.timestamp;
        shopEntity.transactionHash = event.transaction.hash;
        shopEntity.save();
    } else {
        entity.providedAmount = BigInt.fromI32(0);
        entity.usedAmount = BigInt.fromI32(0);
        entity.withdrawnAmount = BigInt.fromI32(0);
    }

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();
}

export function handleIncreasedProvidedAmount(event: IncreasedProvidedAmountEvent): void {
    let entity = new ShopTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));

    entity.shopId = event.params.shopId;
    entity.pageType = PageType.PROVIDE_USE;
    entity.action = ShopAction.PROVIDED;
    entity.cancel = false;
    entity.increase = event.params.increase.div(AmountUnit);
    entity.providedAmount = event.params.total.div(AmountUnit);
    entity.currency = event.params.currency;
    entity.purchaseId = event.params.purchaseId;

    let shopEntity = Shop.load(event.params.shopId);
    if (shopEntity !== null) {
        entity.usedAmount = shopEntity.usedAmount;
        entity.settledAmount = shopEntity.settledAmount;
        entity.withdrawnAmount = shopEntity.withdrawnAmount;
        shopEntity.providedAmount = entity.providedAmount;
        shopEntity.blockNumber = event.block.number;
        shopEntity.blockTimestamp = event.block.timestamp;
        shopEntity.transactionHash = event.transaction.hash;
        shopEntity.save();
    } else {
        entity.usedAmount = BigInt.fromI32(0);
        entity.settledAmount = BigInt.fromI32(0);
        entity.withdrawnAmount = BigInt.fromI32(0);
    }

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();
}

export function handleIncreasedUsedAmount(event: IncreasedUsedAmountEvent): void {
    let entity = new ShopTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.shopId = event.params.shopId;
    entity.pageType = PageType.PROVIDE_USE;
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
        entity.settledAmount = shopEntity.settledAmount;
        entity.withdrawnAmount = shopEntity.withdrawnAmount;
        shopEntity.usedAmount = entity.usedAmount;
        shopEntity.blockNumber = event.block.number;
        shopEntity.blockTimestamp = event.block.timestamp;
        shopEntity.transactionHash = event.transaction.hash;
        shopEntity.save();
    } else {
        entity.providedAmount = BigInt.fromI32(0);
        entity.settledAmount = BigInt.fromI32(0);
        entity.withdrawnAmount = BigInt.fromI32(0);
    }

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();
}

export function handleDecreasedUsedAmount(event: DecreasedUsedAmountEvent): void {
    let entity = new ShopTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.shopId = event.params.shopId;
    entity.pageType = PageType.PROVIDE_USE;
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
        entity.settledAmount = shopEntity.settledAmount;
        entity.withdrawnAmount = shopEntity.withdrawnAmount;
        shopEntity.usedAmount = entity.usedAmount;
        shopEntity.blockNumber = event.block.number;
        shopEntity.blockTimestamp = event.block.timestamp;
        shopEntity.transactionHash = event.transaction.hash;
        shopEntity.save();
    } else {
        entity.providedAmount = BigInt.fromI32(0);
        entity.settledAmount = BigInt.fromI32(0);
        entity.withdrawnAmount = BigInt.fromI32(0);
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
    entity.currency = event.params.currency;

    let shopEntity = Shop.load(event.params.shopId);
    if (shopEntity !== null) {
        entity.providedAmount = shopEntity.providedAmount;
        entity.usedAmount = shopEntity.usedAmount;
        entity.settledAmount = shopEntity.settledAmount;
        entity.withdrawnAmount = shopEntity.withdrawnAmount;
        shopEntity.blockNumber = event.block.number;
        shopEntity.blockTimestamp = event.block.timestamp;
        shopEntity.transactionHash = event.transaction.hash;
        shopEntity.save();
    } else {
        entity.providedAmount = BigInt.fromI32(0);
        entity.settledAmount = BigInt.fromI32(0);
        entity.usedAmount = BigInt.fromI32(0);
        entity.withdrawnAmount = BigInt.fromI32(0);
    }

    let shopWithdrawEntity = ShopWithdraw.load(event.params.shopId);
    if (shopWithdrawEntity !== null) {
        shopWithdrawEntity.status = ShopWithdrawStatus.OPEN;
        shopWithdrawEntity.withdrawId = event.params.withdrawId;
        shopWithdrawEntity.amount = event.params.amount;
        shopWithdrawEntity.currency = event.params.currency;
        shopWithdrawEntity.account = event.params.account;
        shopWithdrawEntity.blockNumber = event.block.number;
        shopWithdrawEntity.blockTimestamp = event.block.timestamp;
        shopWithdrawEntity.transactionHash = event.transaction.hash;
        shopWithdrawEntity.save();
    } else {
        shopWithdrawEntity = new ShopWithdraw(event.params.shopId);
        shopWithdrawEntity.withdrawId = event.params.withdrawId;
        shopWithdrawEntity.amount = event.params.amount;
        shopWithdrawEntity.currency = event.params.currency;
        shopWithdrawEntity.account = event.params.account;
        shopWithdrawEntity.blockNumber = event.block.number;
        shopWithdrawEntity.blockTimestamp = event.block.timestamp;
        shopWithdrawEntity.transactionHash = event.transaction.hash;
        shopWithdrawEntity.save();
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
    entity.withdrawnAmount = event.params.total.div(AmountUnit);
    entity.currency = event.params.currency;

    let shopEntity = Shop.load(event.params.shopId);
    if (shopEntity !== null) {
        entity.providedAmount = shopEntity.providedAmount;
        entity.settledAmount = shopEntity.settledAmount;
        entity.usedAmount = shopEntity.usedAmount;
        shopEntity.withdrawnAmount = entity.withdrawnAmount;
        shopEntity.blockNumber = event.block.number;
        shopEntity.blockTimestamp = event.block.timestamp;
        shopEntity.transactionHash = event.transaction.hash;
        shopEntity.save();
    } else {
        entity.providedAmount = BigInt.fromI32(0);
        entity.settledAmount = BigInt.fromI32(0);
        entity.usedAmount = BigInt.fromI32(0);
    }

    let shopWithdrawEntity = ShopWithdraw.load(event.params.shopId);
    if (shopWithdrawEntity !== null) {
        if (shopWithdrawEntity.withdrawId == event.params.withdrawId) {
            shopWithdrawEntity.status = ShopWithdrawStatus.CLOSE;
            shopWithdrawEntity.save();
        }
    }

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();
}
