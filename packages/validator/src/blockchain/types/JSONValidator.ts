import Ajv from "ajv";

const ajv = new Ajv();

export class JSONValidator {
    private static schemas: Map<string, object> = new Map([
        [
            "Block",
            {
                title: "Block",
                type: "object",
                properties: {
                    header: {
                        type: "object",
                    },
                    purchases: {
                        type: "object",
                    },
                    exchangeRates: {
                        type: "object",
                    },
                    burnPoints: {
                        type: "object",
                    },
                },
                additionalProperties: false,
                required: ["header", "purchases", "exchangeRates", "burnPoints"],
            },
        ],
        [
            "BlockHeader",
            {
                title: "BlockHeader",
                type: "object",
                properties: {
                    prevBlockHash: {
                        type: "string",
                    },
                    slot: {
                        type: "string",
                    },
                    timestamp: {
                        type: "string",
                    },
                    purchaseHash: {
                        type: "string",
                    },
                    exchangeRateHash: {
                        type: "string",
                    },
                    burnPointHash: {
                        type: "string",
                    },
                    signature: {
                        type: "string",
                    },
                },
                additionalProperties: false,
                required: [
                    "prevBlockHash",
                    "slot",
                    "timestamp",
                    "purchaseHash",
                    "exchangeRateHash",
                    "burnPointHash",
                    "signature",
                ],
            },
        ],
        [
            "PurchaseRoot",
            {
                title: "PurchaseRoot",
                type: "object",
                properties: {
                    branches: {
                        items: {
                            type: "object",
                        },
                        type: "array",
                    },
                    signatures: {
                        items: {
                            type: "object",
                        },
                        type: "array",
                    },
                },
                additionalProperties: false,
                required: ["branches", "signatures"],
            },
        ],
        [
            "PurchaseBranch",
            {
                title: "PurchaseBranch",
                type: "object",
                properties: {
                    items: {
                        items: {
                            type: "object",
                        },
                        type: "array",
                    },
                },
                additionalProperties: false,
                required: ["items"],
            },
        ],
        [
            "Purchase",
            {
                title: "Purchase",
                type: "object",
                properties: {
                    purchaseId: {
                        type: "string",
                    },
                    amount: {
                        type: "string",
                    },
                    loyalty: {
                        type: "string",
                    },
                    currency: {
                        type: "string",
                    },
                    shopId: {
                        type: "string",
                    },
                    account: {
                        type: "string",
                    },
                    phone: {
                        type: "string",
                    },
                },
                additionalProperties: false,
                required: ["purchaseId", "amount", "loyalty", "currency", "shopId", "account", "phone"],
            },
        ],
        [
            "ExchangeRateRoot",
            {
                title: "ExchangeRateRoot",
                type: "object",
                properties: {
                    branches: {
                        items: {
                            type: "object",
                        },
                        type: "array",
                    },
                    signatures: {
                        items: {
                            type: "object",
                        },
                        type: "array",
                    },
                },
                additionalProperties: false,
                required: ["branches", "signatures"],
            },
        ],
        [
            "ExchangeRateBranch",
            {
                title: "ExchangeRateBranch",
                type: "object",
                properties: {
                    items: {
                        items: {
                            type: "object",
                        },
                        type: "array",
                    },
                },
                additionalProperties: false,
                required: ["items"],
            },
        ],
        [
            "ExchangeRate",
            {
                title: "ExchangeRate",
                type: "object",
                properties: {
                    symbol: {
                        type: "string",
                    },
                    rate: {
                        type: "string",
                    },
                },
                additionalProperties: false,
                required: ["symbol", "rate"],
            },
        ],
        [
            "BurnPointRoot",
            {
                title: "BurnPointRoot",
                type: "object",
                properties: {
                    branches: {
                        items: {
                            type: "object",
                        },
                        type: "array",
                    },
                    signatures: {
                        items: {
                            type: "object",
                        },
                        type: "array",
                    },
                },
                additionalProperties: false,
                required: ["branches", "signatures"],
            },
        ],
        [
            "BurnPointBranch",
            {
                title: "BurnPointBranch",
                type: "object",
                properties: {
                    items: {
                        items: {
                            type: "object",
                        },
                        type: "array",
                    },
                },
                additionalProperties: false,
                required: ["items"],
            },
        ],
        [
            "BurnPoint",
            {
                title: "ExchangeRate",
                type: "object",
                properties: {
                    type: {
                        type: "number",
                    },
                    account: {
                        type: "string",
                    },
                    amount: {
                        type: "string",
                    },
                },
                additionalProperties: false,
                required: ["type", "account", "amount"],
            },
        ],
        [
            "BranchSignature",
            {
                title: "BranchSignature",
                type: "object",
                properties: {
                    branchIndex: {
                        type: "number",
                    },
                    signature: {
                        type: "string",
                    },
                },
                additionalProperties: false,
                required: ["branchIndex", "signature"],
            },
        ],
    ]);

    /**
     * The map of validation functions created to reuse -
     * an once created validation function.
     */
    private static validators = new Map<string, Ajv.ValidateFunction>();

    /**
     * Check the validity of a JSON data.
     * @param schema_name The JSON schema name
     * @param candidate The JSON data
     * @returns `true` if the JSON is valid, otherwise throw an `Error`
     */
    public static isValidOtherwiseThrow(schema_name: string, candidate: any) {
        const validator = this.buildValidator(schema_name);
        if (this.isValid(validator, candidate)) {
            return true;
        } else if (validator.errors !== undefined && validator.errors !== null && validator.errors.length > 0) {
            if (validator.errors.length === 1) {
                throw new Error(`Validation failed: ${schema_name} - ` + validator.errors[0].message);
            } else {
                const messages = [];
                for (const error of validator.errors) messages.push(error.message);
                throw new Error(`Validation failed: ${schema_name} - ` + messages.join("\n"));
            }
        } else {
            throw new Error(`Validation failed: ${schema_name}`);
        }
    }

    /**
     * Check the validity of a JSON data.
     * @param schema_name The JSON schema name
     * @param candidate The JSON data
     * @returns `true` if the JSON is valid, otherwise `false`
     */
    public static isValidOtherwiseNoThrow(schema_name: string, candidate: any) {
        const validator = this.buildValidator(schema_name);
        return this.isValid(validator, candidate);
    }

    /**
     * Create a validation function using the schema.
     * Return it if it has already been created.
     * @param name The JSON schema name
     * @returns The function of validation
     */
    private static buildValidator(name: string): Ajv.ValidateFunction {
        let validator = JSONValidator.validators.get(name);
        if (validator === undefined) {
            const schema = JSONValidator.schemas.get(name);
            if (schema !== undefined) {
                validator = ajv.compile(schema);
                JSONValidator.validators.set(name, validator);
            } else throw new Error(`Non-existent schema accessed: ${name}`);
        }
        return validator as Ajv.ValidateFunction;
    }

    /**
     * Check the validity of a JSON data.
     * @param validator The Function to validate JSON
     * @param candidate The JSON data
     * @returns `true` if the JSON is valid, otherwise `false`
     */
    private static isValid(validator: Ajv.ValidateFunction, candidate: any) {
        return validator(candidate) === true;
    }

    public static RegExHash = /^(0x)[0-9a-f]{64}$/i;
    public static RegExSignature = /^(0x)[0-9a-f]{130}$/i;
    public static RegExAddress = /^(0x)[0-9a-f]{40}$/i;
    public static RegExNumber = /^(\+)?([0-9]+)$/;

    static verifyHash(value: string) {
        if (!JSONValidator.RegExHash.test(value)) throw new Error("The hash value is not normal.");
    }

    static verifySignature(value: string) {
        if (!JSONValidator.RegExSignature.test(value)) throw new Error("The signature value is not normal.");
    }

    static verifyAddress(value: string) {
        if (!JSONValidator.RegExAddress.test(value)) throw new Error("The address value is not normal.");
    }

    static verifyNumber(value: string) {
        if (!JSONValidator.RegExNumber.test(value)) throw new Error("The number value is not normal.");
    }
}
