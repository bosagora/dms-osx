import * as crypto from "crypto";
import { BigNumberish, BytesLike, ethers, Signer } from "ethers";
// tslint:disable-next-line:no-submodule-imports
import { arrayify } from "ethers/lib/utils";
import * as hre from "hardhat";

import { Log } from "@ethersproject/providers";
import { id } from "@ethersproject/hash";
import { ContractReceipt } from "@ethersproject/contracts";
import { Interface } from "@ethersproject/abi";

export class ContractUtils {
    public static findLog(receipt: ContractReceipt, iface: Interface, eventName: string): Log | undefined {
        return receipt.logs.find((log) => log.topics[0] === id(iface.getEvent(eventName).format("sighash")));
    }

    /**
     * It generates hash values.
     * @param data The source data
     */
    public static sha256(data: Buffer): Buffer {
        return crypto.createHash("sha256").update(data).digest();
    }

    public static sha256String(data: string): string {
        return ContractUtils.BufferToString(crypto.createHash("sha256").update(Buffer.from(data.trim())).digest());
    }

    /**
     * Convert hexadecimal strings into Buffer.
     * @param hex The hexadecimal string
     */
    public static StringToBuffer(hex: string): Buffer {
        const start = hex.substring(0, 2) === "0x" ? 2 : 0;
        return Buffer.from(hex.substring(start), "hex");
    }

    public static getTimeStamp(): number {
        return Math.floor(new Date().getTime() / 1000);
    }

    public static delay(interval: number): Promise<void> {
        return new Promise<void>((resolve, _) => {
            setTimeout(resolve, interval);
        });
    }

    public static getPhoneHash(phone: string): string {
        const encodedResult = hre.ethers.utils.defaultAbiCoder.encode(
            ["string", "string"],
            ["BOSagora Phone Number", phone]
        );
        return hre.ethers.utils.keccak256(encodedResult);
    }

    public static getEmailHash(phone: string): string {
        const encodedResult = hre.ethers.utils.defaultAbiCoder.encode(["string", "string"], ["BOSagora Email", phone]);
        return hre.ethers.utils.keccak256(encodedResult);
    }

    /**
     * Convert Buffer into hexadecimal strings.
     * @param data The data
     */
    public static BufferToString(data: Buffer): string {
        return "0x" + data.toString("hex");
    }

    private static find_message = "reverted with reason string";
    private static find_length = ContractUtils.find_message.length;
    public static cacheEVMError(error: any): string {
        if (error instanceof Error) {
            const idx = error.message.indexOf(ContractUtils.find_message);
            const message =
                idx >= 0
                    ? error.message
                          .substring(idx + ContractUtils.find_length)
                          .replace(/['|"]/gi, "")
                          .trim()
                    : error.message;
            return message;
        } else if (error.message) {
            return error.message;
        } else {
            return error.toString();
        }
    }

    public static isErrorOfEVM(error: any): boolean {
        if (error instanceof Error) {
            const idx = error.message.indexOf(ContractUtils.find_message);
            if (idx >= 0) return true;
            else return false;
        } else return false;
    }

    public static getRequestId(emailHash: string, address: string, nonce: BigNumberish): string {
        const encodedResult = hre.ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "uint256", "bytes32"],
            [emailHash, address, nonce, crypto.randomBytes(32)]
        );
        return hre.ethers.utils.keccak256(encodedResult);
    }

    public static getRequestHash(hash: string, address: string, nonce: BigNumberish): Uint8Array {
        const encodedResult = hre.ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "uint256"],
            [hash, address, nonce]
        );
        return arrayify(hre.ethers.utils.keccak256(encodedResult));
    }

    public static async signRequestHash(signer: Signer, hash: string, nonce: BigNumberish): Promise<string> {
        const message = ContractUtils.getRequestHash(hash, await signer.getAddress(), nonce);
        return signer.signMessage(message);
    }

    public static verifyRequestHash(address: string, hash: string, nonce: BigNumberish, signature: string): boolean {
        const message = ContractUtils.getRequestHash(hash, address, nonce);
        let res: string;
        try {
            res = hre.ethers.utils.verifyMessage(message, signature);
        } catch (error) {
            return false;
        }
        return res.toLowerCase() === address.toLowerCase();
    }

    public static getPaymentMessage(
        address: string,
        purchaseId: string,
        amount: BigNumberish,
        currency: string,
        shopId: string,
        nonce: BigNumberish
    ): Uint8Array {
        const encodedResult = hre.ethers.utils.defaultAbiCoder.encode(
            ["string", "uint256", "string", "bytes32", "address", "uint256"],
            [purchaseId, amount, currency, shopId, address, nonce]
        );
        return arrayify(hre.ethers.utils.keccak256(encodedResult));
    }

    public static async signPayment(
        signer: Signer,
        purchaseId: string,
        amount: BigNumberish,
        currency: string,
        shopId: string,
        nonce: BigNumberish
    ): Promise<string> {
        const message = ContractUtils.getPaymentMessage(
            await signer.getAddress(),
            purchaseId,
            amount,
            currency,
            shopId,
            nonce
        );
        return signer.signMessage(message);
    }

    public static verifyPayment(
        purchaseId: string,
        amount: BigNumberish,
        currency: string,
        shopId: string,
        account: string,
        nonce: BigNumberish,
        signature: BytesLike
    ): boolean {
        const message = ContractUtils.getPaymentMessage(account, purchaseId, amount, currency, shopId, nonce);
        let res: string;
        try {
            res = ethers.utils.verifyMessage(message, signature);
        } catch (error) {
            return false;
        }
        return res.toLowerCase() === account.toLowerCase();
    }

    public static getLoyaltyTypeMessage(account: string, nonce: BigNumberish): Uint8Array {
        const encodedResult = hre.ethers.utils.defaultAbiCoder.encode(["address", "uint256"], [account, nonce]);
        return arrayify(hre.ethers.utils.keccak256(encodedResult));
    }

    public static async signLoyaltyType(signer: Signer, nonce: BigNumberish): Promise<string> {
        const message = ContractUtils.getLoyaltyTypeMessage(await signer.getAddress(), nonce);
        return signer.signMessage(message);
    }

    public static verifyLoyaltyType(account: string, nonce: BigNumberish, signature: string): boolean {
        const message = ContractUtils.getLoyaltyTypeMessage(account, nonce);
        let res: string;
        try {
            res = ethers.utils.verifyMessage(message, signature);
        } catch (error) {
            return false;
        }
        return res.toLowerCase() === account.toLowerCase();
    }

    public static getChangePayablePointMessage(phone: BytesLike, address: string, nonce: BigNumberish): Uint8Array {
        const encodedResult = hre.ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "uint256"],
            [phone, address, nonce]
        );
        return arrayify(hre.ethers.utils.keccak256(encodedResult));
    }

    public static async signChangePayablePoint(signer: Signer, phone: BytesLike, nonce: BigNumberish): Promise<string> {
        const message = ContractUtils.getChangePayablePointMessage(phone, await signer.getAddress(), nonce);
        return signer.signMessage(message);
    }

    public static verifyChangePayablePoint(
        phone: BytesLike,
        account: string,
        nonce: BigNumberish,
        signature: BytesLike
    ): boolean {
        const message = ContractUtils.getChangePayablePointMessage(phone, account, nonce);
        let res: string;
        try {
            res = ethers.utils.verifyMessage(message, signature);
        } catch (error) {
            return false;
        }
        return res.toLowerCase() === account.toLowerCase();
    }

    public static getShopId(account: string): string {
        const encodedResult = hre.ethers.utils.defaultAbiCoder.encode(
            ["address", "bytes32"],
            [account, crypto.randomBytes(32)]
        );
        return hre.ethers.utils.keccak256(encodedResult);
    }

    public static getShopMessage(shopId: BytesLike, account: string, nonce: BigNumberish): Uint8Array {
        const encodedResult = hre.ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "uint256"],
            [shopId, account, nonce]
        );
        return arrayify(hre.ethers.utils.keccak256(encodedResult));
    }

    public static async signShop(signer: Signer, shopId: BytesLike, nonce: BigNumberish): Promise<string> {
        const message = ContractUtils.getShopMessage(shopId, await signer.getAddress(), nonce);
        return signer.signMessage(message);
    }

    public static verifyShop(shopId: BytesLike, nonce: BigNumberish, account: string, signature: BytesLike): boolean {
        const message = ContractUtils.getShopMessage(shopId, account, nonce);
        let res: string;
        try {
            res = ethers.utils.verifyMessage(message, signature);
        } catch (error) {
            return false;
        }
        return res.toLowerCase() === account.toLowerCase();
    }

    public static getLoyaltyNewPaymentMessage(
        address: string,
        paymentId: string,
        purchaseId: string,
        amount: BigNumberish,
        currency: string,
        shopId: string,
        nonce: BigNumberish
    ): Uint8Array {
        const encodedResult = hre.ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "string", "uint256", "string", "bytes32", "address", "uint256"],
            [paymentId, purchaseId, amount, currency, shopId, address, nonce]
        );
        return arrayify(hre.ethers.utils.keccak256(encodedResult));
    }

    public static async signLoyaltyNewPayment(
        signer: Signer,
        paymentId: string,
        purchaseId: string,
        amount: BigNumberish,
        currency: string,
        shopId: string,
        nonce: BigNumberish
    ): Promise<string> {
        const message = ContractUtils.getLoyaltyNewPaymentMessage(
            await signer.getAddress(),
            paymentId,
            purchaseId,
            amount,
            currency,
            shopId,
            nonce
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
        signature: BytesLike
    ): boolean {
        const message = ContractUtils.getLoyaltyNewPaymentMessage(
            account,
            paymentId,
            purchaseId,
            amount,
            currency,
            shopId,
            nonce
        );
        let res: string;
        try {
            res = ethers.utils.verifyMessage(message, signature);
        } catch (error) {
            return false;
        }
        return res.toLowerCase() === account.toLowerCase();
    }

    public static getLoyaltyCancelPaymentMessage(
        address: string,
        paymentId: string,
        purchaseId: string,
        nonce: BigNumberish
    ): Uint8Array {
        const encodedResult = hre.ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "string", "address", "uint256"],
            [paymentId, purchaseId, address, nonce]
        );
        return arrayify(hre.ethers.utils.keccak256(encodedResult));
    }

    public static async signLoyaltyCancelPayment(
        signer: Signer,
        paymentId: string,
        purchaseId: string,
        nonce: BigNumberish
    ): Promise<string> {
        const message = ContractUtils.getLoyaltyCancelPaymentMessage(
            await signer.getAddress(),
            paymentId,
            purchaseId,
            nonce
        );
        return signer.signMessage(message);
    }
    public static verifyLoyaltyCancelPayment(
        paymentId: string,
        purchaseId: string,
        nonce: BigNumberish,
        account: string,
        signature: BytesLike
    ): boolean {
        const message = ContractUtils.getLoyaltyCancelPaymentMessage(account, paymentId, purchaseId, nonce);
        let res: string;
        try {
            res = ethers.utils.verifyMessage(message, signature);
        } catch (error) {
            return false;
        }
        return res.toLowerCase() === account.toLowerCase();
    }

    public static getPaymentId(account: string, nonce: BigNumberish): string {
        const encodedResult = hre.ethers.utils.defaultAbiCoder.encode(
            ["address", "uint256", "bytes32"],
            [account, nonce, crypto.randomBytes(32)]
        );
        return hre.ethers.utils.keccak256(encodedResult);
    }

    public static getTaskId(shopId: string): string {
        const encodedResult = hre.ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "uint256", "bytes32", "bytes32"],
            [shopId, ContractUtils.getTimeStamp(), crypto.randomBytes(32), crypto.randomBytes(32)]
        );
        return hre.ethers.utils.keccak256(encodedResult);
    }

    public static getLoyaltyClosePaymentMessage(
        address: string,
        paymentId: string,
        purchaseId: string,
        confirm: boolean,
        nonce: BigNumberish
    ): Uint8Array {
        const encodedResult = hre.ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "string", "bool", "address", "uint256"],
            [paymentId, purchaseId, confirm, address, nonce]
        );
        return arrayify(hre.ethers.utils.keccak256(encodedResult));
    }

    public static async signLoyaltyClosePayment(
        signer: Signer,
        paymentId: string,
        purchaseId: string,
        confirm: boolean,
        nonce: BigNumberish
    ): Promise<string> {
        const message = ContractUtils.getLoyaltyClosePaymentMessage(
            await signer.getAddress(),
            paymentId,
            purchaseId,
            confirm,
            nonce
        );
        return signer.signMessage(message);
    }
}
