/**
 *  Includes various useful functions for the solidity
 *
 *  Copyright:
 *      Copyright (c) 2022 BOSAGORA Foundation All rights reserved.
 *
 *  License:
 *       MIT License. See LICENSE for details.
 */

import { BigNumber, BigNumberish, BytesLike, Signer, utils } from "ethers";
// tslint:disable-next-line:no-submodule-imports
import { arrayify } from "ethers/lib/utils";
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

    public static getRequestId(hash: string, address: string, nonce: BigNumberish): string {
        const encodedResult = hre.ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "uint256", "bytes32"],
            [hash, address, nonce, utils.randomBytes(32)]
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

    public static getChangePayablePointMessage(phone: string, address: string, nonce: BigNumberish): Uint8Array {
        const encodedResult = hre.ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "uint256"],
            [phone, address, nonce]
        );
        return arrayify(hre.ethers.utils.keccak256(encodedResult));
    }

    public static async signChangePayablePoint(signer: Signer, phone: string, nonce: BigNumberish): Promise<string> {
        const message = ContractUtils.getChangePayablePointMessage(phone, await signer.getAddress(), nonce);
        return signer.signMessage(message);
    }

    public static getLoyaltyTypeMessage(address: string, nonce: BigNumberish): Uint8Array {
        const encodedResult = hre.ethers.utils.defaultAbiCoder.encode(["address", "uint256"], [address, nonce]);
        return arrayify(hre.ethers.utils.keccak256(encodedResult));
    }

    public static async signLoyaltyType(signer: Signer, nonce: BigNumberish): Promise<string> {
        const message = ContractUtils.getLoyaltyTypeMessage(await signer.getAddress(), nonce);
        return signer.signMessage(message);
    }

    public static getShopId(account: string): string {
        const encodedResult = hre.ethers.utils.defaultAbiCoder.encode(
            ["address", "bytes32"],
            [account, utils.randomBytes(32)]
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

    public static getPaymentId(account: string): string {
        const encodedResult = hre.ethers.utils.defaultAbiCoder.encode(
            ["address", "bytes32"],
            [account, utils.randomBytes(32)]
        );
        return hre.ethers.utils.keccak256(encodedResult);
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
        }[]
    ): Uint8Array {
        const messages: BytesLike[] = [];
        for (const elem of purchases) {
            const encodedData = hre.ethers.utils.defaultAbiCoder.encode(
                ["string", "uint256", "uint256", "string", "bytes32", "address", "bytes32"],
                [elem.purchaseId, elem.amount, elem.loyalty, elem.currency, elem.shopId, elem.account, elem.phone]
            );
            messages.push(hre.ethers.utils.keccak256(encodedData));
        }
        const encodedResult = hre.ethers.utils.defaultAbiCoder.encode(
            ["uint256", "uint256", "bytes32[]"],
            [height, purchases.length, messages]
        );
        return arrayify(hre.ethers.utils.keccak256(encodedResult));
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
            const encodedData = hre.ethers.utils.defaultAbiCoder.encode(
                ["string", "uint256"],
                [elem.symbol, elem.rate]
            );
            messages.push(hre.ethers.utils.keccak256(encodedData));
        }
        const encodedResult = hre.ethers.utils.defaultAbiCoder.encode(
            ["uint256", "uint256", "bytes32[]"],
            [height, rates.length, messages]
        );
        return arrayify(hre.ethers.utils.keccak256(encodedResult));
    }

    public static zeroGWEI(value: BigNumber): BigNumber {
        return value.div(1000000000).mul(1000000000);
    }
}
