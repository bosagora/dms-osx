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

export class ContractUtils {
    /**
     * Convert hexadecimal strings into Buffer.
     * @param hex The hexadecimal string
     */
    public static StringToBuffer(hex: string): Buffer {
        const start = hex.substring(0, 2) === "0x" ? 2 : 0;
        return Buffer.from(hex.substring(start), "hex");
    }

    /**
     * Convert Buffer into hexadecimal strings.
     * @param data The data
     */
    public static BufferToString(data: Buffer): string {
        return "0x" + data.toString("hex");
    }

    public static getTimeStamp(): number {
        return Math.floor(new Date().getTime() / 1000);
    }

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

    public static getRequestHash(hash: string, address: string, nonce: BigNumberish): Uint8Array {
        const encodedResult = defaultAbiCoder.encode(["bytes32", "address", "uint256"], [hash, address, nonce]);
        return arrayify(keccak256(encodedResult));
    }

    public static async signRequestHash(signer: Signer, hash: string, nonce: BigNumberish): Promise<string> {
        const message = ContractUtils.getRequestHash(hash, await signer.getAddress(), nonce);
        return signer.signMessage(message);
    }

    public static verifyRequestHash(address: string, hash: string, nonce: BigNumberish, signature: string): boolean {
        const message = ContractUtils.getRequestHash(hash, address, nonce);
        let res: string;
        try {
            res = verifyMessage(message, signature);
        } catch (error) {
            return false;
        }
        return res.toLowerCase() === address.toLowerCase();
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
        const encodedResult = defaultAbiCoder.encode(
            ["bytes32", "string", "uint256", "string", "bytes32", "address", "uint256"],
            [paymentId, purchaseId, amount, currency, shopId, address, nonce]
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

    public static getLoyaltyClosePaymentMessage(
        address: string,
        paymentId: string,
        purchaseId: string,
        confirm: boolean,
        nonce: BigNumberish
    ): Uint8Array {
        const encodedResult = defaultAbiCoder.encode(
            ["bytes32", "string", "bool", "address", "uint256"],
            [paymentId, purchaseId, confirm, address, nonce]
        );
        return arrayify(keccak256(encodedResult));
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

    public static getLoyaltyCancelPaymentMessage(
        address: string,
        paymentId: string,
        purchaseId: string,
        nonce: BigNumberish
    ): Uint8Array {
        const encodedResult = defaultAbiCoder.encode(
            ["bytes32", "string", "address", "uint256"],
            [paymentId, purchaseId, address, nonce]
        );
        return arrayify(keccak256(encodedResult));
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

    public static getChangePayablePointMessage(phone: string, address: string, nonce: BigNumberish): Uint8Array {
        const encodedResult = defaultAbiCoder.encode(["bytes32", "address", "uint256"], [phone, address, nonce]);
        return arrayify(keccak256(encodedResult));
    }

    public static async signChangePayablePoint(signer: Signer, phone: string, nonce: BigNumberish): Promise<string> {
        const message = ContractUtils.getChangePayablePointMessage(phone, await signer.getAddress(), nonce);
        return signer.signMessage(message);
    }

    public static getLoyaltyTypeMessage(address: string, nonce: BigNumberish): Uint8Array {
        const encodedResult = defaultAbiCoder.encode(["address", "uint256"], [address, nonce]);
        return arrayify(keccak256(encodedResult));
    }

    public static async signLoyaltyType(signer: Signer, nonce: BigNumberish): Promise<string> {
        const message = ContractUtils.getLoyaltyTypeMessage(await signer.getAddress(), nonce);
        return signer.signMessage(message);
    }

    public static getShopId(account: string): string {
        const encodedResult = defaultAbiCoder.encode(["address", "bytes32"], [account, randomBytes(32)]);
        return keccak256(encodedResult);
    }

    public static getShopMessage(shopId: BytesLike, account: string, nonce: BigNumberish): Uint8Array {
        const encodedResult = defaultAbiCoder.encode(["bytes32", "address", "uint256"], [shopId, account, nonce]);
        return arrayify(keccak256(encodedResult));
    }

    public static async signShop(signer: Signer, shopId: BytesLike, nonce: BigNumberish): Promise<string> {
        const message = ContractUtils.getShopMessage(shopId, await signer.getAddress(), nonce);
        return signer.signMessage(message);
    }

    public static getPaymentId(account: string): string {
        const encodedResult = defaultAbiCoder.encode(["address", "bytes32"], [account, randomBytes(32)]);
        return keccak256(encodedResult);
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
        }[]
    ): Uint8Array {
        const messages: BytesLike[] = [];
        for (const elem of purchases) {
            const encodedData = defaultAbiCoder.encode(
                ["string", "uint256", "uint256", "string", "bytes32", "address", "bytes32", "address"],
                [
                    elem.purchaseId,
                    elem.amount,
                    elem.loyalty,
                    elem.currency,
                    elem.shopId,
                    elem.account,
                    elem.phone,
                    elem.sender,
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

    public static getRemoveMessage(address: string, nonce: BigNumberish): Uint8Array {
        const encodedResult = defaultAbiCoder.encode(["address", "uint256"], [address, nonce]);
        return arrayify(keccak256(encodedResult));
    }

    public static async signMessage(signer: Signer, message: Uint8Array): Promise<string> {
        return signer.signMessage(message);
    }

    public static getCurrencyMessage(
        height: BigNumberish,
        rates: { symbol: string; rate: BigNumberish }[]
    ): Uint8Array {
        const messages: BytesLike[] = [];
        for (const elem of rates) {
            const encodedData = defaultAbiCoder.encode(["string", "uint256"], [elem.symbol, elem.rate]);
            messages.push(keccak256(encodedData));
        }
        const encodedResult = defaultAbiCoder.encode(
            ["uint256", "uint256", "bytes32[]"],
            [height, rates.length, messages]
        );
        return arrayify(keccak256(encodedResult));
    }

    public static getTransferMessage(from: string, to: string, amount: BigNumberish, nonce: BigNumberish): Uint8Array {
        const encodedResult = defaultAbiCoder.encode(
            ["address", "address", "uint256", "uint256"],
            [from, to, amount, nonce]
        );
        return arrayify(keccak256(encodedResult));
    }

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

    public static zeroGWEI(value: BigNumber): BigNumber {
        return value.div(1000000000).mul(1000000000);
    }

    public static getSecret(): [string, string] {
        const secret = "0x" + Buffer.from(randomBytes(32)).toString("hex");
        const secretLock = keccak256(defaultAbiCoder.encode(["bytes32"], [secret]));
        return [secret, secretLock];
    }
}
