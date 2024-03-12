import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@openzeppelin/hardhat-upgrades";
import { ContractUtils, LoyaltyNetworkID } from "../src/utils/ContractUtils";

describe("Test for ShopId", () => {
    it("Shop ID", async () => {
        const id = ContractUtils.getShopId("0xeDBFECF2D2D30fDd7b6D1D0975D679976954fF25", LoyaltyNetworkID.KIOS);
        console.log(id);
    });
});
