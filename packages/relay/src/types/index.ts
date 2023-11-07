import { BigNumber } from "ethers";

export enum LoyaltyType {
    POINT,
    TOKEN,
}
export enum WithdrawStatus {
    CLOSE,
    OPEN,
}

export enum LoyaltyPaymentInputDataStatus {
    NULL,
    CREATED,
    CREATE_CONFIRMED,
    CREATE_DENIED,
    CREATE_COMPLETE,
    CANCELED,
    CANCEL_CONFIRMED,
    CANCEL_DENIED,
    CANCEL_COMPLETE,
    TIMEOUT,
}

export interface LoyaltyPaymentInternalData {
    paymentId: string;
    purchaseId: string;
    amount: BigNumber;
    currency: string;
    shopId: string;
    account: string;
    loyaltyType: LoyaltyType;

    paidPoint: BigNumber;
    paidToken: BigNumber;
    paidValue: BigNumber;
    feePoint: BigNumber;
    feeToken: BigNumber;
    feeValue: BigNumber;
    totalPoint: BigNumber;
    totalToken: BigNumber;
    totalValue: BigNumber;

    paymentStatus: LoyaltyPaymentInputDataStatus;
    createTimestamp: number;
    cancelTimestamp: number;
}

export enum PaymentResultType {
    CREATE = "create",
    CANCEL = "cancel",
}

export enum PaymentResultCode {
    SUCCESS = 0,
    DENIED = 1001,
    CONTRACT_ERROR = 1002,
    INTERNAL_ERROR = 1003,
    TIMEOUT = 2000,
}

export interface PaymentResultData {
    paymentId: string;
    purchaseId: string;
    amount: string;
    currency: string;
    account: string;
    shopId: string;
    loyaltyType: number;
    paidPoint: string;
    paidToken: string;
    paidValue: string;
    feePoint: string;
    feeToken: string;
    feeValue: string;
    totalPoint: string;
    totalToken: string;
    totalValue: string;
    balance?: string;
}
