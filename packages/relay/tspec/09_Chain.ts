import { Tspec } from "tspec";
import { ResultCode } from "./types";

export type MainChainApiSpec = Tspec.DefineApiSpec<{
    tags: ["Chain Info", "Main Chain"];
    paths: {
        "/v1/chain/main/info": {
            get: {
                summary: "Provide information of main chain";
                responses: {
                    200: {
                        /**
                         * Result Code
                         * @example 0
                         */
                        code: ResultCode;
                        data: {
                            /**
                             * Endpoint of RPC
                             * @example "https://testnet.bosagora.org/"
                             */
                            url: string;
                            network: {
                                /**
                                 * Name of Network
                                 * @example "main-chain"
                                 */
                                name: string;
                                /**
                                 * Chain ID of Network
                                 * @example 2019
                                 */
                                chainId: number;
                                /**
                                 * ENS Address
                                 * @example "0x0000000000000000000000000000000000000000"
                                 */
                                ensAddress: string;
                                /**
                                 * Fee of Transfer
                                 * @example "100000000000000000"
                                 */
                                chainTransferFee: string;
                                /**
                                 * Fee of Bridge
                                 * @example "100000000000000000"
                                 */
                                chainBridgeFee: string;
                                /**
                                 * Fee of Loyalty Transfer
                                 * @example "0"
                                 */
                                loyaltyTransferFee: string;
                                /**
                                 * Fee of Loyalty Bridge
                                 * @example "100000000000000000"
                                 */
                                loyaltyBridgeFee: string;
                            };
                            contract: {
                                /**
                                 * Address of token contract
                                 * @example "0xBd837b831cA3aA1e9eE388959d9f5B81262ccfA6"
                                 */
                                token: string;
                                /**
                                 * Address of chain bridge
                                 * @example "0x097C7543464d3De422f86248F1CE803879a4077e"
                                 */
                                chainBridge: string;
                                /**
                                 * Address of loyalty bridge
                                 * @example "0x22B98e18c51D02AF225b3fBa726865fB497B1afD"
                                 */
                                loyaltyBridge: string;
                            };
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
        "/v3/chain/main/info": {
            get: {
                summary: "Provide information of main chain";
                responses: {
                    200: {
                        /**
                         * Result Code
                         * @example 0
                         */
                        code: ResultCode;
                        data: {
                            /**
                             * Endpoint of RPC
                             * @example "https://testnet.bosagora.org/"
                             */
                            url: string;
                            network: {
                                /**
                                 * Name of Network
                                 * @example "main-chain"
                                 */
                                name: string;
                                /**
                                 * Chain ID of Network
                                 * @example 2019
                                 */
                                chainId: number;
                                /**
                                 * ENS Address
                                 * @example "0x0000000000000000000000000000000000000000"
                                 */
                                ensAddress: string;
                                /**
                                 * Fee of Transfer
                                 * @example "100000000000000000"
                                 */
                                chainTransferFee: string;
                                /**
                                 * Fee of Loyalty Transfer
                                 * @example "0"
                                 */
                                loyaltyTransferFee: string;
                                /**
                                 * Fee of Loyalty Bridge
                                 * @example "100000000000000000"
                                 */
                                loyaltyBridgeFee: string;
                                /**
                                 * Fee of Bridge
                                 * @example "100000000000000000"
                                 */
                                innerChainBridgeFee: string;
                                /**
                                 * Fee of Bridge
                                 * @example "100000000000000000"
                                 */
                                outerChainBridgeFee: string;
                            };
                            contract: {
                                /**
                                 * Address of token contract
                                 * @example "0xBd837b831cA3aA1e9eE388959d9f5B81262ccfA6"
                                 */
                                token: string;
                                /**
                                 * Address of loyalty bridge
                                 * @example "0x22B98e18c51D02AF225b3fBa726865fB497B1afD"
                                 */
                                loyaltyBridge: string;
                                /**
                                 * Address of chain bridge
                                 * @example "0x097C7543464d3De422f86248F1CE803879a4077e"
                                 */
                                innerChainBridge: string;
                                /**
                                 * Address of chain bridge
                                 * @example "0x097C7543464d3De422f86248F1CE803879a4077e"
                                 */
                                outerChainBridge: string;
                            };
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

export type SideChainApiSpec = Tspec.DefineApiSpec<{
    tags: ["Chain Info", "Side Chain"];
    paths: {
        "/v1/chain/side/info": {
            get: {
                summary: "Provide information of side chain";
                responses: {
                    200: {
                        /**
                         * Result Code
                         * @example 0
                         */
                        code: ResultCode;
                        data: {
                            /**
                             * Endpoint of RPC
                             * @example "https://rpc.test.acccoin.io/"
                             */
                            url: string;
                            network: {
                                /**
                                 * Name of Network
                                 * @example "side-chain"
                                 */
                                name: string;
                                /**
                                 * Chain ID of Network
                                 * @example 215115
                                 */
                                chainId: number;
                                /**
                                 * ENS Address
                                 * @example "0x0000000000000000000000000000000000000000"
                                 */
                                ensAddress: string;
                                /**
                                 * Fee of Transfer
                                 * @example "100000000000000000"
                                 */
                                chainTransferFee: string;
                                /**
                                 * Fee of Bridge
                                 * @example "100000000000000000"
                                 */
                                chainBridgeFee: string;
                                /**
                                 * Fee of Loyalty Transfer
                                 * @example "0"
                                 */
                                loyaltyTransferFee: string;
                                /**
                                 * Fee of Loyalty Bridge
                                 * @example "100000000000000000"
                                 */
                                loyaltyBridgeFee: string;
                            };
                            contract: {
                                /**
                                 * Address of token contract
                                 * @example "0x8D34D6102AD64abDa8bcF36c278140bAC4D97323"
                                 */
                                token: string;
                                /**
                                 * Address of PhoneLinkCollection contract
                                 * @example "0x23074adeD2E687C30483A64869AaA0e8C22e90C9"
                                 */
                                phoneLink: string;
                                /**
                                 * Address of CurrencyRate contract
                                 * @example "0x8374a5b754cb708C05E846AE9BbEA10f732F1283"
                                 */
                                currencyRate: string;
                                /**
                                 * Address of LoyaltyProvider contract
                                 * @example "0xBF330C5c5f7b83631160Eef4e7C8d0dEd17eE350"
                                 */
                                loyaltyProvider: string;
                                /**
                                 * Address of LoyaltyConsumer contract
                                 * @example "0x9929a4c45dA7650D690103df1c46Da2DadaC0288"
                                 */
                                loyaltyConsumer: string;
                                /**
                                 * Address of loyaltyTransfer contract
                                 * @example "0x1cda3562c535E65C501bda87a2cda792Feb931c1"
                                 */
                                loyaltyTransfer: string;
                                /**
                                 * Address of loyaltyExchanger contract
                                 * @example "0x69328a59c9826FedBADF0C412B59DE350771ff28"
                                 */
                                loyaltyExchanger: string;
                                /**
                                 * Address of LoyaltyBridge contract
                                 * @example "0x877ab4A2d858926EE65769723d4ea825E055024e"
                                 */
                                loyaltyBridge: string;
                                /**
                                 * Address of Shop contract
                                 * @example "0x911b2749053f966c651777A4485DDB4E33CE495F"
                                 */
                                shop: string;
                                /**
                                 * Address of Ledger contract
                                 * @example "0xe782E73900613EF72E972C9e73669e1e0aBc859E"
                                 */
                                ledger: string;
                                /**
                                 * Address of chain bridge
                                 * @example "0x2902aa3D47075AB2b87e8345094Ea1c87e5B5019"
                                 */
                                chainBridge: string;
                            };
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
        "/v3/chain/side/info": {
            get: {
                summary: "Provide information of side chain";
                responses: {
                    200: {
                        /**
                         * Result Code
                         * @example 0
                         */
                        code: ResultCode;
                        data: {
                            /**
                             * Endpoint of RPC
                             * @example "https://rpc.test.acccoin.io/"
                             */
                            url: string;
                            network: {
                                /**
                                 * Name of Network
                                 * @example "side-chain"
                                 */
                                name: string;
                                /**
                                 * Chain ID of Network
                                 * @example 215115
                                 */
                                chainId: number;
                                /**
                                 * ENS Address
                                 * @example "0x0000000000000000000000000000000000000000"
                                 */
                                ensAddress: string;
                                /**
                                 * Fee of Transfer
                                 * @example "100000000000000000"
                                 */
                                chainTransferFee: string;
                                /**
                                 * Fee of Loyalty Transfer
                                 * @example "0"
                                 */
                                loyaltyTransferFee: string;
                                /**
                                 * Fee of Loyalty Bridge
                                 * @example "100000000000000000"
                                 */
                                loyaltyBridgeFee: string;
                                /**
                                 * Fee of Bridge
                                 * @example "100000000000000000"
                                 */
                                innerChainBridgeFee: string;
                                /**
                                 * Fee of Bridge
                                 * @example "100000000000000000"
                                 */
                                outerChainBridgeFee: string;
                            };
                            contract: {
                                /**
                                 * Address of token contract
                                 * @example "0x8D34D6102AD64abDa8bcF36c278140bAC4D97323"
                                 */
                                token: string;
                                /**
                                 * Address of PhoneLinkCollection contract
                                 * @example "0x23074adeD2E687C30483A64869AaA0e8C22e90C9"
                                 */
                                phoneLink: string;
                                /**
                                 * Address of CurrencyRate contract
                                 * @example "0x8374a5b754cb708C05E846AE9BbEA10f732F1283"
                                 */
                                currencyRate: string;
                                /**
                                 * Address of LoyaltyProvider contract
                                 * @example "0xBF330C5c5f7b83631160Eef4e7C8d0dEd17eE350"
                                 */
                                loyaltyProvider: string;
                                /**
                                 * Address of LoyaltyConsumer contract
                                 * @example "0x9929a4c45dA7650D690103df1c46Da2DadaC0288"
                                 */
                                loyaltyConsumer: string;
                                /**
                                 * Address of loyaltyTransfer contract
                                 * @example "0x1cda3562c535E65C501bda87a2cda792Feb931c1"
                                 */
                                loyaltyTransfer: string;
                                /**
                                 * Address of loyaltyExchanger contract
                                 * @example "0x69328a59c9826FedBADF0C412B59DE350771ff28"
                                 */
                                loyaltyExchanger: string;
                                /**
                                 * Address of LoyaltyBridge contract
                                 * @example "0x877ab4A2d858926EE65769723d4ea825E055024e"
                                 */
                                loyaltyBridge: string;
                                /**
                                 * Address of Shop contract
                                 * @example "0x911b2749053f966c651777A4485DDB4E33CE495F"
                                 */
                                shop: string;
                                /**
                                 * Address of Ledger contract
                                 * @example "0xe782E73900613EF72E972C9e73669e1e0aBc859E"
                                 */
                                ledger: string;
                                /**
                                 * Address of chain bridge
                                 * @example "0x2902aa3D47075AB2b87e8345094Ea1c87e5B5019"
                                 */
                                innerChainBridge: string;
                                /**
                                 * Address of chain bridge
                                 * @example "0x0000000000000000000000000000000000000000"
                                 */
                                outerChainBridge: string;
                            };
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

export type OuterChainApiSpec = Tspec.DefineApiSpec<{
    tags: ["Chain Info", "Outer Chain"];
    paths: {
        "/v3/chain/outer/info": {
            get: {
                summary: "Provide information of outer chain";
                responses: {
                    200: {
                        /**
                         * Result Code
                         * @example 0
                         */
                        code: ResultCode;
                        data: {
                            /**
                             * Endpoint of RPC
                             * @example "https://testnet.bosagora.org/"
                             */
                            url: string;
                            network: {
                                /**
                                 * Name of Network
                                 * @example "main-chain"
                                 */
                                name: string;
                                /**
                                 * Chain ID of Network
                                 * @example 2019
                                 */
                                chainId: number;
                                /**
                                 * ENS Address
                                 * @example "0x0000000000000000000000000000000000000000"
                                 */
                                ensAddress: string;
                                /**
                                 * Fee of Transfer
                                 * @example "100000000000000000"
                                 */
                                chainTransferFee: string;
                                /**
                                 * Fee of Loyalty Transfer
                                 * @example "0"
                                 */
                                loyaltyTransferFee: string;
                                /**
                                 * Fee of Loyalty Bridge
                                 * @example "100000000000000000"
                                 */
                                loyaltyBridgeFee: string;
                                /**
                                 * Fee of Bridge
                                 * @example "100000000000000000"
                                 */
                                innerChainBridgeFee: string;
                                /**
                                 * Fee of Bridge
                                 * @example "100000000000000000"
                                 */
                                outerChainBridgeFee: string;
                            };
                            contract: {
                                /**
                                 * Address of token contract
                                 * @example "0xBd837b831cA3aA1e9eE388959d9f5B81262ccfA6"
                                 */
                                token: string;
                                /**
                                 * Address of loyalty bridge
                                 * @example "0x22B98e18c51D02AF225b3fBa726865fB497B1afD"
                                 */
                                loyaltyBridge: string;
                                /**
                                 * Address of inner chain bridge
                                 * @example "0x097C7543464d3De422f86248F1CE803879a4077e"
                                 */
                                innerChainBridge: string;
                                /**
                                 * Address of outer chain bridge
                                 * @example "0x097C7543464d3De422f86248F1CE803879a4077e"
                                 */
                                outerChainBridge: string;
                            };
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

export type OuterChainTokenApiSpec = Tspec.DefineApiSpec<{
    tags: ["Outer Chain", "Loyalty Token"];
    paths: {
        "/v1/token/outer/balance/{account}": {
            get: {
                summary: "Provide token balance in the outer chain";
                path: {
                    /**
                     * Address of user wallet
                     * @example "0x5650CD3E6E8963B43D21FAE60EE7A03BCEFCE766"
                     */
                    account: string;
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
                             * Address of user wallet
                             * @example "0x5650CD3E6E8963B43D21FAE60EE7A03BCEFCE766"
                             */
                            account: string;
                            /**
                             * Balance of Token (info. decimals are 18)
                             * @example "10000000000000000000000000"
                             */
                            balance: string;
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

export type MainChainTokenApiSpec = Tspec.DefineApiSpec<{
    tags: ["Main Chain", "Loyalty Token"];
    paths: {
        "/v1/token/main/balance/{account}": {
            get: {
                summary: "Provide token balance in the main chain";
                path: {
                    /**
                     * Address of user wallet
                     * @example "0x5650CD3E6E8963B43D21FAE60EE7A03BCEFCE766"
                     */
                    account: string;
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
                             * Address of user wallet
                             * @example "0x5650CD3E6E8963B43D21FAE60EE7A03BCEFCE766"
                             */
                            account: string;
                            /**
                             * Balance of Token (info. decimals are 18)
                             * @example "10000000000000000000000000"
                             */
                            balance: string;
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
        "/v1/token/main/nonce/{account}": {
            get: {
                summary: "Provide nonce in the main chain";
                path: {
                    /**
                     * Address of user wallet
                     * @example "0x5650CD3E6E8963B43D21FAE60EE7A03BCEFCE766"
                     */
                    account: string;
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
                             * Address of wallet
                             * @example "0x5650CD3E6E8963B43D21FAE60EE7A03BCEFCE766"
                             */
                            account: string;

                            /**
                             * Nonce for address of wallet in Ledger Contract
                             * @example "45"
                             */
                            nonce: string;
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
        "/v1/token/main/transfer": {
            post: {
                summary: "Transfer token in the main chain";
                body: {
                    /**
                     * Token amount to be transfer
                     * @example "10000000000000000000000000"
                     */
                    amount: string;
                    /**
                     * Wallet address of sender
                     * @example "0x64D111eA9763c93a003cef491941A011B8df5a49"
                     */
                    from: string;
                    /**
                     * Wallet address of receiver
                     * @example "0x3FE8D00143bd0eAd2397D48ba0E31E5E1268dBfb"
                     */
                    to: string;
                    /**
                     * Expiration time of signature
                     * @example 16745119473
                     */
                    expiry: string;
                    /**
                     * Signature of sender wallet
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
                             * Wallet address of sender
                             * @example "0x64D111eA9763c93a003cef491941A011B8df5a49"
                             */
                            from: string;
                            /**
                             * Wallet address of receiver
                             * @example "0x3FE8D00143bd0eAd2397D48ba0E31E5E1268dBfb"
                             */
                            to: string;
                            /**
                             * Token amount to be transfer
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

export type SideChainTokenApiSpec = Tspec.DefineApiSpec<{
    tags: ["Side Chain", "Loyalty Token"];
    paths: {
        "/v1/token/side/balance/{account}": {
            get: {
                summary: "Provide token balance in the side chain";
                path: {
                    /**
                     * Address of user wallet
                     * @example "0x5650CD3E6E8963B43D21FAE60EE7A03BCEFCE766"
                     */
                    account: string;
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
                             * Address of user wallet
                             * @example "0x5650CD3E6E8963B43D21FAE60EE7A03BCEFCE766"
                             */
                            account: string;
                            /**
                             * Balance of Token (info. decimals are 18)
                             * @example "10000000000000000000000000"
                             */
                            balance: string;
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
        "/v1/token/side/nonce/{account}": {
            get: {
                summary: "Provide nonce in the side chain";
                path: {
                    /**
                     * Address of user wallet
                     * @example "0x5650CD3E6E8963B43D21FAE60EE7A03BCEFCE766"
                     */
                    account: string;
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
                             * Address of wallet
                             * @example "0x5650CD3E6E8963B43D21FAE60EE7A03BCEFCE766"
                             */
                            account: string;

                            /**
                             * Nonce for address of wallet in Ledger Contract
                             * @example "45"
                             */
                            nonce: string;
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
        "/v1/token/side/transfer": {
            post: {
                summary: "Transfer token in the side chain";
                body: {
                    /**
                     * Token amount to be transfer
                     * @example "10000000000000000000000000"
                     */
                    amount: string;
                    /**
                     * Wallet address of sender
                     * @example "0x64D111eA9763c93a003cef491941A011B8df5a49"
                     */
                    from: string;
                    /**
                     * Wallet address of receiver
                     * @example "0x3FE8D00143bd0eAd2397D48ba0E31E5E1268dBfb"
                     */
                    to: string;
                    /**
                     * Expiration time of signature
                     * @example 16745119473
                     */
                    expiry: string;
                    /**
                     * Signature of sender wallet
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
                             * Wallet address of sender
                             * @example "0x64D111eA9763c93a003cef491941A011B8df5a49"
                             */
                            from: string;
                            /**
                             * Wallet address of receiver
                             * @example "0x3FE8D00143bd0eAd2397D48ba0E31E5E1268dBfb"
                             */
                            to: string;
                            /**
                             * Token amount to be transfer
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
