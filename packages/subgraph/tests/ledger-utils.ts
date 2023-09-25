import { newMockEvent } from "matchstick-as";
import { ethereum, Bytes, BigInt, Address } from "@graphprotocol/graph-ts";
import {
    Deposited,
    ExchangedPointToToken,
    ExchangedTokenToPoint,
    PaidPoint,
    PaidToken,
    ProvidedPoint,
    ProvidedPointToShop,
    ProvidedToken,
    SavedPurchase,
    Withdrawn,
} from "../generated/Ledger/Ledger";

export function createDepositedEvent(
    email: Bytes,
    depositAmount: BigInt,
    value: BigInt,
    balanceToken: BigInt,
    account: Address
): Deposited {
    let depositedEvent = changetype<Deposited>(newMockEvent());

    depositedEvent.parameters = new Array();

    depositedEvent.parameters.push(new ethereum.EventParam("email", ethereum.Value.fromFixedBytes(email)));
    depositedEvent.parameters.push(
        new ethereum.EventParam("depositAmount", ethereum.Value.fromUnsignedBigInt(depositAmount))
    );
    depositedEvent.parameters.push(new ethereum.EventParam("value", ethereum.Value.fromUnsignedBigInt(value)));
    depositedEvent.parameters.push(
        new ethereum.EventParam("balanceToken", ethereum.Value.fromUnsignedBigInt(balanceToken))
    );
    depositedEvent.parameters.push(new ethereum.EventParam("account", ethereum.Value.fromAddress(account)));

    return depositedEvent;
}

export function createExchangedPointToTokenEvent(
    email: Bytes,
    amountPoint: BigInt,
    amountToken: BigInt,
    balancePoint: BigInt,
    balanceToken: BigInt
): ExchangedPointToToken {
    let exchangedPointToTokenEvent = changetype<ExchangedPointToToken>(newMockEvent());

    exchangedPointToTokenEvent.parameters = new Array();

    exchangedPointToTokenEvent.parameters.push(new ethereum.EventParam("email", ethereum.Value.fromFixedBytes(email)));
    exchangedPointToTokenEvent.parameters.push(
        new ethereum.EventParam("amountPoint", ethereum.Value.fromUnsignedBigInt(amountPoint))
    );
    exchangedPointToTokenEvent.parameters.push(
        new ethereum.EventParam("amountToken", ethereum.Value.fromUnsignedBigInt(amountToken))
    );
    exchangedPointToTokenEvent.parameters.push(
        new ethereum.EventParam("balancePoint", ethereum.Value.fromUnsignedBigInt(balancePoint))
    );
    exchangedPointToTokenEvent.parameters.push(
        new ethereum.EventParam("balanceToken", ethereum.Value.fromUnsignedBigInt(balanceToken))
    );

    return exchangedPointToTokenEvent;
}

export function createExchangedTokenToPointEvent(
    email: Bytes,
    amountPoint: BigInt,
    amountToken: BigInt,
    balancePoint: BigInt,
    balanceToken: BigInt
): ExchangedTokenToPoint {
    let exchangedTokenToPointEvent = changetype<ExchangedTokenToPoint>(newMockEvent());

    exchangedTokenToPointEvent.parameters = new Array();

    exchangedTokenToPointEvent.parameters.push(new ethereum.EventParam("email", ethereum.Value.fromFixedBytes(email)));
    exchangedTokenToPointEvent.parameters.push(
        new ethereum.EventParam("amountPoint", ethereum.Value.fromUnsignedBigInt(amountPoint))
    );
    exchangedTokenToPointEvent.parameters.push(
        new ethereum.EventParam("amountToken", ethereum.Value.fromUnsignedBigInt(amountToken))
    );
    exchangedTokenToPointEvent.parameters.push(
        new ethereum.EventParam("balancePoint", ethereum.Value.fromUnsignedBigInt(balancePoint))
    );
    exchangedTokenToPointEvent.parameters.push(
        new ethereum.EventParam("balanceToken", ethereum.Value.fromUnsignedBigInt(balanceToken))
    );

    return exchangedTokenToPointEvent;
}

export function createPaidPointEvent(
    email: Bytes,
    paidAmountPoint: BigInt,
    value: BigInt,
    balancePoint: BigInt,
    purchaseId: string
): PaidPoint {
    let paidPointEvent = changetype<PaidPoint>(newMockEvent());

    paidPointEvent.parameters = new Array();

    paidPointEvent.parameters.push(new ethereum.EventParam("email", ethereum.Value.fromFixedBytes(email)));
    paidPointEvent.parameters.push(
        new ethereum.EventParam("paidAmountPoint", ethereum.Value.fromUnsignedBigInt(paidAmountPoint))
    );
    paidPointEvent.parameters.push(new ethereum.EventParam("value", ethereum.Value.fromUnsignedBigInt(value)));
    paidPointEvent.parameters.push(
        new ethereum.EventParam("balancePoint", ethereum.Value.fromUnsignedBigInt(balancePoint))
    );
    paidPointEvent.parameters.push(new ethereum.EventParam("purchaseId", ethereum.Value.fromString(purchaseId)));

    return paidPointEvent;
}

export function createPaidTokenEvent(
    email: Bytes,
    paidAmountToken: BigInt,
    value: BigInt,
    balanceToken: BigInt,
    purchaseId: string
): PaidToken {
    let paidTokenEvent = changetype<PaidToken>(newMockEvent());

    paidTokenEvent.parameters = new Array();

    paidTokenEvent.parameters.push(new ethereum.EventParam("email", ethereum.Value.fromFixedBytes(email)));
    paidTokenEvent.parameters.push(
        new ethereum.EventParam("paidAmountToken", ethereum.Value.fromUnsignedBigInt(paidAmountToken))
    );
    paidTokenEvent.parameters.push(new ethereum.EventParam("value", ethereum.Value.fromUnsignedBigInt(value)));
    paidTokenEvent.parameters.push(
        new ethereum.EventParam("balanceToken", ethereum.Value.fromUnsignedBigInt(balanceToken))
    );
    paidTokenEvent.parameters.push(new ethereum.EventParam("purchaseId", ethereum.Value.fromString(purchaseId)));

    return paidTokenEvent;
}

export function createProvidedPointEvent(
    email: Bytes,
    providedAmountPoint: BigInt,
    value: BigInt,
    balancePoint: BigInt,
    purchaseId: string
): ProvidedPoint {
    let providedPointEvent = changetype<ProvidedPoint>(newMockEvent());

    providedPointEvent.parameters = new Array();

    providedPointEvent.parameters.push(new ethereum.EventParam("email", ethereum.Value.fromFixedBytes(email)));
    providedPointEvent.parameters.push(
        new ethereum.EventParam("providedAmountPoint", ethereum.Value.fromUnsignedBigInt(providedAmountPoint))
    );
    providedPointEvent.parameters.push(new ethereum.EventParam("value", ethereum.Value.fromUnsignedBigInt(value)));
    providedPointEvent.parameters.push(
        new ethereum.EventParam("balancePoint", ethereum.Value.fromUnsignedBigInt(balancePoint))
    );
    providedPointEvent.parameters.push(new ethereum.EventParam("purchaseId", ethereum.Value.fromString(purchaseId)));

    return providedPointEvent;
}

export function createProvidedPointToShopEvent(
    email: Bytes,
    providedAmountPoint: BigInt,
    value: BigInt,
    balancePoint: BigInt,
    shopId: string
): ProvidedPointToShop {
    let providedPointToShopEvent = changetype<ProvidedPointToShop>(newMockEvent());

    providedPointToShopEvent.parameters = new Array();

    providedPointToShopEvent.parameters.push(new ethereum.EventParam("email", ethereum.Value.fromFixedBytes(email)));
    providedPointToShopEvent.parameters.push(
        new ethereum.EventParam("providedAmountPoint", ethereum.Value.fromUnsignedBigInt(providedAmountPoint))
    );
    providedPointToShopEvent.parameters.push(
        new ethereum.EventParam("value", ethereum.Value.fromUnsignedBigInt(value))
    );
    providedPointToShopEvent.parameters.push(
        new ethereum.EventParam("balancePoint", ethereum.Value.fromUnsignedBigInt(balancePoint))
    );
    providedPointToShopEvent.parameters.push(new ethereum.EventParam("shopId", ethereum.Value.fromString(shopId)));

    return providedPointToShopEvent;
}

export function createProvidedTokenEvent(
    email: Bytes,
    providedAmountToken: BigInt,
    value: BigInt,
    balanceToken: BigInt,
    purchaseId: string
): ProvidedToken {
    let providedTokenEvent = changetype<ProvidedToken>(newMockEvent());

    providedTokenEvent.parameters = new Array();

    providedTokenEvent.parameters.push(new ethereum.EventParam("email", ethereum.Value.fromFixedBytes(email)));
    providedTokenEvent.parameters.push(
        new ethereum.EventParam("providedAmountToken", ethereum.Value.fromUnsignedBigInt(providedAmountToken))
    );
    providedTokenEvent.parameters.push(new ethereum.EventParam("value", ethereum.Value.fromUnsignedBigInt(value)));
    providedTokenEvent.parameters.push(
        new ethereum.EventParam("balanceToken", ethereum.Value.fromUnsignedBigInt(balanceToken))
    );
    providedTokenEvent.parameters.push(new ethereum.EventParam("purchaseId", ethereum.Value.fromString(purchaseId)));

    return providedTokenEvent;
}

export function createSavedPurchaseEvent(
    purchaseId: string,
    timestamp: BigInt,
    amount: BigInt,
    email: Bytes,
    shopId: string,
    method: BigInt
): SavedPurchase {
    let savedPurchaseEvent = changetype<SavedPurchase>(newMockEvent());

    savedPurchaseEvent.parameters = new Array();

    savedPurchaseEvent.parameters.push(new ethereum.EventParam("purchaseId", ethereum.Value.fromString(purchaseId)));
    savedPurchaseEvent.parameters.push(
        new ethereum.EventParam("timestamp", ethereum.Value.fromUnsignedBigInt(timestamp))
    );
    savedPurchaseEvent.parameters.push(new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount)));
    savedPurchaseEvent.parameters.push(new ethereum.EventParam("email", ethereum.Value.fromFixedBytes(email)));
    savedPurchaseEvent.parameters.push(new ethereum.EventParam("shopId", ethereum.Value.fromString(shopId)));
    savedPurchaseEvent.parameters.push(new ethereum.EventParam("method", ethereum.Value.fromUnsignedBigInt(method)));

    return savedPurchaseEvent;
}

export function createWithdrawnEvent(
    email: Bytes,
    withdrawAmount: BigInt,
    value: BigInt,
    balanceToken: BigInt,
    account: Address
): Withdrawn {
    let withdrawnEvent = changetype<Withdrawn>(newMockEvent());

    withdrawnEvent.parameters = new Array();

    withdrawnEvent.parameters.push(new ethereum.EventParam("email", ethereum.Value.fromFixedBytes(email)));
    withdrawnEvent.parameters.push(
        new ethereum.EventParam("withdrawAmount", ethereum.Value.fromUnsignedBigInt(withdrawAmount))
    );
    withdrawnEvent.parameters.push(new ethereum.EventParam("value", ethereum.Value.fromUnsignedBigInt(value)));
    withdrawnEvent.parameters.push(
        new ethereum.EventParam("balanceToken", ethereum.Value.fromUnsignedBigInt(balanceToken))
    );
    withdrawnEvent.parameters.push(new ethereum.EventParam("account", ethereum.Value.fromAddress(account)));

    return withdrawnEvent;
}
