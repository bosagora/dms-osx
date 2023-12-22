import {
    Deposited as DepositedEvent,
    ProvidedPoint as ProvidedPointEvent,
    ProvidedToken as ProvidedTokenEvent,
    ProvidedUnPayablePoint as ProvidedUnPayablePointEvent,
    Withdrawn as WithdrawnEvent,
} from "../generated/Ledger/Ledger";
import { SavedPurchase as SavedPurchaseEvent } from "../generated/LoyaltyProvider/LoyaltyProvider";
import {
    LoyaltyPaymentEvent as LoyaltyPaymentEventEvent,
    ProvidedTokenForSettlement as ProvidedTokenForSettlementEvent,
} from "../generated/LoyaltyConsumer/LoyaltyConsumer";
import {
    ChangedToLoyaltyToken as ChangedToLoyaltyTokenEvent,
    ChangedToPayablePoint as ChangedToPayablePointEvent,
} from "../generated/LoyaltyExchanger/LoyaltyExchanger";
import {
    SavedPurchase,
    UserBalance,
    UserTradeHistory,
    UserUnPayableTradeHistory,
    LoyaltyPaymentEvent,
} from "../generated/schema";
import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import { AmountUnit, NullBytes32 } from "./utils";

enum PageType {
    NONE = 0,
    SAVE_USE = 1,
    DEPOSIT_WITHDRAW = 2,
}

enum LoyaltyType {
    POINT = 0,
    TOKEN = 1,
}

enum LoyaltyPaymentStatus {
    INVALID = 0,
    OPENED_PAYMENT = 1,
    CLOSED_PAYMENT = 2,
    FAILED_PAYMENT = 3,
    OPENED_CANCEL = 4,
    CLOSED_CANCEL = 5,
    FAILED_CANCEL = 6,
}

enum UserAction {
    NONE = 0,
    SAVED = 1,
    USED = 2,
    DEPOSITED = 11,
    WITHDRAWN = 12,
    CHANGED = 21,
    SETTLEMENT = 31,
}

export function handleSavedPurchase(event: SavedPurchaseEvent): void {
    let entity = new SavedPurchase(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.purchaseId = event.params.purchaseId;
    entity.amount = event.params.amount.div(AmountUnit);
    entity.loyalty = event.params.loyalty.div(AmountUnit);
    entity.currency = event.params.currency;
    entity.shopId = event.params.shopId;
    entity.account = event.params.account;
    entity.phone = event.params.phone;

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();
}

export function handleProvidedUnPayablePoint(event: ProvidedUnPayablePointEvent): void {
    handleProvidedForUnPayablePointHistory(event);
}

export function handleChangedToPayablePoint(event: ChangedToPayablePointEvent): void {
    handleChangedPointForHistory(event);
    handleChangedPointForUnPayablePointHistory(event);
}

export function handleChangedToLoyaltyToken(event: ChangedToLoyaltyTokenEvent): void {
    handleChangedToLoyaltyTokenForHistory(event);
}

export function handleProvidedPoint(event: ProvidedPointEvent): void {
    handleProvidedPointForHistory(event);
}

export function handleProvidedToken(event: ProvidedTokenEvent): void {
    handleProvidedTokenForHistory(event);
}

export function handleLoyaltyPaymentEvent(event: LoyaltyPaymentEventEvent): void {
    let entity = new LoyaltyPaymentEvent(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.paymentId = event.params.payment.paymentId;
    entity.purchaseId = event.params.payment.purchaseId;
    entity.currency = event.params.payment.currency;
    entity.shopId = event.params.payment.shopId;
    entity.account = event.params.payment.account;
    entity.timestamp = event.params.payment.timestamp;
    entity.loyaltyType = event.params.payment.loyaltyType;
    entity.paidPoint = event.params.payment.paidPoint;
    entity.paidToken = event.params.payment.paidToken;
    entity.paidValue = event.params.payment.paidValue;
    entity.feePoint = event.params.payment.feePoint;
    entity.feeToken = event.params.payment.feeToken;
    entity.feeValue = event.params.payment.feeValue;
    entity.status = event.params.payment.status;
    entity.balance = event.params.balance;

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();

    handleLoyaltyPaymentEventForHistory(event);
}

export function handleProvidedTokenForSettlement(event: ProvidedTokenForSettlementEvent): void {
    handleSettlementForHistory(event);
}

export function handleDeposited(event: DepositedEvent): void {
    handleDepositedForHistory(event);
}

export function handleWithdrawn(event: WithdrawnEvent): void {
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
    entity.pageType = PageType.DEPOSIT_WITHDRAW;
    entity.action = UserAction.DEPOSITED;
    entity.cancel = false;
    entity.loyaltyType = LoyaltyType.TOKEN;
    entity.amountPoint = BigInt.fromI32(0);
    entity.amountToken = event.params.depositedToken.div(AmountUnit);
    entity.amountValue = event.params.depositedValue.div(AmountUnit);
    entity.balanceToken = event.params.balanceToken.div(AmountUnit);
    entity.balancePoint = balanceEntity.point;

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
    entity.pageType = PageType.DEPOSIT_WITHDRAW;
    entity.action = UserAction.WITHDRAWN;
    entity.cancel = false;
    entity.loyaltyType = LoyaltyType.TOKEN;
    entity.amountPoint = BigInt.fromI32(0);
    entity.amountToken = event.params.withdrawnToken.div(AmountUnit);
    entity.amountValue = event.params.withdrawnValue.div(AmountUnit);
    entity.balanceToken = event.params.balanceToken.div(AmountUnit);
    entity.balancePoint = balanceEntity.point;

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
    entity.pageType = PageType.NONE;
    entity.action = UserAction.SETTLEMENT;
    entity.cancel = false;
    entity.loyaltyType = LoyaltyType.TOKEN;
    entity.amountPoint = event.params.providedPoint.div(AmountUnit);
    entity.amountToken = event.params.providedToken.div(AmountUnit);
    entity.amountValue = event.params.providedPoint.div(AmountUnit);
    entity.currency = event.params.currency;
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
    entity.action = UserAction.SAVED;
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
    entity.action = UserAction.CHANGED;
    entity.amount = event.params.changedPoint.div(AmountUnit);
    entity.balance = BigInt.fromI32(0);

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
    entity.pageType = PageType.SAVE_USE;
    entity.action = UserAction.CHANGED;
    entity.cancel = false;
    entity.loyaltyType = LoyaltyType.POINT;
    entity.amountPoint = event.params.changedPoint.div(AmountUnit);
    entity.amountToken = BigInt.fromI32(0);
    entity.amountValue = event.params.changedValue.div(AmountUnit);
    entity.balancePoint = event.params.balancePoint.div(AmountUnit);
    entity.balanceToken = balanceEntity.token;

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
    entity.pageType = PageType.SAVE_USE;
    entity.action = UserAction.SAVED;
    entity.cancel = false;
    entity.loyaltyType = LoyaltyType.POINT;
    entity.amountPoint = event.params.providedPoint.div(AmountUnit);
    entity.amountToken = BigInt.fromI32(0);
    entity.amountValue = event.params.providedValue.div(AmountUnit);
    entity.currency = event.params.currency;
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
    entity.pageType = PageType.SAVE_USE;
    entity.action = UserAction.SAVED;
    entity.cancel = false;
    entity.loyaltyType = LoyaltyType.TOKEN;
    entity.amountPoint = BigInt.fromI32(0);
    entity.amountToken = event.params.providedToken.div(AmountUnit);
    entity.amountValue = event.params.providedValue.div(AmountUnit);
    entity.currency = event.params.currency;
    entity.balanceToken = event.params.balanceToken.div(AmountUnit);
    entity.balancePoint = balanceEntity.point;
    entity.purchaseId = event.params.purchaseId;
    entity.shopId = event.params.shopId;

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;
    entity.save();
}

export function handleChangedToLoyaltyTokenForHistory(event: ChangedToLoyaltyTokenEvent): void {
    let balanceEntity = handleChangedBalancePoint(
        event.params.account,
        BigInt.fromI32(0),
        event.block.number,
        event.block.timestamp,
        event.transaction.hash
    );

    let entity = new UserTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.account = event.params.account;
    entity.pageType = PageType.SAVE_USE;
    entity.action = UserAction.CHANGED;
    entity.cancel = false;
    entity.loyaltyType = LoyaltyType.POINT;
    entity.amountPoint = event.params.amountPoint.div(AmountUnit);
    entity.amountToken = BigInt.fromI32(0);
    entity.amountValue = event.params.amountPoint.div(AmountUnit);
    entity.balancePoint = BigInt.fromI32(0);
    entity.balanceToken = balanceEntity.token;
    entity.purchaseId = "";
    entity.shopId = NullBytes32;

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;
    entity.save();

    entity = new UserTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.account = event.params.account;
    entity.pageType = PageType.SAVE_USE;
    entity.action = UserAction.CHANGED;
    entity.cancel = false;
    entity.loyaltyType = LoyaltyType.TOKEN;
    entity.amountPoint = BigInt.fromI32(0);
    entity.amountToken = event.params.amountToken.div(AmountUnit);
    entity.amountValue = event.params.amountPoint.div(AmountUnit);
    entity.balancePoint = BigInt.fromI32(0);
    entity.balanceToken = event.params.balanceToken.div(AmountUnit);

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;
    entity.save();
}

export function handleLoyaltyPaymentEventForHistory(event: LoyaltyPaymentEventEvent): void {
    if (event.params.payment.status == LoyaltyPaymentStatus.CLOSED_PAYMENT) {
        if (event.params.payment.loyaltyType === 0) {
            handlePaidPointForHistory(event);
        } else {
            handlePaidTokenForHistory(event);
        }
    } else if (event.params.payment.status == LoyaltyPaymentStatus.CLOSED_CANCEL) {
        if (event.params.payment.loyaltyType === 0) {
            handleCanceledPointForHistory(event);
        } else {
            handleCanceledTokenForHistory(event);
        }
    }
}

export function handlePaidPointForHistory(event: LoyaltyPaymentEventEvent): void {
    const balanceEntity = handleChangedBalancePoint(
        event.params.payment.account,
        event.params.balance,
        event.block.number,
        event.block.timestamp,
        event.transaction.hash
    );
    let entity = new UserTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.account = event.params.payment.account;
    entity.pageType = PageType.SAVE_USE;
    entity.action = UserAction.USED;
    entity.cancel = false;
    entity.loyaltyType = LoyaltyType.POINT;
    entity.amountPoint = event.params.payment.paidPoint.div(AmountUnit);
    entity.amountToken = BigInt.fromI32(0);
    entity.amountValue = event.params.payment.paidValue.div(AmountUnit);
    entity.currency = event.params.payment.currency;
    entity.balancePoint = event.params.balance.div(AmountUnit);
    entity.balanceToken = balanceEntity.token;
    entity.purchaseId = event.params.payment.purchaseId;
    entity.paymentId = event.params.payment.paymentId;
    entity.shopId = event.params.payment.shopId;

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;
    entity.save();
}

export function handlePaidTokenForHistory(event: LoyaltyPaymentEventEvent): void {
    const balanceEntity = handleChangedBalanceToken(
        event.params.payment.account,
        event.params.balance,
        event.block.number,
        event.block.timestamp,
        event.transaction.hash
    );
    let entity = new UserTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.account = event.params.payment.account;
    entity.pageType = PageType.SAVE_USE;
    entity.action = UserAction.USED;
    entity.cancel = false;
    entity.loyaltyType = LoyaltyType.TOKEN;
    entity.amountPoint = BigInt.fromI32(0);
    entity.amountToken = event.params.payment.paidToken.div(AmountUnit);
    entity.amountValue = event.params.payment.paidValue.div(AmountUnit);
    entity.currency = event.params.payment.currency;
    entity.balanceToken = event.params.balance.div(AmountUnit);
    entity.balancePoint = balanceEntity.point;
    entity.purchaseId = event.params.payment.purchaseId;
    entity.paymentId = event.params.payment.paymentId;
    entity.shopId = event.params.payment.shopId;

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;
    entity.save();
}

export function handleCanceledPointForHistory(event: LoyaltyPaymentEventEvent): void {
    const balanceEntity = handleChangedBalancePoint(
        event.params.payment.account,
        event.params.balance,
        event.block.number,
        event.block.timestamp,
        event.transaction.hash
    );
    let entity = new UserTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.account = event.params.payment.account;
    entity.pageType = PageType.SAVE_USE;
    entity.action = UserAction.USED;
    entity.cancel = true;
    entity.loyaltyType = LoyaltyType.POINT;
    entity.amountPoint = event.params.payment.paidPoint.div(AmountUnit);
    entity.amountToken = BigInt.fromI32(0);
    entity.amountValue = event.params.payment.paidValue.div(AmountUnit);
    entity.currency = event.params.payment.currency;
    entity.balancePoint = event.params.balance.div(AmountUnit);
    entity.balanceToken = balanceEntity.token;
    entity.purchaseId = event.params.payment.purchaseId;
    entity.paymentId = event.params.payment.paymentId;
    entity.shopId = event.params.payment.shopId;

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;
    entity.save();
}

export function handleCanceledTokenForHistory(event: LoyaltyPaymentEventEvent): void {
    const balanceEntity = handleChangedBalanceToken(
        event.params.payment.account,
        event.params.balance,
        event.block.number,
        event.block.timestamp,
        event.transaction.hash
    );
    let entity = new UserTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.account = event.params.payment.account;
    entity.pageType = PageType.SAVE_USE;
    entity.action = UserAction.USED;
    entity.cancel = true;
    entity.loyaltyType = LoyaltyType.TOKEN;
    entity.amountPoint = BigInt.fromI32(0);
    entity.amountToken = event.params.payment.paidToken.div(AmountUnit);
    entity.amountValue = event.params.payment.paidValue.div(AmountUnit);
    entity.currency = event.params.payment.currency;
    entity.balanceToken = event.params.balance.div(AmountUnit);
    entity.balancePoint = balanceEntity.point;
    entity.purchaseId = event.params.payment.purchaseId;
    entity.paymentId = event.params.payment.paymentId;
    entity.shopId = event.params.payment.shopId;

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;
    entity.save();
}
