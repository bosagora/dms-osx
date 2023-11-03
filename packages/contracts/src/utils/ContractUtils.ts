/**
 *  Includes various useful functions for the solidity
 *
 *  Copyright:
 *      Copyright (c) 2022 BOSAGORA Foundation All rights reserved.
 *
 *  License:
 *       MIT License. See LICENSE for details.
 */

import crypto from "crypto";
import { BigNumberish, BytesLike, Signer } from "ethers";
// tslint:disable-next-line:no-submodule-imports
import { arrayify } from "ethers/lib/utils";
import * as hre from "hardhat";

export class ContractUtils {
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
            [hash, address, nonce, crypto.randomBytes(32)]
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

    public static getLoyaltyPaymentMessage(
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

    public static async signLoyaltyPayment(
        signer: Signer,
        paymentId: string,
        purchaseId: string,
        amount: BigNumberish,
        currency: string,
        shopId: string,
        nonce: BigNumberish
    ): Promise<string> {
        const message = ContractUtils.getLoyaltyPaymentMessage(
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

    public static getLoyaltyPaymentCancelMessage(
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

    public static async signLoyaltyPaymentCancel(
        signer: Signer,
        paymentId: string,
        purchaseId: string,
        nonce: BigNumberish
    ): Promise<string> {
        const message = ContractUtils.getLoyaltyPaymentCancelMessage(
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
            [account, crypto.randomBytes(32)]
        );
        return hre.ethers.utils.keccak256(encodedResult);
    }

    public static getShopMessage(
        shopId: BytesLike,
        name: string,
        provideWaitTime: BigNumberish,
        providePercent: BigNumberish,
        account: string,
        nonce: BigNumberish
    ): Uint8Array {
        const encodedResult = hre.ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "string", "uint256", "uint256", "address", "uint256"],
            [shopId, name, provideWaitTime, providePercent, account, nonce]
        );
        return arrayify(hre.ethers.utils.keccak256(encodedResult));
    }

    public static async signShop(
        signer: Signer,
        shopId: BytesLike,
        name: string,
        provideWaitTime: BigNumberish,
        providePercent: BigNumberish,
        nonce: BigNumberish
    ): Promise<string> {
        const message = ContractUtils.getShopMessage(
            shopId,
            name,
            provideWaitTime,
            providePercent,
            await signer.getAddress(),
            nonce
        );
        return signer.signMessage(message);
    }

    public static getShopIdMessage(shopId: BytesLike, account: string, nonce: BigNumberish): Uint8Array {
        const encodedResult = hre.ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "uint256"],
            [shopId, account, nonce]
        );
        return arrayify(hre.ethers.utils.keccak256(encodedResult));
    }

    public static async signShopId(signer: Signer, shopId: BytesLike, nonce: BigNumberish): Promise<string> {
        const message = ContractUtils.getShopIdMessage(shopId, await signer.getAddress(), nonce);
        return signer.signMessage(message);
    }

    public static getPaymentId(account: string): string {
        const encodedResult = hre.ethers.utils.defaultAbiCoder.encode(
            ["address", "bytes32"],
            [account, crypto.randomBytes(32)]
        );
        return hre.ethers.utils.keccak256(encodedResult);
    }
}
