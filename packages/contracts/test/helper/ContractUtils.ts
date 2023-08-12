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
import { BigNumberish, Signer } from "ethers";
import * as hre from "hardhat";
import { arrayify } from "ethers/lib/utils";

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

    public static async sign(signer: Signer, hash: string, nonce: BigNumberish): Promise<string> {
        const encodedResult = hre.ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "uint256"],
            [hash, await signer.getAddress(), nonce]
        );
        const message = arrayify(hre.ethers.utils.keccak256(encodedResult));
        return signer.signMessage(message);
    }

    public static async signPayment(
        signer: Signer,
        purchaseId: string,
        amount: BigNumberish,
        userEmail: string,
        franchiseeId: string,
        nonce: BigNumberish
    ): Promise<string> {
        const encodedResult = hre.ethers.utils.defaultAbiCoder.encode(
            ["string", "uint256", "bytes32", "string", "address", "uint256"],
            [purchaseId, amount, userEmail, franchiseeId, await signer.getAddress(), nonce]
        );
        const message = arrayify(hre.ethers.utils.keccak256(encodedResult));
        return signer.signMessage(message);
    }

    public static async signExchange(
        signer: Signer,
        userEmail: string,
        amount: BigNumberish,
        nonce: BigNumberish
    ): Promise<string> {
        const encodedResult = hre.ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "uint256", "address", "uint256"],
            [userEmail, amount, await signer.getAddress(), nonce]
        );
        const message = arrayify(hre.ethers.utils.keccak256(encodedResult));
        return signer.signMessage(message);
    }
}
