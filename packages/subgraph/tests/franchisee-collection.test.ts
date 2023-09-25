import { assert, describe, test, clearStore, beforeAll, afterAll } from "matchstick-as/assembly/index";
import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import { AddedShop } from "../generated/schema";
import { AddedShop as AddedEvent } from "../generated/ShopCollection/ShopCollection";
import { handleAddedShop } from "../src/shop-collection";
import { createAddedEvent } from "./shop-collection-utils";

// Tests structure (matchstick-as >=0.5.0)
// https://thegraph.com/docs/en/developer/matchstick/#tests-structure-0-5-0

describe("Describe entity assertions", () => {
    beforeAll(() => {
        let shopId = "Example string value";
        let timestamp = BigInt.fromI32(234);
        let email = Bytes.fromI32(1234567890);
        let newAddedEvent = createAddedEvent(shopId, timestamp, email);
        handleAddedShop(newAddedEvent);
    });

    afterAll(() => {
        clearStore();
    });

    // For more test scenarios, see:
    // https://thegraph.com/docs/en/developer/matchstick/#write-a-unit-test

    test("AddedShop created and stored", () => {
        assert.entityCount("AddedShop", 1);

        // 0xa16081f360e3847006db660bae1c6d1b2e17ec2a is the default address used in newMockEvent() function
        assert.fieldEquals(
            "AddedShop",
            "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
            "shopId",
            "Example string value"
        );
        assert.fieldEquals("AddedShop", "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1", "timestamp", "234");
        assert.fieldEquals("AddedShop", "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1", "email", "1234567890");

        // More assert options:
        // https://thegraph.com/docs/en/developer/matchstick/#asserts
    });
});
