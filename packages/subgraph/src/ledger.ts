import {
    Deposited as DepositedEvent,
    PaidPoint as PaidPointEvent,
    PaidToken as PaidTokenEvent,
    ProvidedPoint as ProvidedPointEvent,
    ProvidedPointToShop as ProvidedPointToShopEvent,
    ProvidedToken as ProvidedTokenEvent,
    SavedPurchase as SavedPurchaseEvent,
    Withdrawn as WithdrawnEvent,
} from "../generated/Ledger/Ledger";
import {
    Deposited,
    PaidPoint,
    PaidToken,
    ProvidedPoint,
    ProvidedPointToShop,
    ProvidedToken,
    SavedPurchase,
    Withdrawn,
    UserBalance,
    UserTradeHistory,
} from "../generated/schema";
import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import { AmountUnit, NullAccount } from "./utils";

export function handleDeposited(event: DepositedEvent): void {
    let entity = new Deposited(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.phone = event.params.phone;
    entity.depositAmount = event.params.depositAmount;
    entity.value = event.params.value;
    entity.balanceToken = event.params.balanceToken;
    entity.account = event.params.account;

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();

    handleDepositedForHistory(event);
}

export function handlePaidPoint(event: PaidPointEvent): void {
    let entity = new PaidPoint(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.phone = event.params.phone;
    entity.paidAmountPoint = event.params.paidAmountPoint;
    entity.value = event.params.value;
    entity.balancePoint = event.params.balancePoint;
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
    entity.phone = event.params.phone;
    entity.paidAmountToken = event.params.paidAmountToken;
    entity.value = event.params.value;
    entity.balanceToken = event.params.balanceToken;
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
    entity.phone = event.params.phone;
    entity.providedAmountPoint = event.params.providedAmountPoint;
    entity.value = event.params.value;
    entity.balancePoint = event.params.balancePoint;
    entity.purchaseId = event.params.purchaseId;
    entity.shopId = event.params.shopId;

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();

    handleProvidedPointForHistory(event);
}

export function handleProvidedPointToShop(event: ProvidedPointToShopEvent): void {
    let entity = new ProvidedPointToShop(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.phone = event.params.phone;
    entity.providedAmountPoint = event.params.providedAmountPoint;
    entity.value = event.params.value;
    entity.balancePoint = event.params.balancePoint;
    entity.purchaseId = event.params.purchaseId;
    entity.shopId = event.params.shopId;

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();

    handleProvidedPointToShopForHistory(event);
}

export function handleProvidedToken(event: ProvidedTokenEvent): void {
    let entity = new ProvidedToken(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.phone = event.params.phone;
    entity.providedAmountToken = event.params.providedAmountToken;
    entity.value = event.params.value;
    entity.balanceToken = event.params.balanceToken;
    entity.purchaseId = event.params.purchaseId;
    entity.shopId = event.params.shopId;

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();

    handleProvidedTokenForHistory(event);
}

export function handleSavedPurchase(event: SavedPurchaseEvent): void {
    let entity = new SavedPurchase(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.purchaseId = event.params.purchaseId;
    entity.timestamp = event.params.timestamp;
    entity.amount = event.params.amount;
    entity.phone = event.params.phone;
    entity.shopId = event.params.shopId;
    entity.method = event.params.method;
    entity.currency = event.params.currency;

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();
}

export function handleWithdrawn(event: WithdrawnEvent): void {
    let entity = new Withdrawn(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.phone = event.params.phone;
    entity.withdrawAmount = event.params.withdrawAmount;
    entity.value = event.params.value;
    entity.balanceToken = event.params.balanceToken;
    entity.account = event.params.account;

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();

    handleWithdrawnForHistory(event);
}

export function handleChangedBalancePoint(
    phone: Bytes,
    balance: BigInt,
    blockNumber: BigInt,
    blockTimestamp: BigInt,
    transactionHash: Bytes
): UserBalance {
    let entity = UserBalance.load(phone.toHex());
    if (entity !== null) {
        entity.point = balance.div(AmountUnit);
        entity.blockNumber = blockNumber;
        entity.blockTimestamp = blockTimestamp;
        entity.transactionHash = transactionHash;
        entity.save();
    } else {
        entity = new UserBalance(phone.toHex());
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
    phone: Bytes,
    balance: BigInt,
    blockNumber: BigInt,
    blockTimestamp: BigInt,
    transactionHash: Bytes
): UserBalance {
    let entity = UserBalance.load(phone.toHex());
    if (entity !== null) {
        entity.token = balance.div(AmountUnit);
        entity.blockNumber = blockNumber;
        entity.blockTimestamp = blockTimestamp;
        entity.transactionHash = transactionHash;
        entity.save();
    } else {
        entity = new UserBalance(phone.toHex());
        entity.token = balance.div(AmountUnit);
        entity.point = BigInt.fromI32(0);
        entity.blockNumber = blockNumber;
        entity.blockTimestamp = blockTimestamp;
        entity.transactionHash = transactionHash;
        entity.save();
    }
    return entity;
}

export function handleProvidedPointForHistory(event: ProvidedPointEvent): void {
    const balanceEntity = handleChangedBalancePoint(
        event.params.phone,
        event.params.balancePoint,
        event.block.number,
        event.block.timestamp,
        event.transaction.hash
    );
    let entity = new UserTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.phone = event.params.phone;
    entity.action = "ProvidedPoint";
    entity.assetFlow = "PointInput";
    entity.amountPoint = event.params.providedAmountPoint;
    entity.amountToken = BigInt.fromI32(0);
    entity.value = event.params.value.div(AmountUnit);
    entity.balancePoint = event.params.balancePoint;
    entity.balanceToken = balanceEntity.token;
    entity.purchaseId = event.params.purchaseId;
    entity.shopId = event.params.shopId;
    entity.account = NullAccount;

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;
    entity.save();
}

export function handleProvidedPointToShopForHistory(event: ProvidedPointToShopEvent): void {
    const balanceEntity = handleChangedBalancePoint(
        event.params.phone,
        event.params.balancePoint,
        event.block.number,
        event.block.timestamp,
        event.transaction.hash
    );
    let entity = new UserTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.phone = event.params.phone;
    entity.action = "ClearedPoint";
    entity.assetFlow = "PointInput";
    entity.amountPoint = event.params.providedAmountPoint.div(AmountUnit);
    entity.amountToken = BigInt.fromI32(0);
    entity.value = event.params.value.div(AmountUnit);
    entity.balancePoint = event.params.balancePoint.div(AmountUnit);
    entity.balanceToken = balanceEntity.token;
    entity.shopId = event.params.shopId;
    entity.account = NullAccount;

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;
    entity.save();
}

export function handleProvidedTokenForHistory(event: ProvidedTokenEvent): void {
    const balanceEntity = handleChangedBalanceToken(
        event.params.phone,
        event.params.balanceToken,
        event.block.number,
        event.block.timestamp,
        event.transaction.hash
    );
    let entity = new UserTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.phone = event.params.phone;
    entity.action = "ProvidedToken";
    entity.assetFlow = "TokenInput";
    entity.amountPoint = BigInt.fromI32(0);
    entity.amountToken = event.params.providedAmountToken.div(AmountUnit);
    entity.value = event.params.value.div(AmountUnit);
    entity.balanceToken = event.params.balanceToken;
    entity.balancePoint = balanceEntity.point;
    entity.purchaseId = event.params.purchaseId;
    entity.shopId = event.params.shopId;
    entity.account = NullAccount;

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;
    entity.save();
}

export function handlePaidPointForHistory(event: PaidPointEvent): void {
    const balanceEntity = handleChangedBalanceToken(
        event.params.phone,
        event.params.balancePoint,
        event.block.number,
        event.block.timestamp,
        event.transaction.hash
    );
    let entity = new UserTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.phone = event.params.phone;
    entity.action = "PaidPoint";
    entity.assetFlow = "PointOutput";
    entity.amountPoint = event.params.paidAmountPoint.div(AmountUnit);
    entity.amountToken = BigInt.fromI32(0);
    entity.value = event.params.value.div(AmountUnit);
    entity.balancePoint = event.params.balancePoint.div(AmountUnit);
    entity.balanceToken = balanceEntity.token;
    entity.purchaseId = event.params.purchaseId;
    entity.shopId = event.params.shopId;
    entity.account = NullAccount;

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;
    entity.save();
}

export function handlePaidTokenForHistory(event: PaidTokenEvent): void {
    const balanceEntity = handleChangedBalanceToken(
        event.params.phone,
        event.params.balanceToken,
        event.block.number,
        event.block.timestamp,
        event.transaction.hash
    );
    let entity = new UserTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.phone = event.params.phone;
    entity.action = "PaidToken";
    entity.assetFlow = "TokenOutput";
    entity.amountPoint = BigInt.fromI32(0);
    entity.amountToken = event.params.paidAmountToken.div(AmountUnit);
    entity.value = event.params.value.div(AmountUnit);
    entity.balanceToken = event.params.balanceToken.div(AmountUnit);
    entity.balancePoint = balanceEntity.point;
    entity.purchaseId = event.params.purchaseId;
    entity.shopId = event.params.shopId;
    entity.account = NullAccount;

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;
    entity.save();
}

export function handleDepositedForHistory(event: DepositedEvent): void {
    const balanceEntity = handleChangedBalanceToken(
        event.params.phone,
        event.params.balanceToken,
        event.block.number,
        event.block.timestamp,
        event.transaction.hash
    );
    let entity = new UserTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.phone = event.params.phone;
    entity.action = "DepositedToken";
    entity.assetFlow = "TokenInput";
    entity.amountPoint = BigInt.fromI32(0);
    entity.amountToken = event.params.depositAmount.div(AmountUnit);
    entity.value = event.params.value.div(AmountUnit);
    entity.balanceToken = event.params.balanceToken.div(AmountUnit);
    entity.balancePoint = balanceEntity.point;
    entity.purchaseId = "";
    entity.shopId = "";
    entity.account = event.params.account;

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;
    entity.save();
}

export function handleWithdrawnForHistory(event: WithdrawnEvent): void {
    const balanceEntity = handleChangedBalanceToken(
        event.params.phone,
        event.params.balanceToken,
        event.block.number,
        event.block.timestamp,
        event.transaction.hash
    );
    let entity = new UserTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.phone = event.params.phone;
    entity.action = "WithdrawnToken";
    entity.assetFlow = "TokenOutput";
    entity.amountPoint = BigInt.fromI32(0);
    entity.amountToken = event.params.withdrawAmount.div(AmountUnit);
    entity.value = event.params.value.div(AmountUnit);
    entity.balanceToken = event.params.balanceToken.div(AmountUnit);
    entity.balancePoint = balanceEntity.point;
    entity.purchaseId = "";
    entity.shopId = "";
    entity.account = event.params.account;

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;
    entity.save();
}
