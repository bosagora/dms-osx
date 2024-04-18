import { Transfer as TransferEvent } from "../generated/LoyaltyToken/LoyaltyToken";
import { LoyaltyTransfer } from "../generated/schema";
import { AmountUnit } from "./utils";

export function handleTransfer(event: TransferEvent): void {
    let entity = new LoyaltyTransfer(event.transaction.hash.concatI32(event.logIndex.toI32()));
    entity.from = event.params.from;
    entity.to = event.params.to;
    entity.value = event.params.value.div(AmountUnit);

    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();
}
