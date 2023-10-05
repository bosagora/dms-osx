import "@nomiclabs/hardhat-ethers";
import * as crypto from "crypto";
import { BigNumberish, Signer } from "ethers";
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

    public static async sign(signer: Signer, hash: string, nonce: BigNumberish): Promise<string> {
        const encodedResult = hre.ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "uint256"],
            [hash, await signer.getAddress(), nonce]
        );
        const message = arrayify(hre.ethers.utils.keccak256(encodedResult));
        return signer.signMessage(message);
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

    public static getShopId(name: string, account: string): string {
        const encodedResult = hre.ethers.utils.defaultAbiCoder.encode(
            ["string", "address", "bytes32"],
            [name, account, crypto.randomBytes(32)]
        );
        return hre.ethers.utils.keccak256(encodedResult);
    }
}
