import { BigNumber } from "ethers";

export interface IPurchaseData {
    purchaseId: string;
    timestamp: number;
    amount: BigNumber;
    userEmail: string;
    franchiseeId: string;
}

export interface IFranchiseeData {
    franchiseeId: string;
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
