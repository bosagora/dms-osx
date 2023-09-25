import { BigNumber } from "ethers";

export interface IPurchaseData {
    purchaseId: string;
    timestamp: number;
    amount: BigNumber;
    userEmail: string;
    shopId: string;
}

export interface IShopData {
    shopId: string;
    provideWaitTime: number;
    email: string;
}

export interface IUserData {
    idx: number;
    email: string;
    address: string;
    privateKey: string;
    register: boolean;
}
