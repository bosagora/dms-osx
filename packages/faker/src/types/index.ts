import { BigNumber } from "ethers";

export interface IPurchaseData {
    purchaseId: string;
    amount: BigNumber;
    loyalty: BigNumber;
    currency: string;
    account: string;
    phone: string;
    shopId: string;
    sender: string;
}

export interface IShopData {
    shopId: string;
    name: string;
    providePercent: number;
    address: string;
    privateKey: string;
}

export interface IUserData {
    idx: number;
    phone: string;
    address: string;
    privateKey: string;
    loyaltyType: number;
}
