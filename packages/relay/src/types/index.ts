import { BigNumber } from "ethers";

export const GWI_UNIT = 1000000000;
export const PHONE_NULL = "0x32105b1d0b88ada155176b58ee08b45c31e4f2f7337475831982c313533b880c";

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
    paidPoint: BigNumber;
    paidValue: BigNumber;
    feePoint: BigNumber;
    feeValue: BigNumber;
    totalPoint: BigNumber;
    totalValue: BigNumber;
    status: number;
    balance: BigNumber;
}

export interface ContractShopUpdateEvent {
    shopId: string;
    name: string;
    currency: string;
    account: string;
    status: ContractShopStatus;
}

export interface ContractShopStatusEvent {
    shopId: string;
    status: ContractShopStatus;
}

export enum LoyaltyPaymentTaskStatus {
    NULL = 0,
    OPENED_NEW = 11,
    APPROVED_NEW_FAILED_TX = 12,
    APPROVED_NEW_REVERTED_TX = 13,
    APPROVED_NEW_SENT_TX = 14,
    APPROVED_NEW_CONFIRMED_TX = 15,
    DENIED_NEW = 16,
    REPLY_COMPLETED_NEW = 17,
    CLOSED_NEW = 18,
    FAILED_NEW = 19,
    OPENED_CANCEL = 51,
    APPROVED_CANCEL_FAILED_TX = 52,
    APPROVED_CANCEL_REVERTED_TX = 53,
    APPROVED_CANCEL_SENT_TX = 54,
    APPROVED_CANCEL_CONFIRMED_TX = 55,
    DENIED_CANCEL = 56,
    REPLY_COMPLETED_CANCEL = 57,
    CLOSED_CANCEL = 58,
    FAILED_CANCEL = 59,
}

export interface LoyaltyPaymentTaskData {
    paymentId: string;
    purchaseId: string;
    amount: BigNumber;
    currency: string;
    shopId: string;
    account: string;
    secret: string;
    secretLock: string;

    paidPoint: BigNumber;
    paidValue: BigNumber;
    feePoint: BigNumber;
    feeValue: BigNumber;
    totalPoint: BigNumber;
    totalValue: BigNumber;

    paymentStatus: LoyaltyPaymentTaskStatus;
    contractStatus: ContractLoyaltyPaymentStatus;

    openNewTimestamp: number;
    closeNewTimestamp: number;
    openCancelTimestamp: number;
    closeCancelTimestamp: number;

    openNewTxId: string;
    openNewTxTime: number;
    openCancelTxId: string;
    openCancelTxTime: number;
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
    paidPoint: string;
    paidValue: string;
    feePoint: string;
    feeValue: string;
    totalPoint: string;
    totalValue: string;
    balance?: string;
    paymentStatus?: LoyaltyPaymentTaskStatus;
    openNewTimestamp?: number;
    closeNewTimestamp?: number;
    openCancelTimestamp?: number;
    closeCancelTimestamp?: number;
}

export enum ShopTaskStatus {
    NULL = 0,
    OPENED = 11,
    FAILED_TX = 12,
    REVERTED_TX = 13,
    SENT_TX = 14,
    DENIED = 15,
    COMPLETED = 16,
    TIMEOUT = 70,
}

export interface ShopTaskData {
    taskId: string;
    type: TaskResultType;
    shopId: string;
    name: string;
    currency: string;
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
    currency: string;
    address: string;
    privateKey: string;
}

export interface IUserData {
    idx: number;
    phone: string;
    address: string;
    privateKey: string;
}

export enum MobileType {
    USER_APP,
    SHOP_APP,
}
export interface MobileData {
    account: string;
    type: MobileType;
    token: string;
    language: string;
    os: string;
}

export interface IGraphShopData {
    shopId: string;
    name: string;
    currency: string;
    status: ContractShopStatus;
    account: string;
    providedAmount: BigNumber;
    usedAmount: BigNumber;
    refundedAmount: BigNumber;
}

export interface IGraphPageInfo {
    totalCount: number;
    totalPages: number;
}

export interface IGraphTokenTransferHistoryData {
    from: string;
    to: string;
    value: BigNumber;
    blockTimestamp: BigNumber;
}

export interface IGraphAccountLedgerHistoryData {
    account: string;
    action: string;
    cancel: boolean;
    amountPoint: BigNumber;
    amountToken: BigNumber;
    amountValue: BigNumber;
    feePoint: BigNumber;
    feeToken: BigNumber;
    feeValue: BigNumber;
    balancePoint: BigNumber;
    balanceToken: BigNumber;
    purchaseId: string;
    paymentId: string;
    shopId: string;
    blockNumber: BigNumber;
    blockTimestamp: BigNumber;
    transactionHash: string;
}

export interface IGraphPhoneLedgerHistoryData {
    phone: string;
    action: string;
    amount: BigNumber;
    balance: BigNumber;
    purchaseId: string;
    shopId: string;
    blockNumber: BigNumber;
    blockTimestamp: BigNumber;
    transactionHash: string;
}

export interface IGraphShopHistoryData {
    shopId: string;
    currency: string;
    action: string;
    cancel: boolean;
    increase: BigNumber;
    providedAmount: BigNumber;
    usedAmount: BigNumber;
    refundedAmount: BigNumber;
    purchaseId: string;
    paymentId: string;
    blockNumber: BigNumber;
    blockTimestamp: BigNumber;
    transactionHash: string;
}

export interface IStorePurchaseData {
    purchaseId: string;
    timestamp: bigint;
    waiting: bigint;
    account: string;
    currency: string;
    providePoint: BigNumber;
    provideValue: BigNumber;
    shopId: string;
    shopCurrency: string;
    shopProvidedAmount: BigNumber;
}

export interface IToBeProvideOfUser {
    account: string;
    timestamp: bigint;
    currency: string;
    providePoint: BigNumber;
    provideValue: BigNumber;
    purchaseId: string;
    shopId: string;
}

export interface IToBeProvideOfShop {
    shopId: string;
    timestamp: bigint;
    currency: string;
    providedAmount: BigNumber;
    purchaseId: string;
}

export interface IStatisticsAccountBalance {
    name: string;
    balance: number;
}

export interface IStatisticsAccountInfo {
    account_count: number;
    total_balance: number;
}

export interface IStatisticsShopInfo {
    currency: number;
    shop_count: number;
    total_provided_amount: number;
    total_used_amount: number;
    total_refunded_amount: number;
}

export enum ActionInLedger {
    NONE = 0,
    SAVED = 1,
    USED = 2,
    BURNED,
    DEPOSITED = 11,
    WITHDRAWN = 12,
    CHANGED_TO_PAYABLE_POINT = 21,
    CHANGED_TO_TOKEN = 22,
    CHANGED_TO_POINT = 23,
    REFUND = 31,
    TRANSFER_IN = 41,
    TRANSFER_OUT = 42,
}

export enum ActionInShop {
    NONE = 0,
    PROVIDED = 1,
    USED = 2,
    REFUNDED = 3,
}
