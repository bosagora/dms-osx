import { Tspec } from "tspec";
import { ResultCode } from "./types";

export type Summary1ApiSpec = Tspec.DefineApiSpec<{
    tags: ["Summary", "Ledger"];
    paths: {
        "/v1/summary/account/{account}": {
            get: {
                summary: "Provide general information corresponding to the user's wallet address";
                path: {
                    /**
                     * Address of wallet
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
                            tokenInfo: {
                                /**
                                 * Symbol of Token
                                 * @example "ACC"
                                 */
                                symbol: string;
                                /**
                                 * Name of Token
                                 * @example "ACC Coin"
                                 */
                                name: string;
                                /**
                                 * Decimals of Token
                                 * @example 18
                                 */
                                decimals: number;
                            };
                            exchangeRate: {
                                token: {
                                    /**
                                     * Symbol of Token (info. decimals is 18)
                                     * @example "ACC"
                                     */
                                    symbol: string;
                                    /**
                                     * Amount of Token (info. decimals is 18)
                                     * @example "1000000000000000000"
                                     */
                                    value: string;
                                };
                                currency: {
                                    /**
                                     * Symbol of Basic Currency (info. decimals is 18)
                                     * @example "krw"
                                     */
                                    symbol: string;
                                    /**
                                     * Basic Currency Value for one token (info. decimals is 18)
                                     * @example "2169736506000000000"
                                     */
                                    value: string;
                                };
                            };
                            provider: {
                                /**
                                 * If true, this account is a point provider.
                                 * @example false
                                 */
                                enable: boolean;
                                /**
                                 * Technical representatives to provide point
                                 * @example "0x0000000000000000000000000000000000000000"
                                 */
                                assistant: string;
                            };
                            ledger: {
                                point: {
                                    /**
                                     * Balance of point in the Ledger (info. decimals is 18)
                                     * @example "3895000000000000000000"
                                     */
                                    balance: string;
                                    /**
                                     * Basic Currency Value of point in the Ledger (info. decimals is 18)
                                     * @example "3895000000000000000000"
                                     */
                                    value: string;
                                };
                                token: {
                                    /**
                                     * Balance of token in the Ledger (info. decimals is 18)
                                     * @example "1661929627132000000000"
                                     */
                                    balance: string;
                                    /**
                                     * Basic Currency Value of token in the Ledger (info. decimals is 18)
                                     * @example "3605949382391000000000"
                                     */
                                    value: string;
                                };
                            };
                            mainChain: {
                                point: {
                                    /**
                                     * Balance of point in the Main Chain (info. decimals is 18)
                                     * @example "0"
                                     */
                                    balance: string;
                                    /**
                                     * Basic Currency Value of point in the Main Chain (info. decimals is 18)
                                     * @example "0"
                                     */
                                    value: string;
                                };
                                token: {
                                    /**
                                     * Balance of token in the Main Chain (info. decimals is 18)
                                     * @example "99900000000000000000"
                                     */
                                    balance: string;
                                    /**
                                     * Basic Currency Value of token in the Main Chain (info. decimals is 18)
                                     * @example "216756676949000000000"
                                     */
                                    value: string;
                                };
                            };
                            sideChain: {
                                point: {
                                    /**
                                     * Balance of point in the Side Chain (info. decimals is 18)
                                     * @example "0"
                                     */
                                    balance: string;
                                    /**
                                     * Basic Currency Value of point in the Side Chain (info. decimals is 18)
                                     * @example "0"
                                     */
                                    value: string;
                                };
                                token: {
                                    /**
                                     * Balance of token in the Side Chain (info. decimals is 18)
                                     * @example "0"
                                     */
                                    balance: string;
                                    /**
                                     * Basic Currency Value of token in the Side Chain (info. decimals is 18)
                                     * @example "0"
                                     */
                                    value: string;
                                };
                            };
                            protocolFees: {
                                /**
                                 * Protocol fees required to use the transfer function (info. decimals is 18)
                                 * @example "100000000000000000"
                                 */
                                transfer: string;
                                /**
                                 * Protocol fees required to use the withdrawal function (info. decimals is 18)
                                 * @example "100000000000000000"
                                 */
                                withdraw: string;
                                /**
                                 * Protocol fees required to use the deposit function (info. decimals is 18)
                                 * @example "100000000000000000"
                                 */
                                deposit: string;
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
        "/v2/summary/account/{account}": {
            get: {
                summary: "Provide general information corresponding to the user's wallet address";
                path: {
                    /**
                     * Address of wallet
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
                            tokenInfo: {
                                /**
                                 * Symbol of Token
                                 * @example "ACC"
                                 */
                                symbol: string;
                                /**
                                 * Name of Token
                                 * @example "ACC Coin"
                                 */
                                name: string;
                                /**
                                 * Decimals of Token
                                 * @example 18
                                 */
                                decimals: number;
                            };
                            exchangeRate: {
                                token: {
                                    /**
                                     * Symbol of Token (info. decimals is 18)
                                     * @example "ACC"
                                     */
                                    symbol: string;
                                    /**
                                     * Amount of Token (info. decimals is 18)
                                     * @example "1000000000000000000"
                                     */
                                    value: string;
                                };
                                currency: {
                                    /**
                                     * Symbol of Basic Currency (info. decimals is 18)
                                     * @example "krw"
                                     */
                                    symbol: string;
                                    /**
                                     * Basic Currency Value for one token (info. decimals is 18)
                                     * @example "2169736506000000000"
                                     */
                                    value: string;
                                };
                            };
                            provider: {
                                /**
                                 * If true, this account is a point provider.
                                 * @example false
                                 */
                                enable: boolean;
                                /**
                                 * Technical representatives to provide point
                                 * @example "0x0000000000000000000000000000000000000000"
                                 */
                                assistant: string;
                            };
                            agent: {
                                /**
                                 * Agent of provision
                                 * @example "0x0000000000000000000000000000000000000000"
                                 */
                                provision: string;
                                /**
                                 * Agent of refund
                                 * @example "0x0000000000000000000000000000000000000000"
                                 */
                                refund: string;
                                /**
                                 * Agent of withdrawal
                                 * @example "0x0000000000000000000000000000000000000000"
                                 */
                                withdrawal: string;
                            };
                            ledger: {
                                point: {
                                    /**
                                     * Balance of point in the Ledger (info. decimals is 18)
                                     * @example "3895000000000000000000"
                                     */
                                    balance: string;
                                    /**
                                     * Basic Currency Value of point in the Ledger (info. decimals is 18)
                                     * @example "3895000000000000000000"
                                     */
                                    value: string;
                                };
                                token: {
                                    /**
                                     * Balance of token in the Ledger (info. decimals is 18)
                                     * @example "1661929627132000000000"
                                     */
                                    balance: string;
                                    /**
                                     * Basic Currency Value of token in the Ledger (info. decimals is 18)
                                     * @example "3605949382391000000000"
                                     */
                                    value: string;
                                };
                            };
                            mainChain: {
                                point: {
                                    /**
                                     * Balance of point in the Main Chain (info. decimals is 18)
                                     * @example "0"
                                     */
                                    balance: string;
                                    /**
                                     * Basic Currency Value of point in the Main Chain (info. decimals is 18)
                                     * @example "0"
                                     */
                                    value: string;
                                };
                                token: {
                                    /**
                                     * Balance of token in the Main Chain (info. decimals is 18)
                                     * @example "99900000000000000000"
                                     */
                                    balance: string;
                                    /**
                                     * Basic Currency Value of token in the Main Chain (info. decimals is 18)
                                     * @example "216756676949000000000"
                                     */
                                    value: string;
                                };
                            };
                            sideChain: {
                                point: {
                                    /**
                                     * Balance of point in the Side Chain (info. decimals is 18)
                                     * @example "0"
                                     */
                                    balance: string;
                                    /**
                                     * Basic Currency Value of point in the Side Chain (info. decimals is 18)
                                     * @example "0"
                                     */
                                    value: string;
                                };
                                token: {
                                    /**
                                     * Balance of token in the Side Chain (info. decimals is 18)
                                     * @example "0"
                                     */
                                    balance: string;
                                    /**
                                     * Basic Currency Value of token in the Side Chain (info. decimals is 18)
                                     * @example "0"
                                     */
                                    value: string;
                                };
                            };
                            protocolFees: {
                                /**
                                 * Protocol fees required to use the transfer function (info. decimals is 18)
                                 * @example "100000000000000000"
                                 */
                                transfer: string;
                                /**
                                 * Protocol fees required to use the withdrawal function (info. decimals is 18)
                                 * @example "100000000000000000"
                                 */
                                withdraw: string;
                                /**
                                 * Protocol fees required to use the deposit function (info. decimals is 18)
                                 * @example "100000000000000000"
                                 */
                                deposit: string;
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
        "/v3/summary/account/{account}": {
            get: {
                summary: "Provide general information corresponding to the user's wallet address";
                path: {
                    /**
                     * Address of wallet
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
                            tokenInfo: {
                                /**
                                 * Symbol of Token
                                 * @example "ACC"
                                 */
                                symbol: string;
                                /**
                                 * Name of Token
                                 * @example "ACC Coin"
                                 */
                                name: string;
                                /**
                                 * Decimals of Token
                                 * @example 18
                                 */
                                decimals: number;
                            };
                            exchangeRate: {
                                token: {
                                    /**
                                     * Symbol of Token (info. decimals is 18)
                                     * @example "ACC"
                                     */
                                    symbol: string;
                                    /**
                                     * Amount of Token (info. decimals is 18)
                                     * @example "1000000000000000000"
                                     */
                                    value: string;
                                };
                                currency: {
                                    /**
                                     * Symbol of Basic Currency (info. decimals is 18)
                                     * @example "krw"
                                     */
                                    symbol: string;
                                    /**
                                     * Basic Currency Value for one token (info. decimals is 18)
                                     * @example "2169736506000000000"
                                     */
                                    value: string;
                                };
                            };
                            provider: {
                                /**
                                 * If true, this account is a point provider.
                                 * @example false
                                 */
                                enable: boolean;
                                /**
                                 * Technical representatives to provide point
                                 * @example "0x0000000000000000000000000000000000000000"
                                 */
                                assistant: string;
                            };
                            agent: {
                                /**
                                 * Agent of provision
                                 * @example "0x0000000000000000000000000000000000000000"
                                 */
                                provision: string;
                                /**
                                 * Agent of refund
                                 * @example "0x0000000000000000000000000000000000000000"
                                 */
                                refund: string;
                                /**
                                 * Agent of withdrawal
                                 * @example "0x0000000000000000000000000000000000000000"
                                 */
                                withdrawal: string;
                            };
                            ledger: {
                                point: {
                                    /**
                                     * Balance of point in the Ledger (info. decimals is 18)
                                     * @example "3895000000000000000000"
                                     */
                                    balance: string;
                                    /**
                                     * Basic Currency Value of point in the Ledger (info. decimals is 18)
                                     * @example "3895000000000000000000"
                                     */
                                    value: string;
                                };
                                token: {
                                    /**
                                     * Balance of token in the Ledger (info. decimals is 18)
                                     * @example "1661929627132000000000"
                                     */
                                    balance: string;
                                    /**
                                     * Basic Currency Value of token in the Ledger (info. decimals is 18)
                                     * @example "3605949382391000000000"
                                     */
                                    value: string;
                                };
                            };
                            outerChain: {
                                point: {
                                    /**
                                     * Balance of point in the Main Chain (info. decimals is 18)
                                     * @example "0"
                                     */
                                    balance: string;
                                    /**
                                     * Basic Currency Value of point in the Main Chain (info. decimals is 18)
                                     * @example "0"
                                     */
                                    value: string;
                                };
                                token: {
                                    /**
                                     * Balance of token in the Main Chain (info. decimals is 18)
                                     * @example "99900000000000000000"
                                     */
                                    balance: string;
                                    /**
                                     * Basic Currency Value of token in the Main Chain (info. decimals is 18)
                                     * @example "216756676949000000000"
                                     */
                                    value: string;
                                };
                                native: {
                                    /**
                                     * Balance of token in the Main Chain (info. decimals is 18)
                                     * @example "99900000000000000000"
                                     */
                                    balance: string;
                                    symbol: "BOA";
                                };
                            };
                            mainChain: {
                                point: {
                                    /**
                                     * Balance of point in the Main Chain (info. decimals is 18)
                                     * @example "0"
                                     */
                                    balance: string;
                                    /**
                                     * Basic Currency Value of point in the Main Chain (info. decimals is 18)
                                     * @example "0"
                                     */
                                    value: string;
                                };
                                token: {
                                    /**
                                     * Balance of token in the Main Chain (info. decimals is 18)
                                     * @example "99900000000000000000"
                                     */
                                    balance: string;
                                    /**
                                     * Basic Currency Value of token in the Main Chain (info. decimals is 18)
                                     * @example "216756676949000000000"
                                     */
                                    value: string;
                                };
                                native: {
                                    /**
                                     * Balance of token in the Main Chain (info. decimals is 18)
                                     * @example "99900000000000000000"
                                     */
                                    balance: string;
                                    symbol: "BOA";
                                };
                            };
                            sideChain: {
                                point: {
                                    /**
                                     * Balance of point in the Side Chain (info. decimals is 18)
                                     * @example "0"
                                     */
                                    balance: string;
                                    /**
                                     * Basic Currency Value of point in the Side Chain (info. decimals is 18)
                                     * @example "0"
                                     */
                                    value: string;
                                };
                                token: {
                                    /**
                                     * Balance of token in the Side Chain (info. decimals is 18)
                                     * @example "0"
                                     */
                                    balance: string;
                                    /**
                                     * Basic Currency Value of token in the Side Chain (info. decimals is 18)
                                     * @example "0"
                                     */
                                    value: string;
                                };
                                native: {
                                    /**
                                     * Balance of token in the Main Chain (info. decimals is 18)
                                     * @example "99900000000000000000"
                                     */
                                    balance: string;
                                    symbol: "BOA";
                                };
                            };
                            protocolFees: {
                                /**
                                 * Protocol fees required to use the transfer function in main net (info. decimals is 18)
                                 * @example "100000000000000000"
                                 */
                                transferInMainNet: string;
                                /**
                                 * Protocol fees required to use the withdrawal function in main net (info. decimals is 18)
                                 * @example "100000000000000000"
                                 */
                                withdrawToMainNet: string;
                                /**
                                 * Protocol fees required to use the deposit function in main net (info. decimals is 18)
                                 * @example "100000000000000000"
                                 */
                                depositFromMainNet: string;
                                /**
                                 * Protocol fees required to use the withdrawal function in outer net (info. decimals is 18)
                                 * @example "100000000000000000"
                                 */
                                withdrawToOuterNet: string;
                                /**
                                 * Protocol fees required to use the deposit function in outer net (info. decimals is 18)
                                 * @example "100000000000000000"
                                 */
                                depositFromOuterNet: string;
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

export type Summary2ApiSpec = Tspec.DefineApiSpec<{
    tags: ["Summary", "Shop"];
    paths: {
        "/v1/summary/shop/{shopId}": {
            get: {
                summary: "Provide general information corresponding to the ID of shop";
                path: {
                    /**
                     * ID of Shop
                     * @example "0x0001be96d74202df38fd21462ffcef10dfe0fcbd7caa3947689a3903e8b6b874"
                     */
                    shopId: string;
                };
                responses: {
                    200: {
                        /**
                         * Result Code
                         * @example 0
                         */
                        code: ResultCode;
                        data: {
                            shopInfo: {
                                /**
                                 * ID of Shop
                                 * @example "0x0001be96d74202df38fd21462ffcef10dfe0fcbd7caa3947689a3903e8b6b874"
                                 */
                                shopId: string;
                                /**
                                 * Name of Shop
                                 * @example "Coffee Nine"
                                 */
                                name: string;
                                /**
                                 * Basic currency symbol of Shop
                                 * @example "krw"
                                 */
                                currency: string;
                                /**
                                 * Active status of Shop ( 0: None, 1: ACTIVE, 2: INACTIVE )
                                 * @example 1
                                 */
                                status: number;
                                /**
                                 * Wallet address of the shop owner
                                 * @example "0xafFe745418Ad24c272175e5B58610A8a35e2EcDa"
                                 */
                                account: string;
                                /**
                                 * Wallet address that authorizes cancellation on behalf of the shop owner
                                 * @example "0xD10ADf251463A260242c216c8c7D3e736eBdB398"
                                 */
                                delegator: string;
                                /**
                                 * Amount of provided
                                 * @example "0"
                                 */
                                providedAmount: string;
                                /**
                                 * Amount of used
                                 * @example "0"
                                 */
                                usedAmount: string;
                                /**
                                 * Amount of refunded
                                 * @example "0"
                                 */
                                refundedAmount: string;
                                /**
                                 * Basic currency amount of refundable
                                 * @example "0"
                                 */
                                refundableAmount: string;
                                /**
                                 * Token amount of refundable
                                 * @example "0"
                                 */
                                refundableToken: string;
                            };
                            tokenInfo: {
                                /**
                                 * Symbol of Token
                                 * @example "ACC"
                                 */
                                symbol: string;
                                /**
                                 * Name of Token
                                 * @example "ACC Coin"
                                 */
                                name: string;
                                /**
                                 * Decimals of Token
                                 * @example 18
                                 */
                                decimals: number;
                            };
                            exchangeRate: {
                                token: {
                                    /**
                                     * Symbol of Token (info. decimals is 18)
                                     * @example "ACC"
                                     */
                                    symbol: string;
                                    /**
                                     * Amount of Token (info. decimals is 18)
                                     * @example "1000000000000000000"
                                     */
                                    value: string;
                                };
                                currency: {
                                    /**
                                     * Symbol of Basic Currency (info. decimals is 18)
                                     * @example "krw"
                                     */
                                    symbol: string;
                                    /**
                                     * Basic Currency Value for one token (info. decimals is 18)
                                     * @example "2169736506000000000"
                                     */
                                    value: string;
                                };
                            };
                            ledger: {
                                point: {
                                    /**
                                     * Balance of point in the Ledger (info. decimals is 18)
                                     * @example "3895000000000000000000"
                                     */
                                    balance: string;
                                    /**
                                     * Basic Currency Value of point in the Ledger (info. decimals is 18)
                                     * @example "3895000000000000000000"
                                     */
                                    value: string;
                                };
                                token: {
                                    /**
                                     * Balance of token in the Ledger (info. decimals is 18)
                                     * @example "1661929627132000000000"
                                     */
                                    balance: string;
                                    /**
                                     * Basic Currency Value of token in the Ledger (info. decimals is 18)
                                     * @example "3605949382391000000000"
                                     */
                                    value: string;
                                };
                            };
                            mainChain: {
                                point: {
                                    /**
                                     * Balance of point in the Main Chain (info. decimals is 18)
                                     * @example "0"
                                     */
                                    balance: string;
                                    /**
                                     * Basic Currency Value of point in the Main Chain (info. decimals is 18)
                                     * @example "0"
                                     */
                                    value: string;
                                };
                                token: {
                                    /**
                                     * Balance of token in the Main Chain (info. decimals is 18)
                                     * @example "99900000000000000000"
                                     */
                                    balance: string;
                                    /**
                                     * Basic Currency Value of token in the Main Chain (info. decimals is 18)
                                     * @example "216756676949000000000"
                                     */
                                    value: string;
                                };
                            };
                            sideChain: {
                                point: {
                                    /**
                                     * Balance of point in the Side Chain (info. decimals is 18)
                                     * @example "0"
                                     */
                                    balance: string;
                                    /**
                                     * Basic Currency Value of point in the Side Chain (info. decimals is 18)
                                     * @example "0"
                                     */
                                    value: string;
                                };
                                token: {
                                    /**
                                     * Balance of token in the Side Chain (info. decimals is 18)
                                     * @example "0"
                                     */
                                    balance: string;
                                    /**
                                     * Basic Currency Value of token in the Side Chain (info. decimals is 18)
                                     * @example "0"
                                     */
                                    value: string;
                                };
                            };
                            protocolFees: {
                                /**
                                 * Protocol fees required to use the transfer function (info. decimals is 18)
                                 * @example "100000000000000000"
                                 */
                                transfer: string;
                                /**
                                 * Protocol fees required to use the withdrawal function (info. decimals is 18)
                                 * @example "100000000000000000"
                                 */
                                withdraw: string;
                                /**
                                 * Protocol fees required to use the deposit function (info. decimals is 18)
                                 * @example "100000000000000000"
                                 */
                                deposit: string;
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
        "/v2/summary/shop/{shopId}": {
            get: {
                summary: "Provide general information corresponding to the ID of shop";
                path: {
                    /**
                     * ID of Shop
                     * @example "0x0001be96d74202df38fd21462ffcef10dfe0fcbd7caa3947689a3903e8b6b874"
                     */
                    shopId: string;
                };
                responses: {
                    200: {
                        /**
                         * Result Code
                         * @example 0
                         */
                        code: ResultCode;
                        data: {
                            shopInfo: {
                                /**
                                 * ID of Shop
                                 * @example "0x0001be96d74202df38fd21462ffcef10dfe0fcbd7caa3947689a3903e8b6b874"
                                 */
                                shopId: string;
                                /**
                                 * Name of Shop
                                 * @example "Coffee Nine"
                                 */
                                name: string;
                                /**
                                 * Basic currency symbol of Shop
                                 * @example "krw"
                                 */
                                currency: string;
                                /**
                                 * Active status of Shop ( 0: None, 1: ACTIVE, 2: INACTIVE )
                                 * @example 1
                                 */
                                status: number;
                                /**
                                 * Wallet address of the shop owner
                                 * @example "0xafFe745418Ad24c272175e5B58610A8a35e2EcDa"
                                 */
                                account: string;
                                /**
                                 * Wallet address that authorizes cancellation on behalf of the shop owner
                                 * @example "0xD10ADf251463A260242c216c8c7D3e736eBdB398"
                                 */
                                delegator: string;
                                /**
                                 * Amount of provided
                                 * @example "0"
                                 */
                                providedAmount: string;
                                /**
                                 * Amount of used
                                 * @example "0"
                                 */
                                usedAmount: string;
                                /**
                                 * Amount of refunded
                                 * @example "0"
                                 */
                                refundedAmount: string;
                                /**
                                 * Basic currency amount of refundable
                                 * @example "0"
                                 */
                                refundableAmount: string;
                                /**
                                 * Token amount of refundable
                                 * @example "0"
                                 */
                                refundableToken: string;
                            };
                            tokenInfo: {
                                /**
                                 * Symbol of Token
                                 * @example "ACC"
                                 */
                                symbol: string;
                                /**
                                 * Name of Token
                                 * @example "ACC Coin"
                                 */
                                name: string;
                                /**
                                 * Decimals of Token
                                 * @example 18
                                 */
                                decimals: number;
                            };
                            exchangeRate: {
                                token: {
                                    /**
                                     * Symbol of Token (info. decimals is 18)
                                     * @example "ACC"
                                     */
                                    symbol: string;
                                    /**
                                     * Amount of Token (info. decimals is 18)
                                     * @example "1000000000000000000"
                                     */
                                    value: string;
                                };
                                currency: {
                                    /**
                                     * Symbol of Basic Currency (info. decimals is 18)
                                     * @example "krw"
                                     */
                                    symbol: string;
                                    /**
                                     * Basic Currency Value for one token (info. decimals is 18)
                                     * @example "2169736506000000000"
                                     */
                                    value: string;
                                };
                            };
                            settlement: {
                                /**
                                 * ID of manager shop for settlement
                                 * @example "0x0000000000000000000000000000000000000000000000000000000000000000"
                                 */
                                manager: string;
                            };
                            agent: {
                                /**
                                 * Agent of provision
                                 * @example "0x0000000000000000000000000000000000000000"
                                 */
                                provision: string;
                                /**
                                 * Agent of refund
                                 * @example "0x0000000000000000000000000000000000000000"
                                 */
                                refund: string;
                                /**
                                 * Agent of withdrawal
                                 * @example "0x0000000000000000000000000000000000000000"
                                 */
                                withdrawal: string;
                            };
                            ledger: {
                                point: {
                                    /**
                                     * Balance of point in the Ledger (info. decimals is 18)
                                     * @example "3895000000000000000000"
                                     */
                                    balance: string;
                                    /**
                                     * Basic Currency Value of point in the Ledger (info. decimals is 18)
                                     * @example "3895000000000000000000"
                                     */
                                    value: string;
                                };
                                token: {
                                    /**
                                     * Balance of token in the Ledger (info. decimals is 18)
                                     * @example "1661929627132000000000"
                                     */
                                    balance: string;
                                    /**
                                     * Basic Currency Value of token in the Ledger (info. decimals is 18)
                                     * @example "3605949382391000000000"
                                     */
                                    value: string;
                                };
                            };
                            mainChain: {
                                point: {
                                    /**
                                     * Balance of point in the Main Chain (info. decimals is 18)
                                     * @example "0"
                                     */
                                    balance: string;
                                    /**
                                     * Basic Currency Value of point in the Main Chain (info. decimals is 18)
                                     * @example "0"
                                     */
                                    value: string;
                                };
                                token: {
                                    /**
                                     * Balance of token in the Main Chain (info. decimals is 18)
                                     * @example "99900000000000000000"
                                     */
                                    balance: string;
                                    /**
                                     * Basic Currency Value of token in the Main Chain (info. decimals is 18)
                                     * @example "216756676949000000000"
                                     */
                                    value: string;
                                };
                            };
                            sideChain: {
                                point: {
                                    /**
                                     * Balance of point in the Side Chain (info. decimals is 18)
                                     * @example "0"
                                     */
                                    balance: string;
                                    /**
                                     * Basic Currency Value of point in the Side Chain (info. decimals is 18)
                                     * @example "0"
                                     */
                                    value: string;
                                };
                                token: {
                                    /**
                                     * Balance of token in the Side Chain (info. decimals is 18)
                                     * @example "0"
                                     */
                                    balance: string;
                                    /**
                                     * Basic Currency Value of token in the Side Chain (info. decimals is 18)
                                     * @example "0"
                                     */
                                    value: string;
                                };
                            };
                            protocolFees: {
                                /**
                                 * Protocol fees required to use the transfer function (info. decimals is 18)
                                 * @example "100000000000000000"
                                 */
                                transfer: string;
                                /**
                                 * Protocol fees required to use the withdrawal function (info. decimals is 18)
                                 * @example "100000000000000000"
                                 */
                                withdraw: string;
                                /**
                                 * Protocol fees required to use the deposit function (info. decimals is 18)
                                 * @example "100000000000000000"
                                 */
                                deposit: string;
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
        "/v3/summary/shop/{shopId}": {
            get: {
                summary: "Provide general information corresponding to the ID of shop";
                path: {
                    /**
                     * ID of Shop
                     * @example "0x0001be96d74202df38fd21462ffcef10dfe0fcbd7caa3947689a3903e8b6b874"
                     */
                    shopId: string;
                };
                responses: {
                    200: {
                        /**
                         * Result Code
                         * @example 0
                         */
                        code: ResultCode;
                        data: {
                            shopInfo: {
                                /**
                                 * ID of Shop
                                 * @example "0x0001be96d74202df38fd21462ffcef10dfe0fcbd7caa3947689a3903e8b6b874"
                                 */
                                shopId: string;
                                /**
                                 * Name of Shop
                                 * @example "Coffee Nine"
                                 */
                                name: string;
                                /**
                                 * Basic currency symbol of Shop
                                 * @example "krw"
                                 */
                                currency: string;
                                /**
                                 * Active status of Shop ( 0: None, 1: ACTIVE, 2: INACTIVE )
                                 * @example 1
                                 */
                                status: number;
                                /**
                                 * Wallet address of the shop owner
                                 * @example "0xafFe745418Ad24c272175e5B58610A8a35e2EcDa"
                                 */
                                account: string;
                                /**
                                 * Wallet address that authorizes cancellation on behalf of the shop owner
                                 * @example "0xD10ADf251463A260242c216c8c7D3e736eBdB398"
                                 */
                                delegator: string;
                                /**
                                 * Amount of provided
                                 * @example "0"
                                 */
                                providedAmount: string;
                                /**
                                 * Amount of used
                                 * @example "0"
                                 */
                                usedAmount: string;
                                /**
                                 * Amount of refunded
                                 * @example "0"
                                 */
                                refundedAmount: string;
                                /**
                                 * Basic currency amount of refundable
                                 * @example "0"
                                 */
                                refundableAmount: string;
                                /**
                                 * Token amount of refundable
                                 * @example "0"
                                 */
                                refundableToken: string;
                            };
                            tokenInfo: {
                                /**
                                 * Symbol of Token
                                 * @example "ACC"
                                 */
                                symbol: string;
                                /**
                                 * Name of Token
                                 * @example "ACC Coin"
                                 */
                                name: string;
                                /**
                                 * Decimals of Token
                                 * @example 18
                                 */
                                decimals: number;
                            };
                            exchangeRate: {
                                token: {
                                    /**
                                     * Symbol of Token (info. decimals is 18)
                                     * @example "ACC"
                                     */
                                    symbol: string;
                                    /**
                                     * Amount of Token (info. decimals is 18)
                                     * @example "1000000000000000000"
                                     */
                                    value: string;
                                };
                                currency: {
                                    /**
                                     * Symbol of Basic Currency (info. decimals is 18)
                                     * @example "krw"
                                     */
                                    symbol: string;
                                    /**
                                     * Basic Currency Value for one token (info. decimals is 18)
                                     * @example "2169736506000000000"
                                     */
                                    value: string;
                                };
                            };
                            settlement: {
                                /**
                                 * ID of manager shop for settlement
                                 * @example "0x0000000000000000000000000000000000000000000000000000000000000000"
                                 */
                                manager: string;
                            };
                            agent: {
                                /**
                                 * Agent of provision
                                 * @example "0x0000000000000000000000000000000000000000"
                                 */
                                provision: string;
                                /**
                                 * Agent of refund
                                 * @example "0x0000000000000000000000000000000000000000"
                                 */
                                refund: string;
                                /**
                                 * Agent of withdrawal
                                 * @example "0x0000000000000000000000000000000000000000"
                                 */
                                withdrawal: string;
                            };
                            ledger: {
                                point: {
                                    /**
                                     * Balance of point in the Ledger (info. decimals is 18)
                                     * @example "3895000000000000000000"
                                     */
                                    balance: string;
                                    /**
                                     * Basic Currency Value of point in the Ledger (info. decimals is 18)
                                     * @example "3895000000000000000000"
                                     */
                                    value: string;
                                };
                                token: {
                                    /**
                                     * Balance of token in the Ledger (info. decimals is 18)
                                     * @example "1661929627132000000000"
                                     */
                                    balance: string;
                                    /**
                                     * Basic Currency Value of token in the Ledger (info. decimals is 18)
                                     * @example "3605949382391000000000"
                                     */
                                    value: string;
                                };
                            };
                            outerChain: {
                                point: {
                                    /**
                                     * Balance of point in the Main Chain (info. decimals is 18)
                                     * @example "0"
                                     */
                                    balance: string;
                                    /**
                                     * Basic Currency Value of point in the Main Chain (info. decimals is 18)
                                     * @example "0"
                                     */
                                    value: string;
                                };
                                token: {
                                    /**
                                     * Balance of token in the Main Chain (info. decimals is 18)
                                     * @example "99900000000000000000"
                                     */
                                    balance: string;
                                    /**
                                     * Basic Currency Value of token in the Main Chain (info. decimals is 18)
                                     * @example "216756676949000000000"
                                     */
                                    value: string;
                                };
                                native: {
                                    /**
                                     * Balance of token in the Main Chain (info. decimals is 18)
                                     * @example "99900000000000000000"
                                     */
                                    balance: string;
                                    symbol: "BOA";
                                };
                            };
                            mainChain: {
                                point: {
                                    /**
                                     * Balance of point in the Main Chain (info. decimals is 18)
                                     * @example "0"
                                     */
                                    balance: string;
                                    /**
                                     * Basic Currency Value of point in the Main Chain (info. decimals is 18)
                                     * @example "0"
                                     */
                                    value: string;
                                };
                                token: {
                                    /**
                                     * Balance of token in the Main Chain (info. decimals is 18)
                                     * @example "99900000000000000000"
                                     */
                                    balance: string;
                                    /**
                                     * Basic Currency Value of token in the Main Chain (info. decimals is 18)
                                     * @example "216756676949000000000"
                                     */
                                    value: string;
                                };
                                native: {
                                    /**
                                     * Balance of token in the Main Chain (info. decimals is 18)
                                     * @example "99900000000000000000"
                                     */
                                    balance: string;
                                    symbol: "BOA";
                                };
                            };
                            sideChain: {
                                point: {
                                    /**
                                     * Balance of point in the Side Chain (info. decimals is 18)
                                     * @example "0"
                                     */
                                    balance: string;
                                    /**
                                     * Basic Currency Value of point in the Side Chain (info. decimals is 18)
                                     * @example "0"
                                     */
                                    value: string;
                                };
                                token: {
                                    /**
                                     * Balance of token in the Side Chain (info. decimals is 18)
                                     * @example "0"
                                     */
                                    balance: string;
                                    /**
                                     * Basic Currency Value of token in the Side Chain (info. decimals is 18)
                                     * @example "0"
                                     */
                                    value: string;
                                };
                                native: {
                                    /**
                                     * Balance of token in the Main Chain (info. decimals is 18)
                                     * @example "99900000000000000000"
                                     */
                                    balance: string;
                                    symbol: "BOA";
                                };
                            };
                            protocolFees: {
                                /**
                                 * Protocol fees required to use the transfer function in main net (info. decimals is 18)
                                 * @example "100000000000000000"
                                 */
                                transferInMainNet: string;
                                /**
                                 * Protocol fees required to use the withdrawal function in main net (info. decimals is 18)
                                 * @example "100000000000000000"
                                 */
                                withdrawToMainNet: string;
                                /**
                                 * Protocol fees required to use the deposit function in main net (info. decimals is 18)
                                 * @example "100000000000000000"
                                 */
                                depositFromMainNet: string;
                                /**
                                 * Protocol fees required to use the withdrawal function in outer net (info. decimals is 18)
                                 * @example "100000000000000000"
                                 */
                                withdrawToOuterNet: string;
                                /**
                                 * Protocol fees required to use the deposit function in outer net (info. decimals is 18)
                                 * @example "100000000000000000"
                                 */
                                depositFromOuterNet: string;
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
