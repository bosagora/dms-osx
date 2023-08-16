import { newMockEvent } from "matchstick-as";
import { ethereum, BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
    AddedFranchisee,
    IncreasedClearedMileage,
    IncreasedProvidedMileage,
    IncreasedUsedMileage,
} from "../generated/FranchiseeCollection/FranchiseeCollection";

export function createAddedEvent(franchiseeId: string, timestamp: BigInt, email: Bytes): AddedFranchisee {
    let addedEvent = changetype<AddedFranchisee>(newMockEvent());

    addedEvent.parameters = new Array();

    addedEvent.parameters.push(new ethereum.EventParam("franchiseeId", ethereum.Value.fromString(franchiseeId)));
    addedEvent.parameters.push(new ethereum.EventParam("timestamp", ethereum.Value.fromUnsignedBigInt(timestamp)));
    addedEvent.parameters.push(new ethereum.EventParam("email", ethereum.Value.fromFixedBytes(email)));

    return addedEvent;
}

export function createIncreasedClearedMileageEvent(
    franchiseeId: string,
    increase: BigInt,
    total: BigInt
): IncreasedClearedMileage {
    let increasedClearedMileageEvent = changetype<IncreasedClearedMileage>(newMockEvent());

    increasedClearedMileageEvent.parameters = new Array();

    increasedClearedMileageEvent.parameters.push(
        new ethereum.EventParam("franchiseeId", ethereum.Value.fromString(franchiseeId))
    );
    increasedClearedMileageEvent.parameters.push(
        new ethereum.EventParam("increase", ethereum.Value.fromUnsignedBigInt(increase))
    );
    increasedClearedMileageEvent.parameters.push(
        new ethereum.EventParam("total", ethereum.Value.fromUnsignedBigInt(total))
    );

    return increasedClearedMileageEvent;
}

export function createIncreasedProvidedMileageEvent(
    franchiseeId: string,
    increase: BigInt,
    total: BigInt
): IncreasedProvidedMileage {
    let increasedProvidedMileageEvent = changetype<IncreasedProvidedMileage>(newMockEvent());

    increasedProvidedMileageEvent.parameters = new Array();

    increasedProvidedMileageEvent.parameters.push(
        new ethereum.EventParam("franchiseeId", ethereum.Value.fromString(franchiseeId))
    );
    increasedProvidedMileageEvent.parameters.push(
        new ethereum.EventParam("increase", ethereum.Value.fromUnsignedBigInt(increase))
    );
    increasedProvidedMileageEvent.parameters.push(
        new ethereum.EventParam("total", ethereum.Value.fromUnsignedBigInt(total))
    );

    return increasedProvidedMileageEvent;
}

export function createIncreasedUsedMileageEvent(
    franchiseeId: string,
    increase: BigInt,
    total: BigInt
): IncreasedUsedMileage {
    let increasedUsedMileageEvent = changetype<IncreasedUsedMileage>(newMockEvent());

    increasedUsedMileageEvent.parameters = new Array();

    increasedUsedMileageEvent.parameters.push(
        new ethereum.EventParam("franchiseeId", ethereum.Value.fromString(franchiseeId))
    );
    increasedUsedMileageEvent.parameters.push(
        new ethereum.EventParam("increase", ethereum.Value.fromUnsignedBigInt(increase))
    );
    increasedUsedMileageEvent.parameters.push(
        new ethereum.EventParam("total", ethereum.Value.fromUnsignedBigInt(total))
    );

    return increasedUsedMileageEvent;
}
