import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import { AmountUnit, NullBytes32 } from "./utils";
import {
    Deposited as DepositedEvent,
    ProvidedPoint as ProvidedPointEvent,
    ProvidedUnPayablePoint as ProvidedUnPayablePointEvent,
    Withdrawn as WithdrawnEvent,
} from "../generated/Ledger/Ledger";
import { SavedPurchase as SavedPurchaseEvent } from "../generated/LoyaltyProvider/LoyaltyProvider";
import {
    LoyaltyPaymentEvent as LoyaltyPaymentEventEvent,
    ProvidedTokenForSettlement as ProvidedTokenForSettlementEvent,
} from "../generated/LoyaltyConsumer/LoyaltyConsumer";
import {
    ChangedToPayablePoint as ChangedToPayablePointEvent,
    ChangedPointToToken as ChangedPointToTokenEvent,
} from "../generated/LoyaltyExchanger/LoyaltyExchanger";
import { TransferredLoyaltyToken as TransferredLoyaltyTokenEvent } from "../generated/LoyaltyTransfer/LoyaltyTransfer";
import {
    BridgeDeposited as BridgeDepositedEvent,
    BridgeWithdrawn as BridgeWithdrawnEvent,
} from "../generated/LoyaltyBridge/LoyaltyBridge";
import {
    BurnedPoint as BurnedPointEvent,
    BurnedUnPayablePoint as BurnedUnPayablePointEvent,
} from "../generated/LoyaltyBurner/LoyaltyBurner";
import {
    SavedPurchase,
    UserBalance,
    UserTradeHistory,
    UserUnPayableTradeHistory,
    LoyaltyPaymentEvent,
    LoyaltyBridgeDeposited,
    LoyaltyBridgeWithdrawn,
    BurnedPoint,
    BurnedUnPayablePoint,
} from "../generated/schema";

enum PageType {
    NONE = 0,
    SAVE_USE = 1,
    DEPOSIT_WITHDRAW = 2,
    TRANSFER = 3,
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
    BURNED,
    DEPOSITED = 11,
    WITHDRAWN = 12,
    CHANGED_PAYABLE_POINT = 21,
    CHANGED_TOKEN = 22,
    CHANGED_POINT = 23,
    SETTLEMENT = 31,
    IN = 41,
    OUT = 42,
}

// region UserBalance
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

// endregion

// region Ledger

export function handleDeposited(event: DepositedEvent): void {
    handleDepositedForHistory(event);
}

export function handleWithdrawn(event: WithdrawnEvent): void {
    handleWithdrawnForHistory(event);
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
    entity.amountPoint = BigInt.fromI32(0);
    entity.amountToken = event.params.depositedToken.div(AmountUnit);
    entity.amountValue = event.params.depositedValue.div(AmountUnit);
    entity.feePoint = BigInt.fromI32(0);
    entity.feeToken = BigInt.fromI32(0);
    entity.feeValue = BigInt.fromI32(0);
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
    entity.amountPoint = BigInt.fromI32(0);
    entity.amountToken = event.params.withdrawnToken.div(AmountUnit);
    entity.amountValue = event.params.withdrawnValue.div(AmountUnit);
    entity.feePoint = BigInt.fromI32(0);
    entity.feeToken = BigInt.fromI32(0);
    entity.feeValue = BigInt.fromI32(0);
    entity.balanceToken = event.params.balanceToken.div(AmountUnit);
    entity.balancePoint = balanceEntity.point;

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;
    entity.save();
}

// endregion

// region LoyaltyExchanger

export function handleChangedToPayablePoint(event: ChangedToPayablePointEvent): void {
    handleChangedPointForHistory(event);
    handleChangedPointForUnPayablePointForHistory(event);
}
export function handleChangedPointForUnPayablePointForHistory(event: ChangedToPayablePointEvent): void {
    let entity = new UserUnPayableTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.phone = event.params.phone;
    entity.action = UserAction.CHANGED_PAYABLE_POINT;
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
    entity.action = UserAction.CHANGED_PAYABLE_POINT;
    entity.cancel = false;
    entity.amountPoint = event.params.changedPoint.div(AmountUnit);
    entity.amountToken = BigInt.fromI32(0);
    entity.amountValue = event.params.changedValue.div(AmountUnit);
    entity.feePoint = BigInt.fromI32(0);
    entity.feeToken = BigInt.fromI32(0);
    entity.feeValue = BigInt.fromI32(0);
    entity.balancePoint = event.params.balancePoint.div(AmountUnit);
    entity.balanceToken = balanceEntity.token;

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;
    entity.save();
}

export function handleChangedPointToToken(event: ChangedPointToTokenEvent): void {
    handleChangedPointToTokenForHistory(event);
}
export function handleChangedPointToTokenForHistory(event: ChangedPointToTokenEvent): void {
    handleChangedBalancePoint(
        event.params.account,
        event.params.balancePoint,
        event.block.number,
        event.block.timestamp,
        event.transaction.hash
    );

    handleChangedBalanceToken(
        event.params.account,
        event.params.balanceToken,
        event.block.number,
        event.block.timestamp,
        event.transaction.hash
    );

    let entity = new UserTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.account = event.params.account;
    entity.pageType = PageType.SAVE_USE;
    entity.action = UserAction.CHANGED_TOKEN;
    entity.cancel = false;
    entity.amountPoint = event.params.amountPoint.div(AmountUnit);
    entity.amountToken = event.params.amountToken.div(AmountUnit);
    entity.amountValue = event.params.amountPoint.div(AmountUnit);
    entity.feePoint = BigInt.fromI32(0);
    entity.feeToken = BigInt.fromI32(0);
    entity.feeValue = BigInt.fromI32(0);
    entity.balancePoint = event.params.balancePoint.div(AmountUnit);
    entity.balanceToken = event.params.balanceToken.div(AmountUnit);
    entity.purchaseId = "";
    entity.paymentId = NullBytes32;
    entity.shopId = NullBytes32;

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;
    entity.save();
}

// endregion

// region LoyaltyProvider

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
    handleProvidedForUnPayablePointForHistory(event);
}

export function handleProvidedPoint(event: ProvidedPointEvent): void {
    handleProvidedPointForHistory(event);
}

export function handleProvidedTokenForSettlement(event: ProvidedTokenForSettlementEvent): void {
    handleSettlementForHistory(event);
}

export function handleProvidedForUnPayablePointForHistory(event: ProvidedUnPayablePointEvent): void {
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
    entity.amountPoint = event.params.providedPoint.div(AmountUnit);
    entity.amountToken = BigInt.fromI32(0);
    entity.amountValue = event.params.providedValue.div(AmountUnit);
    entity.feePoint = BigInt.fromI32(0);
    entity.feeToken = BigInt.fromI32(0);
    entity.feeValue = BigInt.fromI32(0);
    entity.currency = event.params.currency;
    entity.balancePoint = event.params.balancePoint.div(AmountUnit);
    entity.balanceToken = balanceEntity.token;
    entity.purchaseId = event.params.purchaseId;
    entity.paymentId = NullBytes32;
    entity.shopId = event.params.shopId;

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
    entity.amountPoint = event.params.providedPoint.div(AmountUnit);
    entity.amountToken = event.params.providedToken.div(AmountUnit);
    entity.amountValue = event.params.providedPoint.div(AmountUnit);
    entity.feePoint = BigInt.fromI32(0);
    entity.feeToken = BigInt.fromI32(0);
    entity.feeValue = BigInt.fromI32(0);
    entity.currency = event.params.currency;
    entity.balanceToken = event.params.balanceToken.div(AmountUnit);
    entity.balancePoint = balanceEntity.point;
    entity.purchaseId = event.params.purchaseId;
    entity.paymentId = NullBytes32;
    entity.shopId = event.params.shopId;

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;
    entity.save();
}

// endregion

// region LoyaltyTransfer
export function handleTransferredLoyaltyToken(event: TransferredLoyaltyTokenEvent): void {
    handleTransferredLoyaltyTokenForHistory(event);
}

export function handleTransferredLoyaltyTokenForHistory(event: TransferredLoyaltyTokenEvent): void {
    {
        const balanceEntity = handleChangedBalanceToken(
            event.params.from,
            event.params.balanceOfFrom,
            event.block.number,
            event.block.timestamp,
            event.transaction.hash
        );

        let entity = new UserTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));
        entity.account = event.params.from;
        entity.pageType = PageType.TRANSFER;
        entity.action = UserAction.OUT;
        entity.cancel = false;
        entity.amountPoint = BigInt.fromI32(0);
        entity.amountToken = event.params.amount.div(AmountUnit);
        entity.amountValue = BigInt.fromI32(0);
        entity.feePoint = BigInt.fromI32(0);
        entity.feeToken = event.params.fee.div(AmountUnit);
        entity.feeValue = BigInt.fromI32(0);
        entity.currency = "TOKEN";
        entity.balanceToken = balanceEntity.token;
        entity.balancePoint = balanceEntity.point;
        entity.purchaseId = "";
        entity.paymentId = NullBytes32;
        entity.shopId = NullBytes32;

        entity.blockNumber = event.block.number;
        entity.blockTimestamp = event.block.timestamp;
        entity.transactionHash = event.transaction.hash;
        entity.save();
    }

    {
        const balanceEntity = handleChangedBalanceToken(
            event.params.to,
            event.params.balanceOfTo,
            event.block.number,
            event.block.timestamp,
            event.transaction.hash
        );

        let entity = new UserTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32() + 1));
        entity.account = event.params.to;
        entity.pageType = PageType.TRANSFER;
        entity.action = UserAction.IN;
        entity.cancel = false;
        entity.amountPoint = BigInt.fromI32(0);
        entity.amountToken = event.params.amount.div(AmountUnit);
        entity.amountValue = BigInt.fromI32(0);
        entity.feePoint = BigInt.fromI32(0);
        entity.feeToken = BigInt.fromI32(0);
        entity.feeValue = BigInt.fromI32(0);
        entity.currency = "TOKEN";
        entity.balanceToken = balanceEntity.token;
        entity.balancePoint = balanceEntity.point;
        entity.purchaseId = "";
        entity.paymentId = NullBytes32;
        entity.shopId = NullBytes32;

        entity.blockNumber = event.block.number;
        entity.blockTimestamp = event.block.timestamp;
        entity.transactionHash = event.transaction.hash;
        entity.save();
    }
}
// endregion

// region LoyaltyConsumer
export function handleLoyaltyPaymentEvent(event: LoyaltyPaymentEventEvent): void {
    let entity = new LoyaltyPaymentEvent(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.paymentId = event.params.payment.paymentId;
    entity.purchaseId = event.params.payment.purchaseId;
    entity.currency = event.params.payment.currency;
    entity.shopId = event.params.payment.shopId;
    entity.account = event.params.payment.account;
    entity.timestamp = event.params.payment.timestamp;
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

export function handleLoyaltyPaymentEventForHistory(event: LoyaltyPaymentEventEvent): void {
    if (event.params.payment.status == LoyaltyPaymentStatus.CLOSED_PAYMENT) {
        handlePaidPointForHistory(event);
    } else if (event.params.payment.status == LoyaltyPaymentStatus.CLOSED_CANCEL) {
        handleCanceledPointForHistory(event);
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
    entity.amountPoint = event.params.payment.paidPoint.plus(event.params.payment.feePoint).div(AmountUnit);
    entity.amountToken = BigInt.fromI32(0);
    entity.amountValue = event.params.payment.paidValue.plus(event.params.payment.feeValue).div(AmountUnit);
    entity.feePoint = event.params.payment.feePoint.div(AmountUnit);
    entity.feeToken = event.params.payment.feeToken.div(AmountUnit);
    entity.feeValue = event.params.payment.feeValue.div(AmountUnit);
    entity.currency = event.params.payment.currency;
    entity.balancePoint = balanceEntity.point;
    entity.balanceToken = balanceEntity.token;
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
    entity.amountPoint = event.params.payment.paidPoint.plus(event.params.payment.feePoint).div(AmountUnit);
    entity.amountToken = BigInt.fromI32(0);
    entity.amountValue = event.params.payment.paidValue.plus(event.params.payment.feeValue).div(AmountUnit);
    entity.feePoint = event.params.payment.feePoint.div(AmountUnit);
    entity.feeToken = event.params.payment.feeToken.div(AmountUnit);
    entity.feeValue = event.params.payment.feeValue.div(AmountUnit);
    entity.currency = event.params.payment.currency;
    entity.balancePoint = balanceEntity.point;
    entity.balanceToken = balanceEntity.token;
    entity.purchaseId = event.params.payment.purchaseId;
    entity.paymentId = event.params.payment.paymentId;
    entity.shopId = event.params.payment.shopId;

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;
    entity.save();
}

// endregion

// region LoyaltyBurner
export function handleBurnedPoint(event: BurnedPointEvent): void {
    let entity = new BurnedPoint(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.account = event.params.account;
    entity.amount = event.params.amount;

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();

    handleBurnedPointForHistory(event);
}

export function handleBurnedPointForHistory(event: BurnedPointEvent): void {
    const balanceEntity = handleChangedBalancePoint(
        event.params.account,
        event.params.balance,
        event.block.number,
        event.block.timestamp,
        event.transaction.hash
    );

    let entity = new UserTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.account = event.params.account;
    entity.pageType = PageType.SAVE_USE;
    entity.action = UserAction.BURNED;
    entity.cancel = false;
    entity.amountPoint = BigInt.fromI32(0);
    entity.amountToken = event.params.amount.div(AmountUnit);
    entity.amountValue = BigInt.fromI32(0);
    entity.feePoint = BigInt.fromI32(0);
    entity.feeToken = BigInt.fromI32(0);
    entity.feeValue = BigInt.fromI32(0);
    entity.balanceToken = balanceEntity.token;
    entity.balancePoint = balanceEntity.point;
    entity.purchaseId = "";
    entity.paymentId = NullBytes32;
    entity.shopId = NullBytes32;

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;
    entity.save();
}

export function handleBurnedUnPayablePoint(event: BurnedUnPayablePointEvent): void {
    let entity = new BurnedUnPayablePoint(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.phone = event.params.phone;
    entity.amount = event.params.amount;
    entity.balance = event.params.balance;

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();
}

export function handleBurnedUnPayablePointForHistory(event: BurnedUnPayablePointEvent): void {
    let entity = new UserUnPayableTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.phone = event.params.phone;
    entity.action = UserAction.BURNED;
    entity.amount = event.params.amount.div(AmountUnit);
    entity.balance = event.params.balance.div(AmountUnit);
    entity.purchaseId = "";
    entity.shopId = NullBytes32;

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;
    entity.save();
}

// endregion

// region LoyaltyBridge

export function handleBridgeDeposited(event: BridgeDepositedEvent): void {
    let entity = new LoyaltyBridgeDeposited(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.tokenId = event.params.tokenId;
    entity.depositId = event.params.depositId;
    entity.account = event.params.account;
    entity.amount = event.params.amount.div(AmountUnit);
    entity.balance = event.params.balance.div(AmountUnit);

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();

    handleBridgeDepositedForHistory(event);
}

export function handleBridgeDepositedForHistory(event: BridgeDepositedEvent): void {
    const balanceEntity = handleChangedBalanceToken(
        event.params.account,
        event.params.balance,
        event.block.number,
        event.block.timestamp,
        event.transaction.hash
    );

    let entity = new UserTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.account = event.params.account;
    entity.pageType = PageType.DEPOSIT_WITHDRAW;
    entity.action = UserAction.WITHDRAWN;
    entity.cancel = false;
    entity.amountPoint = BigInt.fromI32(0);
    entity.amountToken = event.params.amount.div(AmountUnit);
    entity.amountValue = BigInt.fromI32(0);
    entity.feePoint = BigInt.fromI32(0);
    entity.feeToken = BigInt.fromI32(0);
    entity.feeValue = BigInt.fromI32(0);
    entity.balanceToken = balanceEntity.token;
    entity.balancePoint = balanceEntity.point;
    entity.purchaseId = "";
    entity.paymentId = NullBytes32;
    entity.shopId = NullBytes32;

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;
    entity.save();
}

export function handleBridgeWithdrawn(event: BridgeWithdrawnEvent): void {
    let entity = new LoyaltyBridgeWithdrawn(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.tokenId = event.params.tokenId;
    entity.withdrawId = event.params.withdrawId;
    entity.account = event.params.account;
    entity.amount = event.params.amount.div(AmountUnit);
    entity.balance = event.params.balance.div(AmountUnit);

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();

    handleBridgeWithdrawnForHistory(event);
}

export function handleBridgeWithdrawnForHistory(event: BridgeWithdrawnEvent): void {
    const balanceEntity = handleChangedBalanceToken(
        event.params.account,
        event.params.balance,
        event.block.number,
        event.block.timestamp,
        event.transaction.hash
    );

    let entity = new UserTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.account = event.params.account;
    entity.pageType = PageType.DEPOSIT_WITHDRAW;
    entity.action = UserAction.DEPOSITED;
    entity.cancel = false;
    entity.amountPoint = BigInt.fromI32(0);
    entity.amountToken = event.params.amount.div(AmountUnit);
    entity.amountValue = BigInt.fromI32(0);
    entity.feePoint = BigInt.fromI32(0);
    entity.feeToken = BigInt.fromI32(0);
    entity.feeValue = BigInt.fromI32(0);
    entity.balanceToken = balanceEntity.token;
    entity.balancePoint = balanceEntity.point;
    entity.purchaseId = "";
    entity.paymentId = NullBytes32;
    entity.shopId = NullBytes32;

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;
    entity.save();
}

// endregion
