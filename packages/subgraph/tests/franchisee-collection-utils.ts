import { newMockEvent } from "matchstick-as";
import { ethereum, BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
    AddedFranchisee,
    IncreasedClearedPoint,
    IncreasedProvidedPoint,
    IncreasedUsedPoint,
} from "../generated/FranchiseeCollection/FranchiseeCollection";

export function createAddedEvent(franchiseeId: string, timestamp: BigInt, email: Bytes): AddedFranchisee {
    let addedEvent = changetype<AddedFranchisee>(newMockEvent());

    addedEvent.parameters = new Array();

    addedEvent.parameters.push(new ethereum.EventParam("franchiseeId", ethereum.Value.fromString(franchiseeId)));
    addedEvent.parameters.push(new ethereum.EventParam("timestamp", ethereum.Value.fromUnsignedBigInt(timestamp)));
    addedEvent.parameters.push(new ethereum.EventParam("email", ethereum.Value.fromFixedBytes(email)));

    return addedEvent;
}

export function createIncreasedClearedPointEvent(
    franchiseeId: string,
    increase: BigInt,
    total: BigInt
): IncreasedClearedPoint {
    let increasedClearedPointEvent = changetype<IncreasedClearedPoint>(newMockEvent());

    increasedClearedPointEvent.parameters = new Array();

    increasedClearedPointEvent.parameters.push(
        new ethereum.EventParam("franchiseeId", ethereum.Value.fromString(franchiseeId))
    );
    increasedClearedPointEvent.parameters.push(
        new ethereum.EventParam("increase", ethereum.Value.fromUnsignedBigInt(increase))
    );
    increasedClearedPointEvent.parameters.push(
        new ethereum.EventParam("total", ethereum.Value.fromUnsignedBigInt(total))
    );

    return increasedClearedPointEvent;
}

export function createIncreasedProvidedPointEvent(
    franchiseeId: string,
    increase: BigInt,
    total: BigInt
): IncreasedProvidedPoint {
    let increasedProvidedPointEvent = changetype<IncreasedProvidedPoint>(newMockEvent());

    increasedProvidedPointEvent.parameters = new Array();

    increasedProvidedPointEvent.parameters.push(
        new ethereum.EventParam("franchiseeId", ethereum.Value.fromString(franchiseeId))
    );
    increasedProvidedPointEvent.parameters.push(
        new ethereum.EventParam("increase", ethereum.Value.fromUnsignedBigInt(increase))
    );
    increasedProvidedPointEvent.parameters.push(
        new ethereum.EventParam("total", ethereum.Value.fromUnsignedBigInt(total))
    );

    return increasedProvidedPointEvent;
}

export function createIncreasedUsedPointEvent(
    franchiseeId: string,
    increase: BigInt,
    total: BigInt
): IncreasedUsedPoint {
    let increasedUsedPointEvent = changetype<IncreasedUsedPoint>(newMockEvent());

    increasedUsedPointEvent.parameters = new Array();

    increasedUsedPointEvent.parameters.push(
        new ethereum.EventParam("franchiseeId", ethereum.Value.fromString(franchiseeId))
    );
    increasedUsedPointEvent.parameters.push(
        new ethereum.EventParam("increase", ethereum.Value.fromUnsignedBigInt(increase))
    );
    increasedUsedPointEvent.parameters.push(new ethereum.EventParam("total", ethereum.Value.fromUnsignedBigInt(total)));

    return increasedUsedPointEvent;
}
