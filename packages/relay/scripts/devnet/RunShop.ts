import { Amount } from "../../src/common/Amount";
import {
    ContractLoyaltyType,
    ContractShopStatus,
    IShopData,
    IUserData,
    LoyaltyPaymentTaskStatus,
    ShopTaskStatus,
    TaskResultType,
} from "../../src/types";
import { HTTPClient, Utils } from "../../src/utils/Utils";

import * as assert from "assert";
import fs from "fs";

// tslint:disable-next-line:no-var-requires
const URI = require("urijs");

export const userData: IUserData[] = [];

export const shopData: IShopData[] = [];

async function main() {
    const RELAY_ENDPOINT = "http://127.0.0.1:7070";
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

        console.log("Test of shop update");
        {
            const client = new HTTPClient();
            let taskId: string;
            console.log("Create New Task for updating shop's information");
            {
                const url = URI(RELAY_ENDPOINT).directory("/v1/shop/update").filename("create").toString();
                const params = {
                    accessKey: ACCESS_KEY,
                    shopId: shopData[shopIndex].shopId,
                    name: "새로운 이름",
                    provideWaitTime: 86400,
                    providePercent: 10,
                };
                const response = await client.post(url, params);
                assert.deepStrictEqual(response.data.code, 0);
                assert.ok(response.data.data !== undefined);
                assert.deepStrictEqual(response.data.data.taskStatus, ShopTaskStatus.OPENED);
                taskId = response.data.data.taskId;
            }

            console.log("...Check Shop Task Status - COMPLETED");
            {
                const start = Utils.getTimeStamp();
                while (true) {
                    const url = URI(RELAY_ENDPOINT).directory("/v1/shop/task").addQuery("taskId", taskId).toString();
                    const response = await client.get(url);
                    if (response.data.data.taskStatus === ShopTaskStatus.COMPLETED) break;
                    await Utils.delay(2000);
                    if (Utils.getTimeStamp() - start > 60) break;
                }
            }
        }

        console.log("Test of shop status");
        {
            const client = new HTTPClient();
            let taskId: string;
            console.log("Create New Task for updating shop's status");
            {
                const url = URI(RELAY_ENDPOINT).directory("/v1/shop/status").filename("create").toString();
                const params = {
                    accessKey: ACCESS_KEY,
                    shopId: shopData[shopIndex].shopId,
                    status: ContractShopStatus.ACTIVE,
                };
                const response = await client.post(url, params);
                assert.deepStrictEqual(response.data.code, 0);
                assert.ok(response.data.data !== undefined);
                assert.deepStrictEqual(response.data.data.taskStatus, ShopTaskStatus.OPENED);
                taskId = response.data.data.taskId;
            }

            console.log("...Check Shop Task Status - COMPLETED");
            {
                const start = Utils.getTimeStamp();
                while (true) {
                    const url = URI(RELAY_ENDPOINT).directory("/v1/shop/task").addQuery("taskId", taskId).toString();
                    const response = await client.get(url);
                    if (response.data.data.taskStatus === ShopTaskStatus.COMPLETED) break;
                    await Utils.delay(2000);
                    if (Utils.getTimeStamp() - start > 60) break;
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
