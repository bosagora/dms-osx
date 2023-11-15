import { BigNumber } from "ethers";
import { ContractUtils } from "../utils/ContractUtils";

export enum LoyaltyType {
    POINT,
    TOKEN,
}
export enum WithdrawStatus {
    CLOSE,
    OPEN,
}

export enum ContractShopStatus {
    INVALID,
    ACTIVE,
    INACTIVE,
}

export enum LoyaltyPaymentTaskStatus {
    NULL,
    OPENED_NEW,
    CONFIRMED_NEW,
    DENIED_NEW,
    REPLY_COMPLETED_NEW,
    CLOSED_NEW,
    OPENED_CANCEL,
    CONFIRMED_CANCEL,
    DENIED_CANCEL,
    REPLY_COMPLETED_CANCEL,
    CLOSED_CANCEL,
    TIMEOUT,
}

export interface LoyaltyPaymentTaskData {
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

    paymentStatus: LoyaltyPaymentTaskStatus;
    openNewTimestamp: number;
    closeNewTimestamp: number;
    openCancelTimestamp: number;
    closeCancelTimestamp: number;
}

export enum TaskResultType {
    NEW = "new",
    CANCEL = "cancel",
    UPDATE = "update",
    STATUS = "status",
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

export enum ShopTaskStatus {
    NULL,
    OPENED,
    CONFIRMED,
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

export class ResponseMessage {
    static messages: Map<string, string> = new Map([
        ["0000", "Success"],
        ["1000", "Sender is not validator"],
        ["1001", "Validator is not active"],
        ["1002", "Validator is already active"],
        ["1003", "Validator is already exist"],
        ["1010", "The last validator cannot be removed"],
        ["1020", "Not allowed deposit"],
        ["1050", "Sender is not authorized to execute"],
        ["1200", "The shop ID already exists"],
        ["1201", "The shop ID is not exists"],
        ["1202", "The shop is not activated"],
        ["1220", "Insufficient withdrawal amount"],
        ["1221", "Withdrawal is already opened"],
        ["1222", "Withdrawal is not opened"],
        ["1501", "Invalid signature"],
        ["1502", "Unregistered phone number"],
        ["1503", "Does not match registered wallet address"],
        ["1510", "Insufficient foundation balance"],
        ["1511", "Insufficient balance"],
        ["1512", "Not allowed deposit"],
        ["1513", "Insufficient fee or foundation balance"],
        ["1520", "Loyalty type is not TOKEN"],
        ["1521", "Invalid value entered"],
        ["1530", "The payment ID already exists"],
        ["1531", "The status of the payment corresponding to the payment ID is not in progress"],
        ["1532", "The status of the payment corresponding to the payment ID is not a cancellable condition"],
        ["1533", "The status of the payment corresponding to the payment ID is not being cancelled"],
        ["1534", "The period for cancellation of payment has expired"],
        ["2001", "Failed to check the validity of parameters"],
        ["2002", "The access key entered is not valid"],
        ["2003", "The payment ID is not exist"],
        ["2020", "The status code for this payment cannot be approved"],
        ["2022", "The status code for this payment cannot be cancel"],
        ["2024", "The status code for this payment cannot process closing"],
        ["2033", "The task ID is not exist"],
        ["2040", "The status code for this task cannot be approved"],
        ["4000", "This payment denied by user"],
        ["5000", "Smart Contract Error"],
        ["6000", "Server Error"],
        ["7000", "Timeout period expired"],
    ]);

    public static getEVMErrorMessage(error: any): { code: number; error: any } {
        const code = ContractUtils.cacheEVMError(error);
        const message = ResponseMessage.messages.get(code);
        if (message !== undefined) {
            return { code: Number(code), error: { message } };
        }

        if (ContractUtils.isErrorOfEVM(error)) {
            const defaultCode = "5000";
            const defaultMessage = ResponseMessage.messages.get(defaultCode);
            if (defaultMessage !== undefined) {
                return { code: Number(defaultCode), error: { message: defaultMessage } };
            }
        } else if (error instanceof Error && error.message) {
            return { code: 9000, error: { message: error.message } };
        }
        return { code: 9000, error: { message: "Unknown Error" } };
    }

    public static getErrorMessage(code: string, additional?: any): { code: number; error: any } {
        const message = ResponseMessage.messages.get(code);
        if (message !== undefined) {
            return { code: Number(code), error: { message, ...additional } };
        }
        return { code: 9000, error: { message: "Unknown Error" } };
    }
}
