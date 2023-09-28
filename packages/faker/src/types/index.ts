import { BigNumber } from "ethers";

export interface IPurchaseData {
    purchaseId: string;
    timestamp: number;
    amount: BigNumber;
    userPhone: string;
    shopId: string;
}

export interface IShopData {
    shopId: string;
    provideWaitTime: number;
    phone: string;
}

export interface IUserData {
    idx: number;
    phone: string;
    address: string;
    privateKey: string;
    register: boolean;
}
