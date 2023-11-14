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

export enum LoyaltyPaymentInputDataStatus {
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
    openNewTimestamp: number;
    closeNewTimestamp: number;
    openCancelTimestamp: number;
    closeCancelTimestamp: number;
}

export enum PaymentResultType {
    NEW = "new",
    CANCEL = "cancel",
}

export enum PaymentResultCode {
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
    paymentStatus?: LoyaltyPaymentInputDataStatus;
    openNewTimestamp?: number;
    closeNewTimestamp?: number;
    openCancelTimestamp?: number;
    closeCancelTimestamp?: number;
}

export interface LoyaltyPaymentEvent {
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
        const defaultCode = "5000";
        const defaultMessage = ResponseMessage.messages.get(defaultCode);
        if (defaultMessage !== undefined) {
            return { code: Number(defaultCode), error: { message: defaultMessage } };
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
