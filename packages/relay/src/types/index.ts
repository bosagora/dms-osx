import { BigNumber } from "ethers";

export enum ContractLoyaltyType {
    POINT,
    TOKEN,
}
export enum ContractWithdrawStatus {
    CLOSE,
    OPEN,
}

export enum ContractShopStatus {
    INVALID,
    ACTIVE,
    INACTIVE,
}

export enum ContractLoyaltyPaymentStatus {
    INVALID,
    OPENED_PAYMENT,
    CLOSED_PAYMENT,
    FAILED_PAYMENT,
    OPENED_CANCEL,
    CLOSED_CANCEL,
    FAILED_CANCEL,
}

export interface ContractLoyaltyPaymentEvent {
    paymentId: string;
    purchaseId: string;
    currency: string;
    shopId: string;
    account: string;
    timestamp: BigNumber;
    loyaltyType: number;
    paidPoint: BigNumber;
    paidToken: BigNumber;
    paidValue: BigNumber;
    feePoint: BigNumber;
    feeToken: BigNumber;
    feeValue: BigNumber;
    totalPoint: BigNumber;
    totalToken: BigNumber;
    totalValue: BigNumber;
    status: number;
    balance: BigNumber;
}

export interface ContractShopUpdateEvent {
    shopId: string;
    name: string;
    provideWaitTime: number;
    providePercent: number;
    account: string;
    status: ContractShopStatus;
}

export interface ContractShopStatusEvent {
    shopId: string;
    status: ContractShopStatus;
}

export enum LoyaltyPaymentTaskStatus {
    NULL,
    OPENED_NEW,
    APPROVED_NEW_FAILED_TX,
    APPROVED_NEW_SENT_TX,
    APPROVED_NEW_CONFIRMED_TX,
    APPROVED_NEW_REVERTED_TX,
    DENIED_NEW,
    REPLY_COMPLETED_NEW,
    CLOSED_NEW,
    FAILED_NEW,
    OPENED_CANCEL,
    APPROVED_CANCEL_FAILED_TX,
    APPROVED_CANCEL_SENT_TX,
    APPROVED_CANCEL_CONFIRMED_TX,
    APPROVED_CANCEL_REVERTED_TX,
    DENIED_CANCEL,
    REPLY_COMPLETED_CANCEL,
    CLOSED_CANCEL,
    FAILED_CANCEL,
    TIMEOUT,
}

export interface LoyaltyPaymentTaskData {
    paymentId: string;
    purchaseId: string;
    amount: BigNumber;
    currency: string;
    shopId: string;
    account: string;
    loyaltyType: ContractLoyaltyType;

    paidPoint: BigNumber;
    paidToken: BigNumber;
    paidValue: BigNumber;
    feePoint: BigNumber;
    feeToken: BigNumber;
    feeValue: BigNumber;
    totalPoint: BigNumber;
    totalToken: BigNumber;
    totalValue: BigNumber;

    paymentStatus: LoyaltyPaymentTaskStatus;

    openNewTimestamp: number;
    closeNewTimestamp: number;
    openCancelTimestamp: number;
    closeCancelTimestamp: number;

    openNewTxId: string;
    openNewTxTime: number;
    closeNewTxId: string;
    closeNewTxTime: number;
    openCancelTxId: string;
    openCancelTxTime: number;
    closeCancelTxId: string;
    closeCancelTxTime: number;
}

export enum TaskResultType {
    NEW = "pay_new",
    CANCEL = "pay_cancel",
    ADD = "shop_add",
    UPDATE = "shop_update",
    STATUS = "shop_status",
}

export enum TaskResultCode {
    SUCCESS = 0,
    DENIED = 4000,
    CONTRACT_ERROR = 5000,
    INTERNAL_ERROR = 6000,
    TIMEOUT = 7000,
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
    paymentStatus?: LoyaltyPaymentTaskStatus;
    openNewTimestamp?: number;
    closeNewTimestamp?: number;
    openCancelTimestamp?: number;
    closeCancelTimestamp?: number;
}

export enum ShopTaskStatus {
    NULL,
    OPENED,
    FAILED_TX,
    SENT_TX,
    REVERTED_TX,
    DENIED,
    COMPLETED,
    TIMEOUT,
}

export interface ShopTaskData {
    taskId: string;
    type: TaskResultType;
    shopId: string;
    name: string;
    provideWaitTime: number;
    providePercent: number;
    status: ContractShopStatus;
    account: string;
    taskStatus: ShopTaskStatus;
    timestamp: number;
    txId: string;
    txTime: number;
}

export interface IShopData {
    shopId: string;
    name: string;
    provideWaitTime: number;
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

export interface MobileData {
    account: string;
    token: string;
    language: string;
    os: string;
}
