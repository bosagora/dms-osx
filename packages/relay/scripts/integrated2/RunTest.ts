import { Amount } from "../../src/common/Amount";
import { Config } from "../../src/common/Config";
import { ContractLoyaltyType, IShopData, IUserData, LoyaltyPaymentTaskStatus } from "../../src/types";
import { ContractUtils } from "../../src/utils/ContractUtils";
import { TestClient } from "../../test/helper/Utility";

import * as path from "path";
import { URL } from "url";

import * as assert from "assert";
import fs from "fs";

// tslint:disable-next-line:no-var-requires
const URI = require("urijs");

export const userData: IUserData[] = [];

export const shopData: IShopData[] = [];

async function main() {
    let relayEndpoint: URL;
    let config: Config;

    console.log("Test auto approval");
    {
        console.log("Load data");
        {
            const users = JSON.parse(fs.readFileSync("./src/data/users.json", "utf8")) as IUserData[];
            userData.push(...users.filter((m) => m.loyaltyType === 1));
            shopData.push(...(JSON.parse(fs.readFileSync("./src/data/shops.json", "utf8")) as IShopData[]));
        }

        console.log("Create Config");
        {
            config = new Config();
            config.readFromFile(path.resolve(process.cwd(), "config", "config_test.yaml"));
        }

        console.log("Create TestServer");
        {
            relayEndpoint = new URL(`http://127.0.0.1:3000`);
        }

        const userIndex = Math.floor(Math.random() * userData.length);
        const shopIndex = Math.floor(Math.random() * shopData.length);

        console.log("Test of payment");
        {
            const MAX_COUNT = 1000;
            for (let idx = 0; idx < MAX_COUNT; idx++) {
                const client = new TestClient();
                const purchase = {
                    purchaseId: "P00" + idx.toString().padStart(4, "0"),
                    timestamp: ContractUtils.getTimeStamp(),
                    amount: 10,
                    currency: "krw",
                    shopIndex,
                    userIndex,
                };
                const purchaseAmount = Amount.make(purchase.amount, 18).value;

                let paymentId: string;
                console.log("Open New Payment");
                {
                    const url = URI(relayEndpoint).directory("/v1/payment/new").filename("open").toString();

                    const params = {
                        accessKey: config.relay.accessKey,
                        purchaseId: purchase.purchaseId,
                        amount: purchaseAmount.toString(),
                        currency: "krw",
                        shopId: shopData[purchase.shopIndex].shopId,
                        account: userData[purchase.userIndex].address,
                    };
                    const response = await client.post(url, params);

                    assert.deepStrictEqual(response.data.code, 0, response.data?.error?.message);
                    assert.ok(response.data.data !== undefined);

                    assert.deepStrictEqual(response.data.data.account, userData[purchase.userIndex].address);
                    assert.deepStrictEqual(response.data.data.loyaltyType, ContractLoyaltyType.TOKEN);
                    assert.deepStrictEqual(response.data.data.paymentStatus, LoyaltyPaymentTaskStatus.OPENED_NEW);

                    paymentId = response.data.data.paymentId;
                }

                console.log("...Check Payment Status - REPLY_COMPLETED_NEW");
                {
                    while (true) {
                        const response = await client.get(
                            URI(relayEndpoint).directory("/v1/payment/item").addQuery("paymentId", paymentId).toString()
                        );
                        if (response.data.data.paymentStatus === LoyaltyPaymentTaskStatus.REPLY_COMPLETED_NEW) break;
                        await ContractUtils.delay(1000);
                    }
                }

                console.log("...Waiting");
                {
                    await ContractUtils.delay(2000);
                }

                console.log("Close New Payment");
                {
                    const response = await client.post(
                        URI(relayEndpoint).directory("/v1/payment/new").filename("close").toString(),
                        {
                            accessKey: config.relay.accessKey,
                            confirm: true,
                            paymentId,
                        }
                    );

                    assert.deepStrictEqual(response.data.code, 0);
                    assert.ok(response.data.data !== undefined);
                    assert.deepStrictEqual(response.data.data.paymentStatus, LoyaltyPaymentTaskStatus.CLOSED_NEW);
                }

                console.log("...Waiting");
                {
                    await ContractUtils.delay(2000);
                }

                console.log("Open Cancel Payment");
                {
                    const url = URI(relayEndpoint).directory("/v1/payment/cancel").filename("open").toString();

                    const params = {
                        accessKey: config.relay.accessKey,
                        paymentId,
                    };
                    const response = await client.post(url, params);

                    assert.deepStrictEqual(response.data.code, 0);
                    assert.ok(response.data.data !== undefined);

                    assert.deepStrictEqual(response.data.data.paymentId, paymentId);
                    assert.deepStrictEqual(response.data.data.purchaseId, purchase.purchaseId);
                    assert.deepStrictEqual(response.data.data.account, userData[purchase.userIndex].address);
                    assert.deepStrictEqual(response.data.data.loyaltyType, ContractLoyaltyType.TOKEN);
                    assert.deepStrictEqual(response.data.data.paymentStatus, LoyaltyPaymentTaskStatus.OPENED_CANCEL);
                }

                console.log("...Check Payment Status - REPLY_COMPLETED_CANCEL");
                {
                    while (true) {
                        const response = await client.get(
                            URI(relayEndpoint).directory("/v1/payment/item").addQuery("paymentId", paymentId).toString()
                        );
                        if (response.data.data.paymentStatus === LoyaltyPaymentTaskStatus.REPLY_COMPLETED_CANCEL) break;
                        await ContractUtils.delay(1000);
                    }
                }

                console.log("...Waiting");
                {
                    await ContractUtils.delay(2000);
                }

                console.log("Close Cancel Payment");
                {
                    const response = await client.post(
                        URI(relayEndpoint).directory("/v1/payment/cancel").filename("close").toString(),
                        {
                            accessKey: config.relay.accessKey,
                            confirm: true,
                            paymentId,
                        }
                    );

                    assert.deepStrictEqual(response.data.code, 0);
                    assert.ok(response.data.data !== undefined);

                    assert.deepStrictEqual(response.data.data.paymentStatus, LoyaltyPaymentTaskStatus.CLOSED_CANCEL);
                }
            }
        }
    }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
