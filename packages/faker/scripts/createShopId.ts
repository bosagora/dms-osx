import { ContractUtils, LoyaltyNetworkID } from "../src/utils/ContractUtils";
import fs from "fs";
import { IShopData } from "../src/types";

async function main() {
    const shops = JSON.parse(fs.readFileSync("./src/data/shops.json", "utf8")) as IShopData[];
    for (const shop of shops) {
        shop.shopId = ContractUtils.getShopId(shop.address, LoyaltyNetworkID.KIOS);
    }
    console.log(JSON.stringify(shops));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
