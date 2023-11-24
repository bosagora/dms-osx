import { Amount } from "../src/common/Amount";
import { Config } from "../src/common/Config";
import { RelayStorage } from "../src/storage/RelayStorage";
import { ContractShopStatus } from "../src/types";
import { ContractUtils } from "../src/utils/ContractUtils";
import {
    CertifierCollection,
    CurrencyRate,
    Ledger,
    PhoneLinkCollection,
    ShopCollection,
    Token,
    ValidatorCollection,
} from "../typechain-types";
import { TestClient, TestServer } from "./helper/Utility";

import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import * as hre from "hardhat";

import * as path from "path";
import { URL } from "url";

import * as assert from "assert";
import { BigNumber, Wallet } from "ethers";

// tslint:disable-next-line:no-implicit-dependencies
import { AddressZero } from "@ethersproject/constants";

// tslint:disable-next-line:no-var-requires
const URI = require("urijs");

chai.use(solidity);

describe("Test of Server", function () {
    this.timeout(1000 * 60 * 5);
    const provider = hre.waffle.provider;
    const [
        deployer,
        foundation,
        settlements,
        fee,
        certifier,
        validator1,
        validator2,
        validator3,
        user1,
        user2,
        user3,
        relay1,
        relay2,
        relay3,
        relay4,
        relay5,
        shop1,
        shop2,
        shop3,
        shop4,
        shop5,
    ] = provider.getWallets();

    const validators = [validator1, validator2, validator3];
    const linkValidators = [validator1];
    const users = [user1, user2, user3];
    const shopWallets = [shop1, shop2, shop3, shop4, shop5];

    let validatorContract: ValidatorCollection;
    let tokenContract: Token;
    let ledgerContract: Ledger;
    let linkCollectionContract: PhoneLinkCollection;
    let currencyRateContract: CurrencyRate;
    let shopCollection: ShopCollection;
    let certifierCollection: CertifierCollection;

    const multiple = BigNumber.from(1000000000);
    const price = BigNumber.from(150).mul(multiple);

    const amount = Amount.make(20_000, 18);
    const assetAmount = Amount.make(10_000_000, 18);

    const deployToken = async () => {
        const tokenFactory = await hre.ethers.getContractFactory("Token");
        tokenContract = (await tokenFactory.connect(deployer).deploy(deployer.address, "Sample", "SAM")) as Token;
        await tokenContract.deployed();
        await tokenContract.deployTransaction.wait();
        for (const elem of validators) {
            await tokenContract.connect(deployer).transfer(elem.address, amount.value);
        }
    };

    const deployValidatorCollection = async () => {
        const validatorFactory = await hre.ethers.getContractFactory("ValidatorCollection");
        validatorContract = (await validatorFactory.connect(deployer).deploy(
            tokenContract.address,
            validators.map((m) => m.address)
        )) as ValidatorCollection;
        await validatorContract.deployed();
        await validatorContract.deployTransaction.wait();
    };

    const depositValidators = async () => {
        for (const elem of validators) {
            await tokenContract.connect(elem).approve(validatorContract.address, amount.value);
            await expect(validatorContract.connect(elem).deposit(amount.value))
                .to.emit(validatorContract, "DepositedForValidator")
                .withArgs(elem.address, amount.value, amount.value);
            const item = await validatorContract.validatorOf(elem.address);
            assert.deepStrictEqual(item.validator, elem.address);
            assert.deepStrictEqual(item.status, 1);
            assert.deepStrictEqual(item.balance, amount.value);
        }
    };

    const deployPhoneLinkCollection = async () => {
        const linkCollectionFactory = await hre.ethers.getContractFactory("PhoneLinkCollection");
        linkCollectionContract = (await linkCollectionFactory
            .connect(deployer)
            .deploy(linkValidators.map((m) => m.address))) as PhoneLinkCollection;
        await linkCollectionContract.deployed();
        await linkCollectionContract.deployTransaction.wait();
    };

    const deployCurrencyRate = async () => {
        const currencyRateFactory = await hre.ethers.getContractFactory("CurrencyRate");
        currencyRateContract = (await currencyRateFactory
            .connect(deployer)
            .deploy(validatorContract.address)) as CurrencyRate;
        await currencyRateContract.deployed();
        await currencyRateContract.deployTransaction.wait();
        await currencyRateContract.connect(validators[0]).set(await tokenContract.symbol(), price);
    };

    const deployCertifierCollection = async () => {
        const factory = await hre.ethers.getContractFactory("CertifierCollection");
        certifierCollection = (await factory.connect(deployer).deploy(certifier.address)) as CertifierCollection;
        await certifierCollection.deployed();
        await certifierCollection.deployTransaction.wait();
        await certifierCollection.connect(certifier).grantCertifier(relay1.address);
        await certifierCollection.connect(certifier).grantCertifier(relay2.address);
        await certifierCollection.connect(certifier).grantCertifier(relay3.address);
        await certifierCollection.connect(certifier).grantCertifier(relay4.address);
        await certifierCollection.connect(certifier).grantCertifier(relay5.address);
    };

    const deployShopCollection = async () => {
        const shopCollectionFactory = await hre.ethers.getContractFactory("ShopCollection");
        shopCollection = (await shopCollectionFactory
            .connect(deployer)
            .deploy(certifierCollection.address)) as ShopCollection;
        await shopCollection.deployed();
        await shopCollection.deployTransaction.wait();
    };

    const addShopData = async (shops: IShopData[]) => {
        for (const shop of shops) {
            const nonce = await shopCollection.nonceOf(shop.wallet.address);
            const signature = await ContractUtils.signShop(shop.wallet, shop.shopId, nonce);
            await shopCollection.connect(deployer).add(shop.shopId, shop.name, shop.wallet.address, signature);
        }

        for (const shop of shops) {
            const signature1 = ContractUtils.signShop(
                shop.wallet,
                shop.shopId,
                await shopCollection.nonceOf(shop.wallet.address)
            );
            await shopCollection
                .connect(certifier)
                .update(
                    shop.shopId,
                    shop.name,
                    shop.provideWaitTime,
                    shop.providePercent,
                    shop.wallet.address,
                    signature1
                );
        }

        for (const shop of shops) {
            const signature1 = ContractUtils.signShop(
                shop.wallet,
                shop.shopId,
                await shopCollection.nonceOf(shop.wallet.address)
            );
            await shopCollection
                .connect(certifier)
                .changeStatus(shop.shopId, ContractShopStatus.ACTIVE, shop.wallet.address, signature1);
        }
    };

    const prepareToken = async () => {
        for (const elem of users) {
            await tokenContract.connect(deployer).transfer(elem.address, amount.value);
        }
        await tokenContract.connect(deployer).transfer(foundation.address, assetAmount.value);
        await tokenContract.connect(foundation).approve(ledgerContract.address, assetAmount.value);
        await ledgerContract.connect(foundation).deposit(assetAmount.value);
    };

    const deployLedger = async () => {
        const ledgerFactory = await hre.ethers.getContractFactory("Ledger");
        ledgerContract = (await ledgerFactory
            .connect(deployer)
            .deploy(
                foundation.address,
                foundation.address,
                fee.address,
                certifierCollection.address,
                tokenContract.address,
                validatorContract.address,
                linkCollectionContract.address,
                currencyRateContract.address,
                shopCollection.address
            )) as Ledger;
        await ledgerContract.deployed();
        await ledgerContract.deployTransaction.wait();

        await shopCollection.connect(deployer).setLedgerAddress(ledgerContract.address);
    };

    const deployAllContract = async (shops: IShopData[]) => {
        await deployToken();
        await deployValidatorCollection();
        await depositValidators();
        await deployPhoneLinkCollection();
        await deployCurrencyRate();
        await deployCertifierCollection();
        await deployShopCollection();
        await deployLedger();
        await addShopData(shops);
        await prepareToken();
    };

    const client = new TestClient();
    let server: TestServer;
    let storage: RelayStorage;
    let serverURL: URL;
    let config: Config;

    interface IShopData {
        shopId: string;
        name: string;
        provideWaitTime: number;
        providePercent: number;
        wallet: Wallet;
    }

    const shopData: IShopData[] = [
        {
            shopId: "F000100",
            name: "Shop1",
            provideWaitTime: 0,
            providePercent: 10,
            wallet: shopWallets[0],
        },
        {
            shopId: "F000200",
            name: "Shop2",
            provideWaitTime: 0,
            providePercent: 20,
            wallet: shopWallets[1],
        },
        {
            shopId: "F000300",
            name: "Shop3",
            provideWaitTime: 0,
            providePercent: 20,
            wallet: shopWallets[2],
        },
        {
            shopId: "F000400",
            name: "Shop4",
            provideWaitTime: 0,
            providePercent: 20,
            wallet: shopWallets[3],
        },
        {
            shopId: "F000500",
            name: "Shop5",
            provideWaitTime: 0,
            providePercent: 20,
            wallet: shopWallets[4],
        },
    ];

    interface IUserData {
        phone: string;
        wallet: Wallet;
        address: string;
        privateKey: string;
    }

    const userData: IUserData[] = [
        {
            phone: "08201012341001",
            wallet: users[0],
            address: users[0].address,
            privateKey: users[0].privateKey,
        },
        {
            phone: "08201012341002",
            wallet: users[1],
            address: users[1].address,
            privateKey: users[1].privateKey,
        },
        {
            phone: "08201012341003",
            wallet: users[2],
            address: users[2].address,
            privateKey: users[2].privateKey,
        },
    ];

    interface IPurchaseData {
        purchaseId: string;
        timestamp: number;
        amount: number;
        method: number;
        currency: string;
        userIndex: number;
        shopIndex: number;
    }

    context("Test token & point relay endpoints", () => {
        before("Set Shop ID", async () => {
            for (const elem of shopData) {
                elem.shopId = ContractUtils.getShopId(elem.wallet.address);
            }
        });

        before("Deploy", async () => {
            await deployAllContract(shopData);
        });

        before("Create Config", async () => {
            config = new Config();
            config.readFromFile(path.resolve(process.cwd(), "config", "config_test.yaml"));
            config.contracts.tokenAddress = tokenContract.address;
            config.contracts.phoneLinkerAddress = linkCollectionContract.address;
            config.contracts.ledgerAddress = ledgerContract.address;
            config.contracts.shopAddress = shopCollection.address;

            config.relay.managerKeys = [
                relay1.privateKey,
                relay2.privateKey,
                relay3.privateKey,
                relay4.privateKey,
                relay5.privateKey,
            ];
        });

        before("Create TestServer", async () => {
            serverURL = new URL(`http://127.0.0.1:${config.server.port}`);
            storage = await RelayStorage.make(config.database);
            server = new TestServer(config, storage);
        });

        before("Start TestServer", async () => {
            await server.start();
        });

        after("Stop TestServer", async () => {
            await server.stop();
            await storage.dropTestDB();
        });

        context("Change loyalty type", () => {
            it("Check loyalty type - before", async () => {
                const userIndex = 0;
                const loyaltyType = await ledgerContract.loyaltyTypeOf(users[userIndex].address);
                expect(loyaltyType).to.equal(0);
            });

            it("Send loyalty type", async () => {
                const userIndex = 0;
                const nonce = await ledgerContract.nonceOf(users[userIndex].address);
                const signature = await ContractUtils.signLoyaltyType(users[userIndex], nonce);
                const uri = URI(serverURL).directory("/v1/ledger/changeToLoyaltyToken");
                const url = uri.toString();
                const response = await client.post(url, {
                    account: users[userIndex].address,
                    signature,
                });

                expect(response.data.code).to.equal(0);
                expect(response.data.data).to.not.equal(undefined);
                expect(response.data.data.txHash).to.match(/^0x[A-Fa-f0-9]{64}$/i);
            });

            it("Check point type - after", async () => {
                const userIndex = 0;
                const loyaltyType = await ledgerContract.loyaltyTypeOf(users[userIndex].address);
                expect(loyaltyType).to.equal(1);
            });
        });
    });

    context("Test token & point relay endpoints - using phone", () => {
        before("Deploy", async () => {
            await deployAllContract(shopData);
        });

        before("Create Config", async () => {
            config = new Config();
            config.readFromFile(path.resolve(process.cwd(), "config", "config_test.yaml"));
            config.contracts.tokenAddress = tokenContract.address;
            config.contracts.phoneLinkerAddress = linkCollectionContract.address;
            config.contracts.ledgerAddress = ledgerContract.address;

            config.relay.managerKeys = [
                relay1.privateKey,
                relay2.privateKey,
                relay3.privateKey,
                relay4.privateKey,
                relay5.privateKey,
            ];
        });

        before("Create TestServer", async () => {
            serverURL = new URL(`http://127.0.0.1:${config.server.port}`);
            storage = await RelayStorage.make(config.database);
            server = new TestServer(config, storage);
        });

        before("Start TestServer", async () => {
            await server.start();
        });

        after("Stop TestServer", async () => {
            await server.stop();
            await storage.dropTestDB();
        });

        context("Save Purchase Data", () => {
            const userIndex = 0;
            const purchase: IPurchaseData = {
                purchaseId: "P000001",
                timestamp: 1672844400,
                amount: 10000,
                method: 0,
                currency: "krw",
                shopIndex: 1,
                userIndex,
            };

            it("Save Purchase Data", async () => {
                const phoneHash = ContractUtils.getPhoneHash(userData[userIndex].phone);
                const userAccount = AddressZero;
                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const shop = shopData[purchase.shopIndex];
                const pointAmount = purchaseAmount.mul(shop.providePercent).div(100);
                await expect(
                    ledgerContract.connect(validators[0]).savePurchase({
                        purchaseId: purchase.purchaseId,
                        timestamp: purchase.timestamp,
                        amount: purchaseAmount,
                        currency: purchase.currency.toLowerCase(),
                        shopId: shop.shopId,
                        method: purchase.method,
                        account: userAccount,
                        phone: phoneHash,
                    })
                )
                    .to.emit(ledgerContract, "SavedPurchase")
                    .withNamedArgs({
                        purchaseId: purchase.purchaseId,
                        timestamp: purchase.timestamp,
                        amount: purchaseAmount,
                        currency: purchase.currency.toLowerCase(),
                        shopId: shop.shopId,
                        method: purchase.method,
                        account: userAccount,
                        phone: phoneHash,
                    })
                    .emit(ledgerContract, "ProvidedUnPayablePoint")
                    .withNamedArgs({
                        phone: phoneHash,
                        providedPoint: pointAmount,
                        providedValue: pointAmount,
                        balancePoint: pointAmount,
                        purchaseId: purchase.purchaseId,
                        shopId: shop.shopId,
                    });
            });

            it("Link phone and wallet address", async () => {
                const phoneHash = ContractUtils.getPhoneHash(userData[userIndex].phone);
                const nonce = await linkCollectionContract.nonceOf(userData[userIndex].address);
                const signature = await ContractUtils.signRequestHash(userData[userIndex].wallet, phoneHash, nonce);
                const requestId = ContractUtils.getRequestId(phoneHash, userData[userIndex].address, nonce);
                await expect(
                    linkCollectionContract
                        .connect(relay1)
                        .addRequest(requestId, phoneHash, userData[userIndex].address, signature)
                )
                    .to.emit(linkCollectionContract, "AddedRequestItem")
                    .withArgs(requestId, phoneHash, userData[userIndex].address);
                await linkCollectionContract.connect(linkValidators[0]).voteRequest(requestId);
                await linkCollectionContract.connect(linkValidators[0]).countVote(requestId);
            });

            it("Change to payable point", async () => {
                const phoneHash = ContractUtils.getPhoneHash(userData[userIndex].phone);
                const payableBalance = await ledgerContract.pointBalanceOf(userData[userIndex].address);
                const unPayableBalance = await ledgerContract.unPayablePointBalanceOf(phoneHash);

                const nonce = await ledgerContract.nonceOf(userData[userIndex].address);
                const signature = await ContractUtils.signChangePayablePoint(
                    userData[userIndex].wallet,
                    phoneHash,
                    nonce
                );

                const uri = URI(serverURL).directory("/v1/ledger/changeToPayablePoint");
                const url = uri.toString();
                const response = await client.post(url, {
                    phone: phoneHash,
                    account: users[userIndex].address,
                    signature,
                });

                expect(response.data.code).to.equal(0);
                expect(response.data.data).to.not.equal(undefined);
                expect(response.data.data.txHash).to.match(/^0x[A-Fa-f0-9]{64}$/i);

                expect(await ledgerContract.pointBalanceOf(userData[userIndex].address)).to.equal(
                    payableBalance.add(unPayableBalance)
                );
                expect(await ledgerContract.unPayablePointBalanceOf(phoneHash)).to.equal(0);
            });
        });
    });
});
