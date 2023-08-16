import {
    AddedFranchisee as AddedFranchiseeEvent,
    IncreasedClearedMileage as IncreasedClearedMileageEvent,
    IncreasedProvidedMileage as IncreasedProvidedMileageEvent,
    IncreasedUsedMileage as IncreasedUsedMileageEvent,
} from "../generated/FranchiseeCollection/FranchiseeCollection";
import { Franchisee, FranchiseeTradeHistory } from "../generated/schema";
import { BigInt } from "@graphprotocol/graph-ts";
import { AmountUnit } from "./utils";

export function handleAddedFranchisee(event: AddedFranchiseeEvent): void {
    let entity = new Franchisee(event.params.franchiseeId);

    entity.provideWaitTime = event.params.provideWaitTime;
    entity.email = event.params.email;

    entity.providedMileage = BigInt.fromI32(0);
    entity.usedMileage = BigInt.fromI32(0);
    entity.clearedMileage = BigInt.fromI32(0);

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();
}

export function handleIncreasedClearedMileage(event: IncreasedClearedMileageEvent): void {
    let entity = new FranchiseeTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.action = "ClearedMileage";
    entity.franchiseeId = event.params.franchiseeId;
    entity.purchaseId = event.params.purchaseId;
    entity.increase = event.params.increase.div(AmountUnit);
    entity.clearedMileage = event.params.total.div(AmountUnit);

    let franchiseeEntity = Franchisee.load(event.params.franchiseeId);
    if (franchiseeEntity !== null) {
        entity.providedMileage = franchiseeEntity.providedMileage;
        entity.usedMileage = franchiseeEntity.usedMileage;
        franchiseeEntity.clearedMileage = entity.clearedMileage;
    } else {
        entity.providedMileage = BigInt.fromI32(0);
        entity.usedMileage = BigInt.fromI32(0);
    }

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();
}

export function handleIncreasedProvidedMileage(event: IncreasedProvidedMileageEvent): void {
    let entity = new FranchiseeTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.action = "ProvidedMileage";
    entity.franchiseeId = event.params.franchiseeId;
    entity.purchaseId = event.params.purchaseId;
    entity.increase = event.params.increase.div(AmountUnit);
    entity.providedMileage = event.params.total.div(AmountUnit);

    let franchiseeEntity = Franchisee.load(event.params.franchiseeId);
    if (franchiseeEntity !== null) {
        entity.usedMileage = franchiseeEntity.usedMileage;
        entity.clearedMileage = franchiseeEntity.clearedMileage;
        franchiseeEntity.providedMileage = entity.providedMileage;
    } else {
        entity.usedMileage = BigInt.fromI32(0);
        entity.clearedMileage = BigInt.fromI32(0);
    }

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();
}

export function handleIncreasedUsedMileage(event: IncreasedUsedMileageEvent): void {
    let entity = new FranchiseeTradeHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.action = "UsedMileage";
    entity.franchiseeId = event.params.franchiseeId;
    entity.purchaseId = event.params.purchaseId;
    entity.increase = event.params.increase.div(AmountUnit);
    entity.usedMileage = event.params.total.div(AmountUnit);

    let franchiseeEntity = Franchisee.load(event.params.franchiseeId);
    if (franchiseeEntity !== null) {
        entity.providedMileage = franchiseeEntity.providedMileage;
        entity.clearedMileage = franchiseeEntity.clearedMileage;
        franchiseeEntity.usedMileage = entity.usedMileage;
    } else {
        entity.providedMileage = BigInt.fromI32(0);
        entity.clearedMileage = BigInt.fromI32(0);
    }

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();
}
