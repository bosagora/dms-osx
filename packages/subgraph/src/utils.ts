import { BigInt, Bytes } from "@graphprotocol/graph-ts";

export const AmountUnit = BigInt.fromI32(1_000_000_000);
export const NullAccount: Bytes = Bytes.fromHexString("0x0000000000000000000000000000000000000000");
export const NullBytes32: Bytes = Bytes.fromHexString(
    "0x0000000000000000000000000000000000000000000000000000000000000000"
);
