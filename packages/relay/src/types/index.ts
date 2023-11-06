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
    CANCELED,
    CANCEL_CONFIRMED,
    CANCEL_DENIED,
}

export interface LoyaltyPaymentInputData {
    paymentId: string;
    purchaseId: string;
    amount: BigNumber;
    currency: string;
    shopId: string;
    account: string;
    loyaltyType: LoyaltyType;
    purchaseAmount: BigNumber;
    feeAmount: BigNumber;
    totalAmount: BigNumber;
    paymentStatus: LoyaltyPaymentInputDataStatus;
}
