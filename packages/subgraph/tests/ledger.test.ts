import { assert, describe, test, clearStore, beforeAll, afterAll } from "matchstick-as/assembly/index";
import { Bytes, BigInt, Address } from "@graphprotocol/graph-ts";
import { Deposited as DepositedEvent } from "../generated/Ledger/Ledger";
import { handleDeposited } from "../src/ledger";
import { createDepositedEvent } from "./ledger-utils";

// Tests structure (matchstick-as >=0.5.0)
// https://thegraph.com/docs/en/developer/matchstick/#tests-structure-0-5-0

describe("Describe entity assertions", () => {
    beforeAll(() => {
        let email = Bytes.fromI32(1234567890);
        let depositAmount = BigInt.fromI32(234);
        let value = BigInt.fromI32(234);
        let balanceToken = BigInt.fromI32(234);
        let account = Address.fromString("0x0000000000000000000000000000000000000001");
        let newDepositedEvent = createDepositedEvent(email, depositAmount, value, balanceToken, account);
        handleDeposited(newDepositedEvent);
    });

    afterAll(() => {
        clearStore();
    });

    // For more test scenarios, see:
    // https://thegraph.com/docs/en/developer/matchstick/#write-a-unit-test

    test("Deposited created and stored", () => {
        assert.entityCount("Deposited", 1);

        // 0xa16081f360e3847006db660bae1c6d1b2e17ec2a is the default address used in newMockEvent() function
        assert.fieldEquals("Deposited", "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1", "email", "1234567890");
        assert.fieldEquals("Deposited", "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1", "depositAmount", "234");
        assert.fieldEquals("Deposited", "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1", "value", "234");
        assert.fieldEquals("Deposited", "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1", "balanceToken", "234");
        assert.fieldEquals(
            "Deposited",
            "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
            "account",
            "0x0000000000000000000000000000000000000001"
        );

        // More assert options:
        // https://thegraph.com/docs/en/developer/matchstick/#asserts
    });
});
