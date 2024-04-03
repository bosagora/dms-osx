// tslint:disable-next-line:no-implicit-dependencies
import { defaultAbiCoder, Interface } from "@ethersproject/abi";
// tslint:disable-next-line:no-implicit-dependencies
import { Signer } from "@ethersproject/abstract-signer";
// tslint:disable-next-line:no-implicit-dependencies
import { BigNumber, BigNumberish } from "@ethersproject/bignumber";
// tslint:disable-next-line:no-implicit-dependencies
import { arrayify, BytesLike } from "@ethersproject/bytes";
// tslint:disable-next-line:no-implicit-dependencies
import { AddressZero } from "@ethersproject/constants";
// tslint:disable-next-line:no-implicit-dependencies
import { ContractReceipt, ContractTransaction } from "@ethersproject/contracts";
// tslint:disable-next-line:no-implicit-dependencies
import { id } from "@ethersproject/hash";
// tslint:disable-next-line:no-implicit-dependencies
import { keccak256 } from "@ethersproject/keccak256";
// tslint:disable-next-line:no-implicit-dependencies
import { Log } from "@ethersproject/providers";
// tslint:disable-next-line:no-implicit-dependencies
import { randomBytes } from "@ethersproject/random";
// tslint:disable-next-line:no-implicit-dependencies
import { verifyMessage } from "@ethersproject/wallet";

import * as hre from "hardhat";

export enum LoyaltyNetworkID {
    LYT,
    PNB,
}

export class ContractUtils {
    public static findLog(receipt: ContractReceipt, iface: Interface, eventName: string): Log | undefined {
        return receipt.logs.find((log) => log.topics[0] === id(iface.getEvent(eventName).format("sighash")));
    }

    public static async getEventValue(
        tx: ContractTransaction,
        iface: Interface,
        event: string,
        field: string
    ): Promise<string | undefined> {
        const contractReceipt = await tx.wait();
        const log = ContractUtils.findLog(contractReceipt, iface, event);
        if (log !== undefined) {
            const parsedLog = iface.parseLog(log);
            return parsedLog.args[field].toString();
        }
        return undefined;
    }

    public static async getEventValueBigNumber(
        tx: ContractTransaction,
        iface: Interface,
        event: string,
        field: string
    ): Promise<BigNumber | undefined> {
        const contractReceipt = await tx.wait();
        const log = ContractUtils.findLog(contractReceipt, iface, event);
        if (log !== undefined) {
            const parsedLog = iface.parseLog(log);
            return parsedLog.args[field];
        }
        return undefined;
    }

    public static async getEventValueString(
        tx: ContractTransaction,
        iface: Interface,
        event: string,
        field: string
    ): Promise<string | undefined> {
        const contractReceipt = await tx.wait();
        const log = ContractUtils.findLog(contractReceipt, iface, event);
        if (log !== undefined) {
            const parsedLog = iface.parseLog(log);
            return parsedLog.args[field];
        }
        return undefined;
    }

    private static find1_message = "execution reverted:";
    private static find1_length = ContractUtils.find1_message.length;
    private static find2_message = "reverted with reason string";
    private static find2_length = ContractUtils.find2_message.length;
    public static cacheEVMError(root: any): string {
        const reasons: string[] = [];
        let error = root;
        while (error !== undefined) {
            if (error.reason) {
                const reason = String(error.reason);
                let idx = reason.indexOf(ContractUtils.find1_message);
                let message: string;
                if (idx >= 0) {
                    message = reason.substring(idx + ContractUtils.find1_length).trim();
                    reasons.push(message);
                }
                idx = reason.indexOf(ContractUtils.find2_message);
                if (idx >= 0) {
                    message = reason
                        .substring(idx + ContractUtils.find2_length)
                        .trim()
                        .replace(/[/']/gi, "");
                    reasons.push(message);
                }
            } else if (error.message) {
                const reason = String(error.message);
                let idx = reason.indexOf(ContractUtils.find1_message);
                let message: string;
                if (idx >= 0) {
                    message = reason.substring(idx + ContractUtils.find1_length).trim();
                    reasons.push(message);
                }
                idx = reason.indexOf(ContractUtils.find2_message);
                if (idx >= 0) {
                    message = reason
                        .substring(idx + ContractUtils.find2_length)
                        .trim()
                        .replace(/[/']/gi, "");
                    reasons.push(message);
                }
            }
            error = error.error;
        }

        if (reasons.length > 0) {
            return reasons[0];
        }

        if (root.message) {
            return root.message;
        } else {
            return root.toString();
        }
    }

    public static isErrorOfEVM(error: any): boolean {
        while (error !== undefined) {
            if (error.reason) {
                return true;
            }
            error = error.error;
        }
        return false;
    }

    public static StringToBuffer(hex: string): Buffer {
        const start = hex.substring(0, 2) === "0x" ? 2 : 0;
        return Buffer.from(hex.substring(start), "hex");
    }

    public static BufferToString(data: Buffer): string {
        return "0x" + data.toString("hex");
    }

    public static getTimeStamp(): number {
        return Math.floor(new Date().getTime() / 1000);
    }

    public static getTimeStampBigInt(): bigint {
        return BigInt(new Date().getTime()) / BigInt(1000);
    }

    public static getTimeStamp10(): number {
        return Math.floor(new Date().getTime() / 10000) * 10;
    }

    public static delay(interval: number): Promise<void> {
        return new Promise<void>((resolve, _) => {
            setTimeout(resolve, interval);
        });
    }

    // region Phone Link

    public static getPhoneHash(phone: string): string {
        const encodedResult = defaultAbiCoder.encode(["string", "string"], ["BOSagora Phone Number", phone]);
        return keccak256(encodedResult);
    }

    public static getEmailHash(phone: string): string {
        const encodedResult = defaultAbiCoder.encode(["string", "string"], ["BOSagora Email", phone]);
        return keccak256(encodedResult);
    }

    public static getRequestId(hash: string, address: string, nonce: BigNumberish): string {
        const encodedResult = defaultAbiCoder.encode(
            ["bytes32", "address", "uint256", "bytes32"],
            [hash, address, nonce, randomBytes(32)]
        );
        return keccak256(encodedResult);
    }

    public static getRequestMessage(
        hash: string,
        address: string,
        nonce: BigNumberish,
        chainId?: BigNumberish
    ): Uint8Array {
        const encodedResult = defaultAbiCoder.encode(
            ["bytes32", "address", "uint256", "uint256"],
            [hash, address, chainId ? chainId : hre.ethers.provider.network.chainId, nonce]
        );
        return arrayify(keccak256(encodedResult));
    }

    public static getRemoveMessage(address: string, nonce: BigNumberish, chainId?: BigNumberish): Uint8Array {
        const encodedResult = defaultAbiCoder.encode(
            ["address", "uint256", "uint256"],
            [address, chainId ? chainId : hre.ethers.provider.network.chainId, nonce]
        );
        return arrayify(keccak256(encodedResult));
    }

    // endregion

    // region Shop

    public static getShopId(account: string, networkId: LoyaltyNetworkID): string {
        const encodedResult = defaultAbiCoder.encode(["address", "bytes32"], [account, randomBytes(32)]);
        const encodedBuffer = this.StringToBuffer(keccak256(encodedResult));
        const networkIdBuffer = Buffer.allocUnsafe(2);
        networkIdBuffer.writeUInt16BE(networkId);
        return this.BufferToString(Buffer.from([...networkIdBuffer, ...encodedBuffer.subarray(0, 30)]));
    }

    public static getShopMessage(
        shopId: BytesLike,
        account: string,
        nonce: BigNumberish,
        chainId?: BigNumberish
    ): Uint8Array {
        const encodedResult = defaultAbiCoder.encode(
            ["bytes32", "address", "uint256", "uint256"],
            [shopId, account, chainId ? chainId : hre.ethers.provider.network.chainId, nonce]
        );
        return arrayify(keccak256(encodedResult));
    }

    public static async signShop(
        signer: Signer,
        shopId: BytesLike,
        nonce: BigNumberish,
        chainId?: BigNumberish
    ): Promise<string> {
        const message = ContractUtils.getShopMessage(shopId, await signer.getAddress(), nonce, chainId);
        return signer.signMessage(message);
    }

    public static verifyShop(
        shopId: BytesLike,
        nonce: BigNumberish,
        account: string,
        signature: BytesLike,
        chainId?: BigNumberish
    ): boolean {
        const message = ContractUtils.getShopMessage(shopId, account, nonce, chainId);
        let res: string;
        try {
            res = verifyMessage(message, signature);
        } catch (error) {
            return false;
        }
        return res.toLowerCase() === account.toLowerCase();
    }
    // endregion

    // region Ledger

    public static getChangePayablePointMessage(
        phone: BytesLike,
        address: string,
        nonce: BigNumberish,
        chainId?: BigNumberish
    ): Uint8Array {
        const encodedResult = defaultAbiCoder.encode(
            ["bytes32", "address", "uint256", "uint256"],
            [phone, address, chainId ? chainId : hre.ethers.provider.network.chainId, nonce]
        );
        return arrayify(keccak256(encodedResult));
    }

    public static async signChangePayablePoint(
        signer: Signer,
        phone: BytesLike,
        nonce: BigNumberish,
        chainId?: BigNumberish
    ): Promise<string> {
        const message = ContractUtils.getChangePayablePointMessage(phone, await signer.getAddress(), nonce, chainId);
        return signer.signMessage(message);
    }

    public static verifyChangePayablePoint(
        phone: BytesLike,
        account: string,
        nonce: BigNumberish,
        signature: BytesLike,
        chainId?: BigNumberish
    ): boolean {
        const message = ContractUtils.getChangePayablePointMessage(phone, account, nonce, chainId);
        let res: string;
        try {
            res = verifyMessage(message, signature);
        } catch (error) {
            return false;
        }
        return res.toLowerCase() === account.toLowerCase();
    }

    public static getLoyaltyTypeMessage(address: string, nonce: BigNumberish, chainId?: BigNumberish): Uint8Array {
        const encodedResult = defaultAbiCoder.encode(
            ["address", "uint256", "uint256"],
            [address, chainId ? chainId : hre.ethers.provider.network.chainId, nonce]
        );
        return arrayify(keccak256(encodedResult));
    }

    public static async signLoyaltyType(signer: Signer, nonce: BigNumberish, chainId?: BigNumberish): Promise<string> {
        const message = ContractUtils.getLoyaltyTypeMessage(await signer.getAddress(), nonce, chainId);
        return signer.signMessage(message);
    }

    public static verifyLoyaltyType(
        account: string,
        nonce: BigNumberish,
        signature: string,
        chainId?: BigNumberish
    ): boolean {
        const message = ContractUtils.getLoyaltyTypeMessage(account, nonce, chainId);
        let res: string;
        try {
            res = verifyMessage(message, signature);
        } catch (error) {
            return false;
        }
        return res.toLowerCase() === account.toLowerCase();
    }

    // endregion

    public static getLoyaltyNewPaymentMessage(
        address: string,
        paymentId: string,
        purchaseId: string,
        amount: BigNumberish,
        currency: string,
        shopId: string,
        nonce: BigNumberish,
        chainId?: BigNumberish
    ): Uint8Array {
        const encodedResult = defaultAbiCoder.encode(
            ["bytes32", "string", "uint256", "string", "bytes32", "address", "uint256", "uint256"],
            [
                paymentId,
                purchaseId,
                amount,
                currency,
                shopId,
                address,
                chainId ? chainId : hre.ethers.provider.network.chainId,
                nonce,
            ]
        );
        return arrayify(keccak256(encodedResult));
    }

    public static async signLoyaltyNewPayment(
        signer: Signer,
        paymentId: string,
        purchaseId: string,
        amount: BigNumberish,
        currency: string,
        shopId: string,
        nonce: BigNumberish,
        chainId?: BigNumberish
    ): Promise<string> {
        const message = ContractUtils.getLoyaltyNewPaymentMessage(
            await signer.getAddress(),
            paymentId,
            purchaseId,
            amount,
            currency,
            shopId,
            nonce,
            chainId
        );
        return signer.signMessage(message);
    }

    public static verifyLoyaltyNewPayment(
        paymentId: string,
        purchaseId: string,
        amount: BigNumberish,
        currency: string,
        shopId: string,
        nonce: BigNumberish,
        account: string,
        signature: BytesLike,
        chainId?: BigNumberish
    ): boolean {
        const message = ContractUtils.getLoyaltyNewPaymentMessage(
            account,
            paymentId,
            purchaseId,
            amount,
            currency,
            shopId,
            nonce,
            chainId
        );
        let res: string;
        try {
            res = verifyMessage(message, signature);
        } catch (error) {
            return false;
        }
        return res.toLowerCase() === account.toLowerCase();
    }

    public static getLoyaltyClosePaymentMessage(
        address: string,
        paymentId: string,
        purchaseId: string,
        confirm: boolean,
        nonce: BigNumberish,
        chainId?: BigNumberish
    ): Uint8Array {
        const encodedResult = defaultAbiCoder.encode(
            ["bytes32", "string", "bool", "address", "uint256", "uint256"],
            [paymentId, purchaseId, confirm, address, chainId ? chainId : hre.ethers.provider.network.chainId, nonce]
        );
        return arrayify(keccak256(encodedResult));
    }

    public static async signLoyaltyClosePayment(
        signer: Signer,
        paymentId: string,
        purchaseId: string,
        confirm: boolean,
        nonce: BigNumberish,
        chainId?: BigNumberish
    ): Promise<string> {
        const message = ContractUtils.getLoyaltyClosePaymentMessage(
            await signer.getAddress(),
            paymentId,
            purchaseId,
            confirm,
            nonce,
            chainId
        );
        return signer.signMessage(message);
    }

    public static getLoyaltyCancelPaymentMessage(
        address: string,
        paymentId: string,
        purchaseId: string,
        nonce: BigNumberish,
        chainId?: BigNumberish
    ): Uint8Array {
        const encodedResult = defaultAbiCoder.encode(
            ["bytes32", "string", "address", "uint256", "uint256"],
            [paymentId, purchaseId, address, chainId ? chainId : hre.ethers.provider.network.chainId, nonce]
        );
        return arrayify(keccak256(encodedResult));
    }

    public static async signLoyaltyCancelPayment(
        signer: Signer,
        paymentId: string,
        purchaseId: string,
        nonce: BigNumberish,
        chainId?: BigNumberish
    ): Promise<string> {
        const message = ContractUtils.getLoyaltyCancelPaymentMessage(
            await signer.getAddress(),
            paymentId,
            purchaseId,
            nonce,
            chainId
        );
        return signer.signMessage(message);
    }

    public static verifyLoyaltyCancelPayment(
        paymentId: string,
        purchaseId: string,
        nonce: BigNumberish,
        account: string,
        signature: BytesLike,
        chainId?: BigNumberish
    ): boolean {
        const message = ContractUtils.getLoyaltyCancelPaymentMessage(account, paymentId, purchaseId, nonce, chainId);
        let res: string;
        try {
            res = verifyMessage(message, signature);
        } catch (error) {
            return false;
        }
        return res.toLowerCase() === account.toLowerCase();
    }

    public static getPaymentId(account: string, nonce: BigNumberish): string {
        const encodedResult = defaultAbiCoder.encode(
            ["address", "uint256", "bytes32"],
            [account, nonce, randomBytes(32)]
        );
        return keccak256(encodedResult);
    }

    public static getTaskId(shopId: string): string {
        const encodedResult = defaultAbiCoder.encode(
            ["bytes32", "uint256", "bytes32", "bytes32"],
            [shopId, ContractUtils.getTimeStamp(), randomBytes(32), randomBytes(32)]
        );
        return keccak256(encodedResult);
    }

    public static getRandomId(account: string): string {
        const encodedResult = defaultAbiCoder.encode(["address", "bytes32"], [account, randomBytes(32)]);
        return keccak256(encodedResult);
    }

    public static getMobileTokenMessage(address: string, token: string): Uint8Array {
        const encodedResult = defaultAbiCoder.encode(["string", "address"], [token, address]);
        return arrayify(keccak256(encodedResult));
    }

    public static async signMobileToken(signer: Signer, token: string): Promise<string> {
        const message = ContractUtils.getMobileTokenMessage(await signer.getAddress(), token);
        return signer.signMessage(message);
    }

    public static verifyMobileToken(account: string, token: string, signature: BytesLike): boolean {
        const message = ContractUtils.getMobileTokenMessage(account, token);
        let res: string;
        try {
            res = verifyMessage(message, signature);
        } catch (error) {
            return false;
        }
        return res.toLowerCase() === account.toLowerCase();
    }

    public static getPurchasesMessage(
        height: BigNumberish,
        purchases: {
            purchaseId: string;
            amount: BigNumberish;
            loyalty: BigNumberish;
            currency: string;
            shopId: BytesLike;
            account: string;
            phone: BytesLike;
            sender: string;
        }[],
        chainId?: BigNumberish
    ): Uint8Array {
        const messages: BytesLike[] = [];
        for (const elem of purchases) {
            const encodedData = defaultAbiCoder.encode(
                ["string", "uint256", "uint256", "string", "bytes32", "address", "bytes32", "address", "uint256"],
                [
                    elem.purchaseId,
                    elem.amount,
                    elem.loyalty,
                    elem.currency,
                    elem.shopId,
                    elem.account,
                    elem.phone,
                    elem.sender,
                    chainId ? chainId : hre.ethers.provider.network.chainId,
                ]
            );
            messages.push(keccak256(encodedData));
        }
        const encodedResult = defaultAbiCoder.encode(
            ["uint256", "uint256", "bytes32[]"],
            [height, purchases.length, messages]
        );
        return arrayify(keccak256(encodedResult));
    }

    public static getCurrencyMessage(
        height: BigNumberish,
        rates: { symbol: string; rate: BigNumberish }[],
        chainId?: BigNumberish
    ): Uint8Array {
        const messages: BytesLike[] = [];
        for (const elem of rates) {
            const encodedData = defaultAbiCoder.encode(
                ["string", "uint256", "uint256"],
                [elem.symbol, elem.rate, chainId ? chainId : hre.ethers.provider.network.chainId]
            );
            messages.push(keccak256(encodedData));
        }
        const encodedResult = defaultAbiCoder.encode(
            ["uint256", "uint256", "bytes32[]"],
            [height, rates.length, messages]
        );
        return arrayify(keccak256(encodedResult));
    }

    public static getTransferMessage(
        from: string,
        to: string,
        amount: BigNumberish,
        nonce: BigNumberish,
        chainId?: BigNumberish
    ): Uint8Array {
        const encodedResult = defaultAbiCoder.encode(
            ["address", "address", "uint256", "uint256", "uint256"],
            [from, to, amount, chainId ? chainId : hre.ethers.provider.network.chainId, nonce]
        );
        return arrayify(keccak256(encodedResult));
    }

    public static async signMessage(signer: Signer, message: Uint8Array): Promise<string> {
        return signer.signMessage(message);
    }

    public static verifyMessage(account: string, message: Uint8Array, signature: string): boolean {
        let res: string;
        try {
            res = verifyMessage(message, signature);
        } catch (error) {
            return false;
        }
        return res.toLowerCase() === account.toLowerCase();
    }

    public static zeroGWEI(value: BigNumber): BigNumber {
        return value.div(1000000000).mul(1000000000);
    }

    public static getSecret(): [string, string] {
        const secret = "0x" + Buffer.from(randomBytes(32)).toString("hex");
        const secretLock = keccak256(defaultAbiCoder.encode(["bytes32"], [secret]));
        return [secret, secretLock];
    }
}
