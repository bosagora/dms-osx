import { newMockEvent } from "matchstick-as";
import { ethereum, BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
    AddedShop,
    IncreasedClearedPoint,
    IncreasedProvidedPoint,
    IncreasedUsedPoint,
} from "../generated/ShopCollection/ShopCollection";

export function createAddedEvent(shopId: string, timestamp: BigInt, email: Bytes): AddedShop {
    let addedEvent = changetype<AddedShop>(newMockEvent());

    addedEvent.parameters = new Array();

    addedEvent.parameters.push(new ethereum.EventParam("shopId", ethereum.Value.fromString(shopId)));
    addedEvent.parameters.push(new ethereum.EventParam("timestamp", ethereum.Value.fromUnsignedBigInt(timestamp)));
    addedEvent.parameters.push(new ethereum.EventParam("email", ethereum.Value.fromFixedBytes(email)));

    return addedEvent;
}

export function createIncreasedClearedPointEvent(
    shopId: string,
    increase: BigInt,
    total: BigInt
): IncreasedClearedPoint {
    let increasedClearedPointEvent = changetype<IncreasedClearedPoint>(newMockEvent());

    increasedClearedPointEvent.parameters = new Array();

    increasedClearedPointEvent.parameters.push(new ethereum.EventParam("shopId", ethereum.Value.fromString(shopId)));
    increasedClearedPointEvent.parameters.push(
        new ethereum.EventParam("increase", ethereum.Value.fromUnsignedBigInt(increase))
    );
    increasedClearedPointEvent.parameters.push(
        new ethereum.EventParam("total", ethereum.Value.fromUnsignedBigInt(total))
    );

    return increasedClearedPointEvent;
}

export function createIncreasedProvidedPointEvent(
    shopId: string,
    increase: BigInt,
    total: BigInt
): IncreasedProvidedPoint {
    let increasedProvidedPointEvent = changetype<IncreasedProvidedPoint>(newMockEvent());

    increasedProvidedPointEvent.parameters = new Array();

    increasedProvidedPointEvent.parameters.push(new ethereum.EventParam("shopId", ethereum.Value.fromString(shopId)));
    increasedProvidedPointEvent.parameters.push(
        new ethereum.EventParam("increase", ethereum.Value.fromUnsignedBigInt(increase))
    );
    increasedProvidedPointEvent.parameters.push(
        new ethereum.EventParam("total", ethereum.Value.fromUnsignedBigInt(total))
    );

    return increasedProvidedPointEvent;
}

export function createIncreasedUsedPointEvent(shopId: string, increase: BigInt, total: BigInt): IncreasedUsedPoint {
    let increasedUsedPointEvent = changetype<IncreasedUsedPoint>(newMockEvent());

    increasedUsedPointEvent.parameters = new Array();

    increasedUsedPointEvent.parameters.push(new ethereum.EventParam("shopId", ethereum.Value.fromString(shopId)));
    increasedUsedPointEvent.parameters.push(
        new ethereum.EventParam("increase", ethereum.Value.fromUnsignedBigInt(increase))
    );
    increasedUsedPointEvent.parameters.push(new ethereum.EventParam("total", ethereum.Value.fromUnsignedBigInt(total)));

    return increasedUsedPointEvent;
}
