import * as crypto from "crypto";
import { BigNumberish, ethers, Signer } from "ethers";
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

    public static getRequestId(emailHash: string, address: string, nonce: BigNumberish): string {
        const encodedResult = hre.ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "uint256", "bytes32"],
            [emailHash, address, nonce, crypto.randomBytes(32)]
        );
        return hre.ethers.utils.keccak256(encodedResult);
    }

    public static async sign(signer: Signer, hash: string, nonce: BigNumberish): Promise<string> {
        const encodedResult = ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "uint256"],
            [hash, await signer.getAddress(), nonce]
        );
        const message = arrayify(ethers.utils.keccak256(encodedResult));
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
        const encodedResult = ethers.utils.defaultAbiCoder.encode(
            ["string", "uint256", "bytes32", "string", "address", "uint256"],
            [purchaseId, amount, userEmail, franchiseeId, await signer.getAddress(), nonce]
        );
        const message = arrayify(ethers.utils.keccak256(encodedResult));
        return signer.signMessage(message);
    }

    public static verifyPayment(
        purchaseId: string,
        amount: BigNumberish,
        userEmail: string,
        franchiseeId: string,
        signerAddress: string,
        nonce: BigNumberish,
        signature: string
    ): boolean {
        const encodedResult = ethers.utils.defaultAbiCoder.encode(
            ["string", "uint256", "bytes32", "string", "address", "uint256"],
            [purchaseId, amount, userEmail, franchiseeId, signerAddress, nonce]
        );
        const message = arrayify(ethers.utils.keccak256(encodedResult));
        let res: string;
        try {
            res = ethers.utils.verifyMessage(message, signature);
        } catch (error) {
            return false;
        }
        return res.toLowerCase() === signerAddress.toLowerCase();
    }

    public static async signExchange(
        signer: Signer,
        userEmail: string,
        amount: BigNumberish,
        nonce: BigNumberish
    ): Promise<string> {
        const encodedResult = ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "uint256", "address", "uint256"],
            [userEmail, amount, await signer.getAddress(), nonce]
        );
        const message = arrayify(ethers.utils.keccak256(encodedResult));
        return signer.signMessage(message);
    }

    public static verifyExchange(
        signerAddress: string,
        userEmail: string,
        amount: BigNumberish,
        nonce: BigNumberish,
        signature: string
    ): boolean {
        const encodedResult = ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "uint256", "address", "uint256"],
            [userEmail, amount, signerAddress, nonce]
        );
        const message = arrayify(ethers.utils.keccak256(encodedResult));
        let res: string;
        try {
            res = ethers.utils.verifyMessage(message, signature);
        } catch (error) {
            return false;
        }
        return res.toLowerCase() === signerAddress.toLowerCase();
    }
}
