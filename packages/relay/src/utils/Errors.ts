import { ContractUtils } from "./ContractUtils";

export class ResponseMessage {
    static messages: Map<string, string> = new Map([
        ["0000", "Success"],
        ["1000", "Sender is not validator"],
        ["1001", "Validator is not active"],
        ["1002", "Validator is already active"],
        ["1003", "Validator is already exist"],
        ["1010", "The last validator cannot be removed"],
        ["1020", "Not allowed deposit"],
        ["1030", "Amount not multiple of gwei"],
        ["1031", "The amount entered is less than the minimum amount"],
        ["1050", "Sender is not authorized to execute"],
        ["1051", "Unable to transfer from foundation account"],
        ["1052", "Unable to transfer to foundation account"],
        ["1052", "Unable to withdraw from the foundation account"],
        ["1160", "ProvideLoyalty-This is a purchase data that has already been processed"],
        ["1161", "ProvideLoyalty-Too much royalty paid"],
        ["1162", "ProvideLoyalty-Registered validator does not exist"],
        ["1163", "ProvideLoyalty-Too many validators have participated"],
        ["1164", "ProvideLoyalty-Number of validators who participated did not satisfy the quorum"],
        ["1170", "Currency-The arrangement is not equal in size"],
        ["1171", "Currency-The validity of the data has expired."],
        ["1172", "Currency-Registered validator does not exist"],
        ["1173", "Currency-Too many validators have participated"],
        ["1174", "Currency-Number of validators who participated did not satisfy the quorum"],
        ["1200", "The shop ID already exists"],
        ["1201", "The shop ID is not exists"],
        ["1202", "The shop is not activated"],
        ["1211", "This exchange rate is not supported"],
        ["1220", "Insufficient withdrawal amount"],
        ["1221", "Withdrawal is already opened"],
        ["1222", "Withdrawal is not opened"],
        ["1501", "Invalid signature"],
        ["1502", "Unregistered phone number"],
        ["1503", "Does not match registered wallet address"],
        ["1505", "Invalid secret key"],
        ["1510", "Insufficient foundation balance"],
        ["1511", "Insufficient balance"],
        ["1512", "Not allowed deposit"],
        ["1513", "Insufficient fee or foundation balance"],
        ["1514", "Insufficient liquidity balance"],
        ["1520", "Loyalty type is not TOKEN"],
        ["1521", "Invalid value entered"],
        ["1530", "The payment ID already exists"],
        ["1531", "The status of the payment corresponding to the payment ID is not in progress"],
        ["1532", "The status of the payment corresponding to the payment ID is not a cancellable condition"],
        ["1533", "The status of the payment corresponding to the payment ID is not being cancelled"],
        ["1534", "The period for cancellation of payment has expired"],
        ["1711", "Already Exist Deposit"],
        ["1712", "No Exist Withdraw"],
        ["1715", "Already Confirm Withdraw"],
        ["1717", "Does not match the address registered on the bridge"],
        ["1718", "Does not match the amount registered on the bridge"],
        ["2001", "Failed to check the validity of parameters"],
        ["2002", "The access key entered is not valid"],
        ["2003", "The payment ID is not exist"],
        ["2004", "Temporary address that does not exist"],
        ["2005", "Mobile notification not allowed"],
        ["2006", "Can not found delegator"],
        ["2007", "The phone number format is invalid."],
        ["2020", "The status code for this payment cannot be approved"],
        ["2022", "The status code for this payment cannot be cancel"],
        ["2024", "The status code for this payment cannot process closing"],
        ["2025", "This payment has already been approved"],
        ["2026", "This payment has already been closed"],
        ["2027", "This payment has already been approved and failed"],
        ["2028", "The status code for this payment cannot be denied"],
        ["2029", "This payment has forced to close"],
        ["2030", "This payment cannot be closed before it is approved"],
        ["2033", "The task ID is not exist"],
        ["2040", "The status code for this task cannot be approved"],
        ["4000", "Denied by user"],
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

        if (code !== "") {
            const defaultCode = "5000";
            const defaultMessage = code;
            if (defaultMessage !== undefined) {
                return { code: Number(defaultCode), error: { message: defaultMessage } };
            }
        } else if (ContractUtils.isErrorOfEVM(error)) {
            const defaultCode = "5000";
            const defaultMessage = error.reason ? error.reason : ResponseMessage.messages.get(defaultCode);
            if (defaultMessage !== undefined) {
                return { code: Number(defaultCode), error: { message: defaultMessage } };
            }
        } else if (error instanceof Error && error.message) {
            return { code: 9000, error: { message: error.message.substring(0, 64) } };
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
