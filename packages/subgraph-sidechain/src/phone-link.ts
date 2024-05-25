import {
    AcceptedRequestItem as AcceptedRequestItemEvent,
    AddedRequestItem as AddedRequestItemEvent,
    RejectedRequestItem as RejectedRequestItemEvent,
} from "../generated/PhoneLinkCollection/PhoneLinkCollection";
import { PhoneLinkItems, PhoneRequestItems } from "../generated/schema";

export function handleAddedRequestItem(event: AddedRequestItemEvent): void {
    let entity = new PhoneRequestItems(event.params.id);
    entity.phone = event.params.phone;
    entity.wallet = event.params.wallet;
    entity.status = "REQUESTED";

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();
}

export function handleAcceptedRequestItem(event: AcceptedRequestItemEvent): void {
    let entity = PhoneRequestItems.load(event.params.id);
    if (entity === null) {
        entity = new PhoneRequestItems(event.params.id);
    }
    entity.phone = event.params.phone;
    entity.wallet = event.params.wallet;
    entity.status = "ACCEPTED";

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();

    let linkEntity = PhoneLinkItems.load(event.params.phone);
    if (linkEntity === null) {
        linkEntity = new PhoneLinkItems(event.params.phone);
    }
    linkEntity.wallet = event.params.wallet;
    linkEntity.blockNumber = event.block.number;
    linkEntity.blockTimestamp = event.block.timestamp;
    linkEntity.transactionHash = event.transaction.hash;
    linkEntity.save();
}

export function handleRejectedRequestItem(event: RejectedRequestItemEvent): void {
    let entity = PhoneRequestItems.load(event.params.id);
    if (entity === null) {
        entity = new PhoneRequestItems(event.params.id);
    }
    entity.phone = event.params.phone;
    entity.wallet = event.params.wallet;
    entity.status = "REJECTED";

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();
}
