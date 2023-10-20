import {
    ChangedLoyaltyType as ChangedLoyaltyTypeEvent,
    ChangedToPayablePoint as ChangedToPayablePointEvent,
    Deposited as DepositedEvent,
    PaidPoint as PaidPointEvent,
    PaidToken as PaidTokenEvent,
    ProvidedPoint as ProvidedPointEvent,
    ProvidedToken as ProvidedTokenEvent,
    ProvidedTokenForSettlement as ProvidedTokenForSettlementEvent,
    ProvidedUnPayablePoint as ProvidedUnPayablePointEvent,
    SavedPurchase as SavedPurchaseEvent,
    Withdrawn as WithdrawnEvent,
} from "../generated/Ledger/Ledger";
import {
    ChangedLoyaltyType,
    ChangedToPayablePoint,
    Deposited,
    PaidPoint,
    PaidToken,
    ProvidedPoint,
    ProvidedToken,
    ProvidedTokenForSettlement,
    ProvidedUnPayablePoint,
    SavedPurchase,
    Withdrawn,
    UserBalance,
    UserTradeHistory,
    UserUnPayableTradeHistory,
} from "../generated/schema";
import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import { AmountUnit, NullAccount, NullBytes32 } from "./utils";

export function handleChangedLoyaltyType(event: ChangedLoyaltyTypeEvent): void {
    let entity = new ChangedLoyaltyType(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.account = event.params.account;
    entity.loyaltyType = event.params.loyaltyType;

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();
}

export function handleChangedToPayablePoint(event: ChangedToPayablePointEvent): void {
    let entity = new ChangedToPayablePoint(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.phone = event.params.phone;
    entity.account = event.params.account;
    entity.changedPoint = event.params.changedPoint.div(AmountUnit);
    entity.changedValue = event.params.changedValue.div(AmountUnit);
    entity.balancePoint = event.params.balancePoint.div(AmountUnit);

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();

    handleChangedPointForHistory(event);
    handleChangedPointForUnPayablePointHistory(event);
}

export function handleDeposited(event: DepositedEvent): void {
    let entity = new Deposited(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.account = event.params.account;
    entity.depositedToken = event.params.depositedToken.div(AmountUnit);
    entity.depositedValue = event.params.depositedValue.div(AmountUnit);
    entity.balanceToken = event.params.balanceToken.div(AmountUnit);

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();

    handleDepositedForHistory(event);
}

export function handlePaidPoint(event: PaidPointEvent): void {
    let entity = new PaidPoint(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.account = event.params.account;
    entity.paidPoint = event.params.paidPoint.div(AmountUnit);
    entity.paidValue = event.params.paidValue.div(AmountUnit);
    entity.feePoint = event.params.feePoint.div(AmountUnit);
    entity.feeValue = event.params.feeValue.div(AmountUnit);
    entity.balancePoint = event.params.balancePoint.div(AmountUnit);
    entity.purchaseId = event.params.purchaseId;
    entity.shopId = event.params.shopId;

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();

    handlePaidPointForHistory(event);
}

export function handlePaidToken(event: PaidTokenEvent): void {
    let entity = new PaidToken(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.account = event.params.account;
    entity.paidToken = event.params.paidToken.div(AmountUnit);
    entity.paidValue = event.params.paidValue.div(AmountUnit);
    entity.feeToken = event.params.feeToken.div(AmountUnit);
    entity.feeValue = event.params.feeValue.div(AmountUnit);
    entity.balanceToken = event.params.balanceToken.div(AmountUnit);
    entity.purchaseId = event.params.purchaseId;
    entity.shopId = event.params.shopId;

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();

    handlePaidTokenForHistory(event);
}

export function handleProvidedPoint(event: ProvidedPointEvent): void {
    let entity = new ProvidedPoint(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.account = event.params.account;
    entity.providedPoint = event.params.providedPoint.div(AmountUnit);
    entity.providedValue = event.params.providedValue.div(AmountUnit);
    entity.balancePoint = event.params.balancePoint.div(AmountUnit);
    entity.purchaseId = event.params.purchaseId;
    entity.shopId = event.params.shopId;

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();

    handleProvidedPointForHistory(event);
}

export function handleProvidedToken(event: ProvidedTokenEvent): void {
    let entity = new ProvidedToken(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.account = event.params.account;
    entity.providedToken = event.params.providedToken.div(AmountUnit);
    entity.providedValue = event.params.providedValue.div(AmountUnit);
    entity.balanceToken = event.params.balanceToken.div(AmountUnit);
    entity.purchaseId = event.params.purchaseId;
    entity.shopId = event.params.shopId;

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();

    handleProvidedTokenForHistory(event);
}

export function handleProvidedTokenForSettlement(event: ProvidedTokenForSettlementEvent): void {
    let entity = new ProvidedTokenForSettlement(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.account = event.params.account;
    entity.shopId = event.params.shopId;
    entity.providedPoint = event.params.providedPoint.div(AmountUnit);
    entity.providedToken = event.params.providedToken.div(AmountUnit);
    entity.balanceToken = event.params.balanceToken.div(AmountUnit);
    entity.purchaseId = event.params.purchaseId;

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();

    handleSettlementForHistory(event);
}

export function handleProvidedUnPayablePoint(event: ProvidedUnPayablePointEvent): void {
    let entity = new ProvidedUnPayablePoint(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.phone = event.params.phone;
    entity.providedPoint = event.params.providedPoint.div(AmountUnit);
    entity.providedValue = event.params.providedValue.div(AmountUnit);
    entity.balancePoint = event.params.balancePoint.div(AmountUnit);
    entity.purchaseId = event.params.purchaseId;
    entity.shopId = event.params.shopId;

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();

    handleProvidedForUnPayablePointHistory(event);
}

export function handleSavedPurchase(event: SavedPurchaseEvent): void {
    let entity = new SavedPurchase(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.purchaseId = event.params.purchaseId;
    entity.timestamp = event.params.timestamp;
    entity.amount = event.params.amount.div(AmountUnit);
    entity.currency = event.params.currency;
    entity.shopId = event.params.shopId;
    entity.method = event.params.method;
    entity.account = event.params.account;
    entity.phone = event.params.phone;

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();
}

export function handleWithdrawn(event: WithdrawnEvent): void {
    let entity = new Withdrawn(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.account = event.params.account;
    entity.withdrawnToken = event.params.withdrawnToken.div(AmountUnit);
    entity.withdrawnValue = event.params.withdrawnValue.div(AmountUnit);
    entity.balanceToken = event.params.balanceToken.div(AmountUnit);

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();

    handleWithdrawnForHistory(event);
}

export function handleChangedBalancePoint(
    account: Bytes,
    balance: BigInt,
    blockNumber: BigInt,
    blockTimestamp: BigInt,
    transactionHash: Bytes
): UserBalance {
    let entity = UserBalance.load(account.toHex());
    if (entity !== null) {
        entity.point = balance.div(AmountUnit);
        entity.blockNumber = blockNumber;
        entity.blockTimestamp = blockTimestamp;
        entity.transactionHash = transactionHash;
        entity.save();
    } else {
        entity = new UserBalance(account.toHex());
        entity.point = balance.div(AmountUnit);
        entity.token = BigInt.fromI32(0);
        entity.blockNumber = blockNumber;
        entity.blockTimestamp = blockTimestamp;
        entity.transactionHash = transactionHash;
        entity.save();
    }
    return entity;
}

export function handleChangedBalanceToken(
    account: Bytes,
    balance: BigInt,
    blockNumber: BigInt,
    blockTimestamp: BigInt,
    transactionHash: Bytes
): UserBalance {
    let entity = UserBalance.load(account.toHex());
    if (entity !== null) {
        entity.token = balance.div(AmountUnit);
        entity.blockNumber = blockNumber;
        entity.blockTimestamp = blockTimestamp;
        entity.transactionHash = transactionHash;
        entity.save();
    } else {
        entity = new UserBalance(account.toHex());
        entity.token = balance.div(AmountUnit);
        entity.point = BigInt.fromI32(0);
        entity.blockNumber = blockNumber;
        entity.blockTimestamp = blockTimestamp;
        entity.transactionHash = transactionHash;
        entity.save();
    }
    return entity;
}

export function handlePaidTokenForHistory(event: PaidTokenEvent): void {
    const balanceEntity = handleChangedBalanceToken(
        event.params.account,
        event.params.balanceToken,
        event.block.number,
        event.block.timestamp,
        event.transaction.hash
    );
    let entity = new UserTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.account = event.params.account;
    entity.action = "PaidToken";
    entity.assetFlow = "TokenOutput";
    entity.amountPoint = BigInt.fromI32(0);
    entity.amountToken = event.params.paidToken.div(AmountUnit);
    entity.value = event.params.paidValue.div(AmountUnit);
    entity.balanceToken = event.params.balanceToken.div(AmountUnit);
    entity.balancePoint = balanceEntity.point;
    entity.purchaseId = event.params.purchaseId;
    entity.shopId = event.params.shopId;

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;
    entity.save();
}

export function handleDepositedForHistory(event: DepositedEvent): void {
    const balanceEntity = handleChangedBalanceToken(
        event.params.account,
        event.params.balanceToken,
        event.block.number,
        event.block.timestamp,
        event.transaction.hash
    );
    let entity = new UserTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.account = event.params.account;
    entity.action = "DepositedToken";
    entity.assetFlow = "TokenInput";
    entity.amountPoint = BigInt.fromI32(0);
    entity.amountToken = event.params.depositedToken.div(AmountUnit);
    entity.value = event.params.depositedValue.div(AmountUnit);
    entity.balanceToken = event.params.balanceToken.div(AmountUnit);
    entity.balancePoint = balanceEntity.point;
    entity.purchaseId = "";
    entity.shopId = NullBytes32;

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;
    entity.save();
}

export function handleWithdrawnForHistory(event: WithdrawnEvent): void {
    const balanceEntity = handleChangedBalanceToken(
        event.params.account,
        event.params.balanceToken,
        event.block.number,
        event.block.timestamp,
        event.transaction.hash
    );
    let entity = new UserTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.account = event.params.account;
    entity.action = "WithdrawnToken";
    entity.assetFlow = "TokenOutput";
    entity.amountPoint = BigInt.fromI32(0);
    entity.amountToken = event.params.withdrawnToken.div(AmountUnit);
    entity.value = event.params.withdrawnValue.div(AmountUnit);
    entity.balanceToken = event.params.balanceToken.div(AmountUnit);
    entity.balancePoint = balanceEntity.point;
    entity.purchaseId = "";
    entity.shopId = NullBytes32;

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;
    entity.save();
}

export function handleSettlementForHistory(event: ProvidedTokenForSettlementEvent): void {
    const balanceEntity = handleChangedBalanceToken(
        event.params.account,
        event.params.balanceToken,
        event.block.number,
        event.block.timestamp,
        event.transaction.hash
    );
    let entity = new UserTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.account = event.params.account;
    entity.action = "WithdrawnToken";
    entity.assetFlow = "TokenOutput";
    entity.amountPoint = event.params.providedPoint.div(AmountUnit);
    entity.amountToken = event.params.providedToken.div(AmountUnit);
    entity.value = event.params.providedPoint.div(AmountUnit);
    entity.balanceToken = event.params.balanceToken.div(AmountUnit);
    entity.balancePoint = balanceEntity.point;
    entity.purchaseId = event.params.purchaseId;
    entity.shopId = event.params.shopId;

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;
    entity.save();
}

export function handleProvidedForUnPayablePointHistory(event: ProvidedUnPayablePointEvent): void {
    let entity = new UserUnPayableTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.phone = event.params.phone;
    entity.action = "ProvidedPoint";
    entity.assetFlow = "PointInput";
    entity.amount = event.params.providedPoint.div(AmountUnit);
    entity.balance = event.params.balancePoint.div(AmountUnit);
    entity.purchaseId = event.params.purchaseId;
    entity.shopId = event.params.shopId;

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;
    entity.save();
}

export function handleChangedPointForUnPayablePointHistory(event: ChangedToPayablePointEvent): void {
    let entity = new UserUnPayableTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.phone = event.params.phone;
    entity.action = "ChangedPoint";
    entity.assetFlow = "PointOut";
    entity.amount = event.params.changedPoint.div(AmountUnit);
    entity.balance = BigInt.fromI32(0);
    entity.purchaseId = "";
    entity.shopId = NullBytes32;

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;
    entity.save();
}

export function handleChangedPointForHistory(event: ChangedToPayablePointEvent): void {
    const balanceEntity = handleChangedBalancePoint(
        event.params.account,
        event.params.balancePoint,
        event.block.number,
        event.block.timestamp,
        event.transaction.hash
    );
    let entity = new UserTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.account = event.params.account;
    entity.action = "ChangedPoint";
    entity.assetFlow = "PointInput";
    entity.amountPoint = event.params.changedPoint.div(AmountUnit);
    entity.amountToken = BigInt.fromI32(0);
    entity.value = event.params.changedValue.div(AmountUnit);
    entity.balancePoint = event.params.balancePoint.div(AmountUnit);
    entity.balanceToken = balanceEntity.token;
    entity.purchaseId = "";
    entity.shopId = NullBytes32;

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;
    entity.save();
}

export function handleProvidedPointForHistory(event: ProvidedPointEvent): void {
    const balanceEntity = handleChangedBalancePoint(
        event.params.account,
        event.params.balancePoint,
        event.block.number,
        event.block.timestamp,
        event.transaction.hash
    );
    let entity = new UserTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.account = event.params.account;
    entity.action = "ProvidedPoint";
    entity.assetFlow = "PointInput";
    entity.amountPoint = event.params.providedPoint.div(AmountUnit);
    entity.amountToken = BigInt.fromI32(0);
    entity.value = event.params.providedValue.div(AmountUnit);
    entity.balancePoint = event.params.balancePoint.div(AmountUnit);
    entity.balanceToken = balanceEntity.token;
    entity.purchaseId = event.params.purchaseId;
    entity.shopId = event.params.shopId;

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;
    entity.save();
}

export function handleProvidedTokenForHistory(event: ProvidedTokenEvent): void {
    const balanceEntity = handleChangedBalanceToken(
        event.params.account,
        event.params.balanceToken,
        event.block.number,
        event.block.timestamp,
        event.transaction.hash
    );
    let entity = new UserTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.account = event.params.account;
    entity.action = "ProvidedToken";
    entity.assetFlow = "TokenInput";
    entity.amountPoint = BigInt.fromI32(0);
    entity.amountToken = event.params.providedToken.div(AmountUnit);
    entity.value = event.params.providedValue.div(AmountUnit);
    entity.balanceToken = event.params.balanceToken.div(AmountUnit);
    entity.balancePoint = balanceEntity.point;
    entity.purchaseId = event.params.purchaseId;
    entity.shopId = event.params.shopId;

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;
    entity.save();
}

export function handlePaidPointForHistory(event: PaidPointEvent): void {
    const balanceEntity = handleChangedBalanceToken(
        event.params.account,
        event.params.balancePoint,
        event.block.number,
        event.block.timestamp,
        event.transaction.hash
    );
    let entity = new UserTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.account = event.params.account;
    entity.action = "PaidPoint";
    entity.assetFlow = "PointOutput";
    entity.amountPoint = event.params.paidPoint.div(AmountUnit);
    entity.amountToken = BigInt.fromI32(0);
    entity.value = event.params.paidValue.div(AmountUnit);
    entity.balancePoint = event.params.balancePoint.div(AmountUnit);
    entity.balanceToken = balanceEntity.token;
    entity.purchaseId = event.params.purchaseId;
    entity.shopId = event.params.shopId;

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;
    entity.save();
}
