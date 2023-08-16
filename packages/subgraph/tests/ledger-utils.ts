import { newMockEvent } from "matchstick-as"
import { ethereum, Bytes, BigInt, Address } from "@graphprotocol/graph-ts"
import {
  Deposited,
  ExchangedMileageToToken,
  ExchangedTokenToMileage,
  PaidMileage,
  PaidToken,
  ProvidedMileage,
  ProvidedMileageToFranchisee,
  ProvidedToken,
  SavedPurchase,
  Withdrawn
} from "../generated/Ledger/Ledger"

export function createDepositedEvent(
  email: Bytes,
  depositAmount: BigInt,
  value: BigInt,
  balanceToken: BigInt,
  account: Address
): Deposited {
  let depositedEvent = changetype<Deposited>(newMockEvent())

  depositedEvent.parameters = new Array()

  depositedEvent.parameters.push(
    new ethereum.EventParam("email", ethereum.Value.fromFixedBytes(email))
  )
  depositedEvent.parameters.push(
    new ethereum.EventParam(
      "depositAmount",
      ethereum.Value.fromUnsignedBigInt(depositAmount)
    )
  )
  depositedEvent.parameters.push(
    new ethereum.EventParam("value", ethereum.Value.fromUnsignedBigInt(value))
  )
  depositedEvent.parameters.push(
    new ethereum.EventParam(
      "balanceToken",
      ethereum.Value.fromUnsignedBigInt(balanceToken)
    )
  )
  depositedEvent.parameters.push(
    new ethereum.EventParam("account", ethereum.Value.fromAddress(account))
  )

  return depositedEvent
}

export function createExchangedMileageToTokenEvent(
  email: Bytes,
  amountMileage: BigInt,
  amountToken: BigInt,
  balanceMileage: BigInt,
  balanceToken: BigInt
): ExchangedMileageToToken {
  let exchangedMileageToTokenEvent = changetype<ExchangedMileageToToken>(
    newMockEvent()
  )

  exchangedMileageToTokenEvent.parameters = new Array()

  exchangedMileageToTokenEvent.parameters.push(
    new ethereum.EventParam("email", ethereum.Value.fromFixedBytes(email))
  )
  exchangedMileageToTokenEvent.parameters.push(
    new ethereum.EventParam(
      "amountMileage",
      ethereum.Value.fromUnsignedBigInt(amountMileage)
    )
  )
  exchangedMileageToTokenEvent.parameters.push(
    new ethereum.EventParam(
      "amountToken",
      ethereum.Value.fromUnsignedBigInt(amountToken)
    )
  )
  exchangedMileageToTokenEvent.parameters.push(
    new ethereum.EventParam(
      "balanceMileage",
      ethereum.Value.fromUnsignedBigInt(balanceMileage)
    )
  )
  exchangedMileageToTokenEvent.parameters.push(
    new ethereum.EventParam(
      "balanceToken",
      ethereum.Value.fromUnsignedBigInt(balanceToken)
    )
  )

  return exchangedMileageToTokenEvent
}

export function createExchangedTokenToMileageEvent(
  email: Bytes,
  amountMileage: BigInt,
  amountToken: BigInt,
  balanceMileage: BigInt,
  balanceToken: BigInt
): ExchangedTokenToMileage {
  let exchangedTokenToMileageEvent = changetype<ExchangedTokenToMileage>(
    newMockEvent()
  )

  exchangedTokenToMileageEvent.parameters = new Array()

  exchangedTokenToMileageEvent.parameters.push(
    new ethereum.EventParam("email", ethereum.Value.fromFixedBytes(email))
  )
  exchangedTokenToMileageEvent.parameters.push(
    new ethereum.EventParam(
      "amountMileage",
      ethereum.Value.fromUnsignedBigInt(amountMileage)
    )
  )
  exchangedTokenToMileageEvent.parameters.push(
    new ethereum.EventParam(
      "amountToken",
      ethereum.Value.fromUnsignedBigInt(amountToken)
    )
  )
  exchangedTokenToMileageEvent.parameters.push(
    new ethereum.EventParam(
      "balanceMileage",
      ethereum.Value.fromUnsignedBigInt(balanceMileage)
    )
  )
  exchangedTokenToMileageEvent.parameters.push(
    new ethereum.EventParam(
      "balanceToken",
      ethereum.Value.fromUnsignedBigInt(balanceToken)
    )
  )

  return exchangedTokenToMileageEvent
}

export function createPaidMileageEvent(
  email: Bytes,
  paidAmountMileage: BigInt,
  value: BigInt,
  balanceMileage: BigInt,
  purchaseId: string
): PaidMileage {
  let paidMileageEvent = changetype<PaidMileage>(newMockEvent())

  paidMileageEvent.parameters = new Array()

  paidMileageEvent.parameters.push(
    new ethereum.EventParam("email", ethereum.Value.fromFixedBytes(email))
  )
  paidMileageEvent.parameters.push(
    new ethereum.EventParam(
      "paidAmountMileage",
      ethereum.Value.fromUnsignedBigInt(paidAmountMileage)
    )
  )
  paidMileageEvent.parameters.push(
    new ethereum.EventParam("value", ethereum.Value.fromUnsignedBigInt(value))
  )
  paidMileageEvent.parameters.push(
    new ethereum.EventParam(
      "balanceMileage",
      ethereum.Value.fromUnsignedBigInt(balanceMileage)
    )
  )
  paidMileageEvent.parameters.push(
    new ethereum.EventParam("purchaseId", ethereum.Value.fromString(purchaseId))
  )

  return paidMileageEvent
}

export function createPaidTokenEvent(
  email: Bytes,
  paidAmountToken: BigInt,
  value: BigInt,
  balanceToken: BigInt,
  purchaseId: string
): PaidToken {
  let paidTokenEvent = changetype<PaidToken>(newMockEvent())

  paidTokenEvent.parameters = new Array()

  paidTokenEvent.parameters.push(
    new ethereum.EventParam("email", ethereum.Value.fromFixedBytes(email))
  )
  paidTokenEvent.parameters.push(
    new ethereum.EventParam(
      "paidAmountToken",
      ethereum.Value.fromUnsignedBigInt(paidAmountToken)
    )
  )
  paidTokenEvent.parameters.push(
    new ethereum.EventParam("value", ethereum.Value.fromUnsignedBigInt(value))
  )
  paidTokenEvent.parameters.push(
    new ethereum.EventParam(
      "balanceToken",
      ethereum.Value.fromUnsignedBigInt(balanceToken)
    )
  )
  paidTokenEvent.parameters.push(
    new ethereum.EventParam("purchaseId", ethereum.Value.fromString(purchaseId))
  )

  return paidTokenEvent
}

export function createProvidedMileageEvent(
  email: Bytes,
  providedAmountMileage: BigInt,
  value: BigInt,
  balanceMileage: BigInt,
  purchaseId: string
): ProvidedMileage {
  let providedMileageEvent = changetype<ProvidedMileage>(newMockEvent())

  providedMileageEvent.parameters = new Array()

  providedMileageEvent.parameters.push(
    new ethereum.EventParam("email", ethereum.Value.fromFixedBytes(email))
  )
  providedMileageEvent.parameters.push(
    new ethereum.EventParam(
      "providedAmountMileage",
      ethereum.Value.fromUnsignedBigInt(providedAmountMileage)
    )
  )
  providedMileageEvent.parameters.push(
    new ethereum.EventParam("value", ethereum.Value.fromUnsignedBigInt(value))
  )
  providedMileageEvent.parameters.push(
    new ethereum.EventParam(
      "balanceMileage",
      ethereum.Value.fromUnsignedBigInt(balanceMileage)
    )
  )
  providedMileageEvent.parameters.push(
    new ethereum.EventParam("purchaseId", ethereum.Value.fromString(purchaseId))
  )

  return providedMileageEvent
}

export function createProvidedMileageToFranchiseeEvent(
  email: Bytes,
  providedAmountMileage: BigInt,
  value: BigInt,
  balanceMileage: BigInt,
  franchiseeId: string
): ProvidedMileageToFranchisee {
  let providedMileageToFranchiseeEvent = changetype<
    ProvidedMileageToFranchisee
  >(newMockEvent())

  providedMileageToFranchiseeEvent.parameters = new Array()

  providedMileageToFranchiseeEvent.parameters.push(
    new ethereum.EventParam("email", ethereum.Value.fromFixedBytes(email))
  )
  providedMileageToFranchiseeEvent.parameters.push(
    new ethereum.EventParam(
      "providedAmountMileage",
      ethereum.Value.fromUnsignedBigInt(providedAmountMileage)
    )
  )
  providedMileageToFranchiseeEvent.parameters.push(
    new ethereum.EventParam("value", ethereum.Value.fromUnsignedBigInt(value))
  )
  providedMileageToFranchiseeEvent.parameters.push(
    new ethereum.EventParam(
      "balanceMileage",
      ethereum.Value.fromUnsignedBigInt(balanceMileage)
    )
  )
  providedMileageToFranchiseeEvent.parameters.push(
    new ethereum.EventParam(
      "franchiseeId",
      ethereum.Value.fromString(franchiseeId)
    )
  )

  return providedMileageToFranchiseeEvent
}

export function createProvidedTokenEvent(
  email: Bytes,
  providedAmountToken: BigInt,
  value: BigInt,
  balanceToken: BigInt,
  purchaseId: string
): ProvidedToken {
  let providedTokenEvent = changetype<ProvidedToken>(newMockEvent())

  providedTokenEvent.parameters = new Array()

  providedTokenEvent.parameters.push(
    new ethereum.EventParam("email", ethereum.Value.fromFixedBytes(email))
  )
  providedTokenEvent.parameters.push(
    new ethereum.EventParam(
      "providedAmountToken",
      ethereum.Value.fromUnsignedBigInt(providedAmountToken)
    )
  )
  providedTokenEvent.parameters.push(
    new ethereum.EventParam("value", ethereum.Value.fromUnsignedBigInt(value))
  )
  providedTokenEvent.parameters.push(
    new ethereum.EventParam(
      "balanceToken",
      ethereum.Value.fromUnsignedBigInt(balanceToken)
    )
  )
  providedTokenEvent.parameters.push(
    new ethereum.EventParam("purchaseId", ethereum.Value.fromString(purchaseId))
  )

  return providedTokenEvent
}

export function createSavedPurchaseEvent(
  purchaseId: string,
  timestamp: BigInt,
  amount: BigInt,
  email: Bytes,
  franchiseeId: string,
  method: BigInt
): SavedPurchase {
  let savedPurchaseEvent = changetype<SavedPurchase>(newMockEvent())

  savedPurchaseEvent.parameters = new Array()

  savedPurchaseEvent.parameters.push(
    new ethereum.EventParam("purchaseId", ethereum.Value.fromString(purchaseId))
  )
  savedPurchaseEvent.parameters.push(
    new ethereum.EventParam(
      "timestamp",
      ethereum.Value.fromUnsignedBigInt(timestamp)
    )
  )
  savedPurchaseEvent.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount))
  )
  savedPurchaseEvent.parameters.push(
    new ethereum.EventParam("email", ethereum.Value.fromFixedBytes(email))
  )
  savedPurchaseEvent.parameters.push(
    new ethereum.EventParam(
      "franchiseeId",
      ethereum.Value.fromString(franchiseeId)
    )
  )
  savedPurchaseEvent.parameters.push(
    new ethereum.EventParam("method", ethereum.Value.fromUnsignedBigInt(method))
  )

  return savedPurchaseEvent
}

export function createWithdrawnEvent(
  email: Bytes,
  withdrawAmount: BigInt,
  value: BigInt,
  balanceToken: BigInt,
  account: Address
): Withdrawn {
  let withdrawnEvent = changetype<Withdrawn>(newMockEvent())

  withdrawnEvent.parameters = new Array()

  withdrawnEvent.parameters.push(
    new ethereum.EventParam("email", ethereum.Value.fromFixedBytes(email))
  )
  withdrawnEvent.parameters.push(
    new ethereum.EventParam(
      "withdrawAmount",
      ethereum.Value.fromUnsignedBigInt(withdrawAmount)
    )
  )
  withdrawnEvent.parameters.push(
    new ethereum.EventParam("value", ethereum.Value.fromUnsignedBigInt(value))
  )
  withdrawnEvent.parameters.push(
    new ethereum.EventParam(
      "balanceToken",
      ethereum.Value.fromUnsignedBigInt(balanceToken)
    )
  )
  withdrawnEvent.parameters.push(
    new ethereum.EventParam("account", ethereum.Value.fromAddress(account))
  )

  return withdrawnEvent
}
