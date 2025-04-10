import { Tspec } from "tspec";
import { ResultCode } from "./types";

export type ChainBridgeApiSpec = Tspec.DefineApiSpec<{
    tags: ["Bridge"];
    paths: {
        "/v1/inner/bridge/deposit": {
            post: {
                summary: "Move token from Main Chain to Side Chain";
                body: {
                    /**
                     * Wallet address of the user
                     * @example "0x5650CD3E6E8963B43D21FAE60EE7A03BCEFCE766"
                     */
                    account: string;
                    /**
                     * Token amount to move
                     * @example "10000000000000000000000000"
                     */
                    amount: string;
                    /**
                     * Expiration time of signature
                     * @example 16745119473
                     */
                    expiry: number;
                    /**
                     * Signature of user wallet
                     * @example "0x020d671b80fbd20466d8cb65cef79a24e3bca3fdf82e9dd89d78e7a4c4c045bd72944c20bb1d839e76ee6bb69fed61f64376c37799598b40b8c49148f3cdd88a1b"
                     */
                    signature: string;
                };
                responses: {
                    200: {
                        /**
                         * Result Code
                         * @example 0
                         */
                        code: ResultCode;
                        data: {
                            /**
                             * ID of token
                             * @example "0x4d59fb5e21082f35b28aa792d8a0f71fccfe22d6c7138946d4840ba68b3d6fae"
                             */
                            tokenId: string;
                            /**
                             * ID of deposit
                             * @example "0x4347a36f5867097f26f0a6f8698a78a1ba0e367fce9ef72ba0b07e0af5bb42ff"
                             */
                            depositId: string;
                            /**
                             * Token amount to move
                             * @example "10000000000000000000000000"
                             */
                            amount: string;
                            /**
                             * Hash of transaction
                             * @example "0xe5502185d39057bd82e6dde675821b87313570df77d3e23d8e5712bd5f3fa6b6"
                             */
                            txHash: string;
                        };
                        error?: {
                            /**
                             * Error Message
                             * @example "Failed to check the validity of parameters"
                             */
                            message: string;
                        };
                    };
                };
            };
        };
        "/v1/inner/bridge/withdraw": {
            post: {
                summary: "Move token from Side Chain to Main Chain";
                body: {
                    /**
                     * Wallet address of the user
                     * @example "0x5650CD3E6E8963B43D21FAE60EE7A03BCEFCE766"
                     */
                    account: string;
                    /**
                     * Token amount to move
                     * @example "10000000000000000000000000"
                     */
                    amount: string;
                    /**
                     * Expiration time of signature
                     * @example 16745119473
                     */
                    expiry: number;
                    /**
                     * Signature of user wallet
                     * @example "0x020d671b80fbd20466d8cb65cef79a24e3bca3fdf82e9dd89d78e7a4c4c045bd72944c20bb1d839e76ee6bb69fed61f64376c37799598b40b8c49148f3cdd88a1b"
                     */
                    signature: string;
                };
                responses: {
                    200: {
                        /**
                         * Result Code
                         * @example 0
                         */
                        code: ResultCode;
                        data: {
                            /**
                             * ID of token
                             * @example "0x4d59fb5e21082f35b28aa792d8a0f71fccfe22d6c7138946d4840ba68b3d6fae"
                             */
                            tokenId: string;
                            /**
                             * ID of deposit
                             * @example "0x4347a36f5867097f26f0a6f8698a78a1ba0e367fce9ef72ba0b07e0af5bb42ff"
                             */
                            depositId: string;
                            /**
                             * Token amount to move
                             * @example "10000000000000000000000000"
                             */
                            amount: string;
                            /**
                             * Hash of transaction
                             * @example "0xe5502185d39057bd82e6dde675821b87313570df77d3e23d8e5712bd5f3fa6b6"
                             */
                            txHash: string;
                        };
                        error?: {
                            /**
                             * Error Message
                             * @example "Failed to check the validity of parameters"
                             */
                            message: string;
                        };
                    };
                };
            };
        };
        "/v1/outer/bridge/withdraw": {
            post: {
                summary: "Move token from Main Chain to Outer Chain";
                body: {
                    /**
                     * Wallet address of the user
                     * @example "0x5650CD3E6E8963B43D21FAE60EE7A03BCEFCE766"
                     */
                    account: string;
                    /**
                     * Token amount to move
                     * @example "10000000000000000000000000"
                     */
                    amount: string;
                    /**
                     * Expiration time of signature
                     * @example 16745119473
                     */
                    expiry: number;
                    /**
                     * Signature of user wallet
                     * @example "0x020d671b80fbd20466d8cb65cef79a24e3bca3fdf82e9dd89d78e7a4c4c045bd72944c20bb1d839e76ee6bb69fed61f64376c37799598b40b8c49148f3cdd88a1b"
                     */
                    signature: string;
                };
                responses: {
                    200: {
                        /**
                         * Result Code
                         * @example 0
                         */
                        code: ResultCode;
                        data: {
                            /**
                             * ID of token
                             * @example "0x4d59fb5e21082f35b28aa792d8a0f71fccfe22d6c7138946d4840ba68b3d6fae"
                             */
                            tokenId: string;
                            /**
                             * ID of deposit
                             * @example "0x4347a36f5867097f26f0a6f8698a78a1ba0e367fce9ef72ba0b07e0af5bb42ff"
                             */
                            depositId: string;
                            /**
                             * Token amount to move
                             * @example "10000000000000000000000000"
                             */
                            amount: string;
                            /**
                             * Hash of transaction
                             * @example "0xe5502185d39057bd82e6dde675821b87313570df77d3e23d8e5712bd5f3fa6b6"
                             */
                            txHash: string;
                        };
                        error?: {
                            /**
                             * Error Message
                             * @example "Failed to check the validity of parameters"
                             */
                            message: string;
                        };
                    };
                };
            };
        };
    };
}>;

export type LoyaltyBridgeApiSpec = Tspec.DefineApiSpec<{
    tags: ["Bridge", "Ledger"];
    paths: {
        "/v1/ledger/deposit_via_bridge": {
            post: {
                summary: "Move token from Main Chain to Ledger";
                body: {
                    /**
                     * Wallet address of the user
                     * @example "0x5650CD3E6E8963B43D21FAE60EE7A03BCEFCE766"
                     */
                    account: string;
                    /**
                     * Token amount to move
                     * @example "10000000000000000000000000"
                     */
                    amount: string;
                    /**
                     * Expiration time of signature
                     * @example 16745119473
                     */
                    expiry: number;
                    /**
                     * Signature of user wallet
                     * @example "0x020d671b80fbd20466d8cb65cef79a24e3bca3fdf82e9dd89d78e7a4c4c045bd72944c20bb1d839e76ee6bb69fed61f64376c37799598b40b8c49148f3cdd88a1b"
                     */
                    signature: string;
                };
                responses: {
                    200: {
                        /**
                         * Result Code
                         * @example 0
                         */
                        code: ResultCode;
                        data: {
                            /**
                             * ID of token
                             * @example "0x4d59fb5e21082f35b28aa792d8a0f71fccfe22d6c7138946d4840ba68b3d6fae"
                             */
                            tokenId: string;
                            /**
                             * ID of deposit
                             * @example "0x4347a36f5867097f26f0a6f8698a78a1ba0e367fce9ef72ba0b07e0af5bb42ff"
                             */
                            depositId: string;
                            /**
                             * Token amount to move
                             * @example "10000000000000000000000000"
                             */
                            amount: string;
                            /**
                             * Hash of transaction
                             * @example "0xe5502185d39057bd82e6dde675821b87313570df77d3e23d8e5712bd5f3fa6b6"
                             */
                            txHash: string;
                        };
                        error?: {
                            /**
                             * Error Message
                             * @example "Failed to check the validity of parameters"
                             */
                            message: string;
                        };
                    };
                };
            };
        };
        "/v1/ledger/withdraw_via_bridge": {
            post: {
                summary: "Move token from Ledger to Main Chain";
                body: {
                    /**
                     * Wallet address of the user
                     * @example "0x5650CD3E6E8963B43D21FAE60EE7A03BCEFCE766"
                     */
                    account: string;
                    /**
                     * Token amount to move
                     * @example "10000000000000000000000000"
                     */
                    amount: string;
                    /**
                     * Expiration time of signature
                     * @example 16745119473
                     */
                    expiry: number;
                    /**
                     * Signature of user wallet
                     * @example "0x020d671b80fbd20466d8cb65cef79a24e3bca3fdf82e9dd89d78e7a4c4c045bd72944c20bb1d839e76ee6bb69fed61f64376c37799598b40b8c49148f3cdd88a1b"
                     */
                    signature: string;
                };
                responses: {
                    200: {
                        /**
                         * Result Code
                         * @example 0
                         */
                        code: ResultCode;
                        data: {
                            /**
                             * ID of token
                             * @example "0x4d59fb5e21082f35b28aa792d8a0f71fccfe22d6c7138946d4840ba68b3d6fae"
                             */
                            tokenId: string;
                            /**
                             * ID of deposit
                             * @example "0x4347a36f5867097f26f0a6f8698a78a1ba0e367fce9ef72ba0b07e0af5bb42ff"
                             */
                            depositId: string;
                            /**
                             * Token amount to move
                             * @example "10000000000000000000000000"
                             */
                            amount: string;
                            /**
                             * Hash of transaction
                             * @example "0xe5502185d39057bd82e6dde675821b87313570df77d3e23d8e5712bd5f3fa6b6"
                             */
                            txHash: string;
                        };
                        error?: {
                            /**
                             * Error Message
                             * @example "Failed to check the validity of parameters"
                             */
                            message: string;
                        };
                    };
                };
            };
        };
    };
}>;
