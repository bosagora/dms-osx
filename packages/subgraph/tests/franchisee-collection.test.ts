import { assert, describe, test, clearStore, beforeAll, afterAll } from "matchstick-as/assembly/index";
import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import { AddedFranchisee } from "../generated/schema";
import { AddedFranchisee as AddedEvent } from "../generated/FranchiseeCollection/FranchiseeCollection";
import { handleAddedFranchisee } from "../src/franchisee-collection";
import { createAddedEvent } from "./franchisee-collection-utils";

// Tests structure (matchstick-as >=0.5.0)
// https://thegraph.com/docs/en/developer/matchstick/#tests-structure-0-5-0

describe("Describe entity assertions", () => {
    beforeAll(() => {
        let franchiseeId = "Example string value";
        let timestamp = BigInt.fromI32(234);
        let email = Bytes.fromI32(1234567890);
        let newAddedEvent = createAddedEvent(franchiseeId, timestamp, email);
        handleAddedFranchisee(newAddedEvent);
    });

    afterAll(() => {
        clearStore();
    });

    // For more test scenarios, see:
    // https://thegraph.com/docs/en/developer/matchstick/#write-a-unit-test

    test("AddedFranchisee created and stored", () => {
        assert.entityCount("AddedFranchisee", 1);

        // 0xa16081f360e3847006db660bae1c6d1b2e17ec2a is the default address used in newMockEvent() function
        assert.fieldEquals(
            "AddedFranchisee",
            "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
            "franchiseeId",
            "Example string value"
        );
        assert.fieldEquals("AddedFranchisee", "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1", "timestamp", "234");
        assert.fieldEquals("AddedFranchisee", "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1", "email", "1234567890");

        // More assert options:
        // https://thegraph.com/docs/en/developer/matchstick/#asserts
    });
});
