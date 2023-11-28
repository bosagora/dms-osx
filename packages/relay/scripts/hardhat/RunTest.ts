import { Amount } from "../../src/common/Amount";
import { ContractLoyaltyType, IShopData, IUserData, LoyaltyPaymentTaskStatus } from "../../src/types";
import { HTTPClient, Utils } from "../../src/utils/Utils";

import * as assert from "assert";
import fs from "fs";

// tslint:disable-next-line:no-var-requires
const URI = require("urijs");

export const userData: IUserData[] = [];

export const shopData: IShopData[] = [];

async function main() {
    const RELAY_ENDPOINT = "http://localhost:7070";
    const ACCESS_KEY = "0x2c93e943c0d7f6f1a42f53e116c52c40fe5c1b428506dc04b290f2a77580a342";

    console.log("Test auto approval");
    {
        console.log("Load data");
        {
            const users = JSON.parse(fs.readFileSync("./src/data/users.json", "utf8")) as IUserData[];
            userData.push(...users.filter((m) => m.loyaltyType === 1));
            shopData.push(...(JSON.parse(fs.readFileSync("./src/data/shops.json", "utf8")) as IShopData[]));
        }

        const userIndex =
            process.argv[2] !== undefined && Number(process.argv[2]) > 0
                ? Number(process.argv[2])
                : Math.floor(Math.random() * userData.length);
        const shopIndex = Math.floor(Math.random() * shopData.length);

        console.log(`User index: ${userIndex}, Account: ${userData[userIndex].address}`);

        console.log("Test of payment");
        {
            const MAX_COUNT = 1000;
            for (let idx = 0; idx < MAX_COUNT; idx++) {
                const client = new HTTPClient();
                const purchase = {
                    purchaseId: "P00" + idx.toString().padStart(4, "0"),
                    amount: 10,
                    currency: "krw",
                    shopIndex,
                    userIndex,
                };
                const purchaseAmount = Amount.make(purchase.amount, 18).value;

                let paymentId: string;
                console.log("Open New Payment");
                {
                    const url = URI(RELAY_ENDPOINT).directory("/v1/payment/new").filename("open").toString();

                    const params = {
                        accessKey: ACCESS_KEY,
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
                    const response1 = await client.get(
                        URI(RELAY_ENDPOINT).directory("/v1/payment/item").addQuery("paymentId", paymentId).toString()
                    );
                    if (response1.data.data.paymentStatus === LoyaltyPaymentTaskStatus.OPENED_NEW) {
                        const start = Utils.getTimeStamp();
                        while (true) {
                            const response = await client.get(
                                URI(RELAY_ENDPOINT)
                                    .directory("/v1/payment/item")
                                    .addQuery("paymentId", paymentId)
                                    .toString()
                            );
                            if (response.data.data.paymentStatus === LoyaltyPaymentTaskStatus.REPLY_COMPLETED_NEW)
                                break;
                            await Utils.delay(1000);
                            if (Utils.getTimeStamp() - start > 60) break;
                        }
                    }
                }

                console.log("Close New Payment");
                {
                    const response1 = await client.get(
                        URI(RELAY_ENDPOINT).directory("/v1/payment/item").addQuery("paymentId", paymentId).toString()
                    );
                    if (response1.data.data.paymentStatus === LoyaltyPaymentTaskStatus.REPLY_COMPLETED_NEW) {
                        const response = await client.post(
                            URI(RELAY_ENDPOINT).directory("/v1/payment/new").filename("close").toString(),
                            {
                                accessKey: ACCESS_KEY,
                                confirm: true,
                                paymentId,
                            }
                        );

                        assert.deepStrictEqual(response.data.code, 0);
                        assert.ok(response.data.data !== undefined);
                        assert.deepStrictEqual(response.data.data.paymentStatus, LoyaltyPaymentTaskStatus.CLOSED_NEW);
                    }
                }

                console.log("Open Cancel Payment");
                {
                    const response1 = await client.get(
                        URI(RELAY_ENDPOINT).directory("/v1/payment/item").addQuery("paymentId", paymentId).toString()
                    );
                    if (response1.data.data.paymentStatus === LoyaltyPaymentTaskStatus.CLOSED_NEW) {
                        const url = URI(RELAY_ENDPOINT).directory("/v1/payment/cancel").filename("open").toString();

                        const params = {
                            accessKey: ACCESS_KEY,
                            paymentId,
                        };
                        const response = await client.post(url, params);

                        assert.deepStrictEqual(response.data.code, 0);
                        assert.ok(response.data.data !== undefined);

                        assert.deepStrictEqual(response.data.data.paymentId, paymentId);
                        assert.deepStrictEqual(response.data.data.purchaseId, purchase.purchaseId);
                        assert.deepStrictEqual(response.data.data.account, userData[purchase.userIndex].address);
                        assert.deepStrictEqual(response.data.data.loyaltyType, ContractLoyaltyType.TOKEN);
                        assert.deepStrictEqual(
                            response.data.data.paymentStatus,
                            LoyaltyPaymentTaskStatus.OPENED_CANCEL
                        );
                    }
                }

                console.log("...Check Payment Status - REPLY_COMPLETED_CANCEL");
                {
                    const response1 = await client.get(
                        URI(RELAY_ENDPOINT).directory("/v1/payment/item").addQuery("paymentId", paymentId).toString()
                    );
                    if (response1.data.data.paymentStatus === LoyaltyPaymentTaskStatus.OPENED_CANCEL) {
                        const start = Utils.getTimeStamp();
                        while (true) {
                            const response = await client.get(
                                URI(RELAY_ENDPOINT)
                                    .directory("/v1/payment/item")
                                    .addQuery("paymentId", paymentId)
                                    .toString()
                            );
                            if (response.data.data.paymentStatus === LoyaltyPaymentTaskStatus.REPLY_COMPLETED_CANCEL)
                                break;
                            await Utils.delay(1000);
                            if (Utils.getTimeStamp() - start > 60) break;
                        }
                    }
                }

                console.log("Close Cancel Payment");
                {
                    const response1 = await client.get(
                        URI(RELAY_ENDPOINT).directory("/v1/payment/item").addQuery("paymentId", paymentId).toString()
                    );
                    if (response1.data.data.paymentStatus === LoyaltyPaymentTaskStatus.REPLY_COMPLETED_CANCEL) {
                        const response = await client.post(
                            URI(RELAY_ENDPOINT).directory("/v1/payment/cancel").filename("close").toString(),
                            {
                                accessKey: ACCESS_KEY,
                                confirm: true,
                                paymentId,
                            }
                        );

                        assert.deepStrictEqual(response.data.code, 0);
                        assert.ok(response.data.data !== undefined);

                        assert.deepStrictEqual(
                            response.data.data.paymentStatus,
                            LoyaltyPaymentTaskStatus.CLOSED_CANCEL
                        );
                    }
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
