import {
    AddedFranchisee as AddedFranchiseeEvent,
    IncreasedClearedPoint as IncreasedClearedPointEvent,
    IncreasedProvidedPoint as IncreasedProvidedPointEvent,
    IncreasedUsedPoint as IncreasedUsedPointEvent,
} from "../generated/FranchiseeCollection/FranchiseeCollection";
import { Franchisee, FranchiseeTradeHistory } from "../generated/schema";
import { BigInt } from "@graphprotocol/graph-ts";
import { AmountUnit } from "./utils";

export function handleAddedFranchisee(event: AddedFranchiseeEvent): void {
    let entity = new Franchisee(event.params.franchiseeId);

    entity.provideWaitTime = event.params.provideWaitTime;
    entity.email = event.params.email;

    entity.providedPoint = BigInt.fromI32(0);
    entity.usedPoint = BigInt.fromI32(0);
    entity.clearedPoint = BigInt.fromI32(0);

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();
}

export function handleIncreasedClearedPoint(event: IncreasedClearedPointEvent): void {
    let entity = new FranchiseeTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.action = "ClearedPoint";
    entity.franchiseeId = event.params.franchiseeId;
    entity.purchaseId = event.params.purchaseId;
    entity.increase = event.params.increase.div(AmountUnit);
    entity.clearedPoint = event.params.total.div(AmountUnit);

    let franchiseeEntity = Franchisee.load(event.params.franchiseeId);
    if (franchiseeEntity !== null) {
        entity.providedPoint = franchiseeEntity.providedPoint;
        entity.usedPoint = franchiseeEntity.usedPoint;
        franchiseeEntity.clearedPoint = entity.clearedPoint;
        franchiseeEntity.blockNumber = event.block.number;
        franchiseeEntity.blockTimestamp = event.block.timestamp;
        franchiseeEntity.transactionHash = event.transaction.hash;
        franchiseeEntity.save();
    } else {
        entity.providedPoint = BigInt.fromI32(0);
        entity.usedPoint = BigInt.fromI32(0);
    }

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();
}

export function handleIncreasedProvidedPoint(event: IncreasedProvidedPointEvent): void {
    let entity = new FranchiseeTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.action = "ProvidedPoint";
    entity.franchiseeId = event.params.franchiseeId;
    entity.purchaseId = event.params.purchaseId;
    entity.increase = event.params.increase.div(AmountUnit);
    entity.providedPoint = event.params.total.div(AmountUnit);

    let franchiseeEntity = Franchisee.load(event.params.franchiseeId);
    if (franchiseeEntity !== null) {
        entity.usedPoint = franchiseeEntity.usedPoint;
        entity.clearedPoint = franchiseeEntity.clearedPoint;
        franchiseeEntity.providedPoint = entity.providedPoint;
        franchiseeEntity.blockNumber = event.block.number;
        franchiseeEntity.blockTimestamp = event.block.timestamp;
        franchiseeEntity.transactionHash = event.transaction.hash;
        franchiseeEntity.save();
    } else {
        entity.usedPoint = BigInt.fromI32(0);
        entity.clearedPoint = BigInt.fromI32(0);
    }

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();
}

export function handleIncreasedUsedPoint(event: IncreasedUsedPointEvent): void {
    let entity = new FranchiseeTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.action = "UsedPoint";
    entity.franchiseeId = event.params.franchiseeId;
    entity.purchaseId = event.params.purchaseId;
    entity.increase = event.params.increase.div(AmountUnit);
    entity.usedPoint = event.params.total.div(AmountUnit);

    let franchiseeEntity = Franchisee.load(event.params.franchiseeId);
    if (franchiseeEntity !== null) {
        entity.providedPoint = franchiseeEntity.providedPoint;
        entity.clearedPoint = franchiseeEntity.clearedPoint;
        franchiseeEntity.usedPoint = entity.usedPoint;
        franchiseeEntity.blockNumber = event.block.number;
        franchiseeEntity.blockTimestamp = event.block.timestamp;
        franchiseeEntity.transactionHash = event.transaction.hash;
        franchiseeEntity.save();
    } else {
        entity.providedPoint = BigInt.fromI32(0);
        entity.clearedPoint = BigInt.fromI32(0);
    }

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();
}
