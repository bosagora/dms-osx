import { Config } from "../src/common/Config";

import * as assert from "assert";
import * as path from "path";

describe("Test of Config", () => {
    it("Test parsing the settings of a string", async () => {
        const config: Config = new Config();
        config.readFromFile(path.resolve("test", "config.test.yaml"));

        assert.deepStrictEqual(config.logging.level, "debug");

        assert.deepStrictEqual(config.scheduler.enable, true);
        assert.deepStrictEqual(config.scheduler.items.length, 1);
        assert.deepStrictEqual(config.scheduler.items[0].name, "balance");
        assert.deepStrictEqual(config.scheduler.items[0].enable, true);
        assert.deepStrictEqual(config.scheduler.items[0].expression, "*/1 * * * * *");

        assert.deepStrictEqual(config.setting.validatorKeys, [
            "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
        ]);
        assert.deepStrictEqual(config.contracts.tokenAddress, "0x898Bf21a9e1fF51d3F1248E0A253f6A58C3a736a");
        assert.deepStrictEqual(config.contracts.ledgerAddress, "0xc573eF6FDcaf1461FF2BB75a70B7685ad395AA2d");
        assert.deepStrictEqual(config.contracts.phoneLinkerAddress, "0x8CA2D0080a42DB61cbe59611551412D294FC5911");
    });
});
