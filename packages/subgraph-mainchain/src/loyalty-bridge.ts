import {
    BridgeDeposited as BridgeDepositedEvent,
    BridgeWithdrawn as BridgeWithdrawnEvent,
} from "../generated/LoyaltyBridge/LoyaltyBridge";
import { LoyaltyBridgeDeposited, LoyaltyBridgeWithdrawn } from "../generated/schema";
import { AmountUnit } from "dms-osx-subgraph-sidechain/src/utils";

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
}
