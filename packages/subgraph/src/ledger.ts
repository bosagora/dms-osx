import {
    ChangedToLoyaltyToken as ChangedToLoyaltyTokenEvent,
    ChangedToPayablePoint as ChangedToPayablePointEvent,
    Deposited as DepositedEvent,
    LoyaltyPaymentEvent as LoyaltyPaymentEventEvent,
    ProvidedPoint as ProvidedPointEvent,
    ProvidedToken as ProvidedTokenEvent,
    ProvidedTokenForSettlement as ProvidedTokenForSettlementEvent,
    ProvidedUnPayablePoint as ProvidedUnPayablePointEvent,
    SavedPurchase as SavedPurchaseEvent,
    Withdrawn as WithdrawnEvent,
} from "../generated/Ledger/Ledger";
import {
    ChangedToLoyaltyToken,
    ChangedToPayablePoint,
    Deposited,
    LoyaltyPaymentEvent,
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
    PROVIDED = 1,
    USED = 2,
    DEPOSITED = 11,
    WITHDRAWN = 12,
    CHANGED = 21,
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

export function handleLoyaltyPaymentEvent(event: LoyaltyPaymentEventEvent): void {
    if (
        event.params.payment.status !== LoyaltyPaymentStatus.CLOSED_PAYMENT &&
        event.params.payment.status !== LoyaltyPaymentStatus.CLOSED_CANCEL
    )
        return;

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

export function handleChangedToLoyaltyToken(event: ChangedToLoyaltyTokenEvent): void {
    if (event.params.amountPoint.equals(BigInt.fromI32(0))) return;
    let entity = new ChangedToLoyaltyToken(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.account = event.params.account;
    entity.amountToken = event.params.amountToken.div(AmountUnit);
    entity.amountPoint = event.params.amountPoint.div(AmountUnit);
    entity.balanceToken = event.params.balanceToken.div(AmountUnit);

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();

    handleChangedToLoyaltyTokenForHistory(event);
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

export function handleChangedToPayablePoint(event: ChangedToPayablePointEvent): void {
    if (event.params.changedPoint.equals(BigInt.fromI32(0))) return;
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
    entity.action = UserAction.NONE;
    entity.cancel = false;
    entity.loyaltyType = LoyaltyType.TOKEN;
    entity.amountPoint = event.params.providedPoint.div(AmountUnit);
    entity.amountToken = event.params.providedToken.div(AmountUnit);
    entity.amountValue = event.params.providedPoint.div(AmountUnit);
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
    entity.action = UserAction.PROVIDED;
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
    entity.action = UserAction.PROVIDED;
    entity.cancel = false;
    entity.loyaltyType = LoyaltyType.POINT;
    entity.amountPoint = event.params.providedPoint.div(AmountUnit);
    entity.amountToken = BigInt.fromI32(0);
    entity.amountValue = event.params.providedValue.div(AmountUnit);
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
    entity.action = UserAction.PROVIDED;
    entity.cancel = false;
    entity.loyaltyType = LoyaltyType.TOKEN;
    entity.amountPoint = BigInt.fromI32(0);
    entity.amountToken = event.params.providedToken.div(AmountUnit);
    entity.amountValue = event.params.providedValue.div(AmountUnit);
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
    entity.action = UserAction.USED;
    entity.cancel = false;
    entity.loyaltyType = LoyaltyType.POINT;
    entity.amountPoint = event.params.payment.paidPoint.div(AmountUnit);
    entity.amountToken = BigInt.fromI32(0);
    entity.amountValue = event.params.payment.paidValue.div(AmountUnit);
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
    entity.action = UserAction.USED;
    entity.cancel = false;
    entity.loyaltyType = LoyaltyType.TOKEN;
    entity.amountPoint = BigInt.fromI32(0);
    entity.amountToken = event.params.payment.paidToken.div(AmountUnit);
    entity.amountValue = event.params.payment.paidValue.div(AmountUnit);
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
    entity.action = UserAction.USED;
    entity.cancel = true;
    entity.loyaltyType = LoyaltyType.POINT;
    entity.amountPoint = event.params.payment.paidPoint.div(AmountUnit);
    entity.amountToken = BigInt.fromI32(0);
    entity.amountValue = event.params.payment.paidValue.div(AmountUnit);
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
    entity.action = UserAction.USED;
    entity.cancel = true;
    entity.loyaltyType = LoyaltyType.TOKEN;
    entity.amountPoint = BigInt.fromI32(0);
    entity.amountToken = event.params.payment.paidToken.div(AmountUnit);
    entity.amountValue = event.params.payment.paidValue.div(AmountUnit);
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
