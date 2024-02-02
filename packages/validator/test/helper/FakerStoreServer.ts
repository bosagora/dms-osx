import * as bodyParser from "body-parser";
import cors from "cors";
import e, * as express from "express";
import * as http from "http";
import * as cron from "node-cron";

import { Signer } from "@ethersproject/abstract-signer";
import { NonceManager } from "@ethersproject/experimental";
import { Amount } from "../../src/common/Amount";
import { StorePurchase } from "../../typechain-types";
import { Deployments } from "./Deployments";

import { logger } from "../../src/common/Logger";
import { ContractUtils } from "../../src/utils/ContractUtils";

import { Block, Hash, hashFull, NewTransaction, PurchaseDetails } from "dms-store-purchase-sdk";

import { BigNumber } from "@ethersproject/bignumber";
import { AddressZero } from "@ethersproject/constants";
import { randomBytes } from "@ethersproject/random";

import fs from "fs";
import { getPurchaseId } from "./Utility";

export interface IShopData {
    shopId: string;
    name: string;
    address: string;
    privateKey: string;
}

export interface IUserData {
    idx: number;
    phone: string;
    address: string;
    privateKey: string;
    loyaltyType: number;
}

export interface IProductData {
    productId: string;
    amount: number;
    providerPercent: number;
}

export interface INewPurchaseDetails {
    productId: string;
    amount: number;
    providePercent: number;
}

export interface INewPurchaseData {
    purchaseId: string;
    timestamp: number;
    totalAmount: number;
    cashAmount: number;
    currency: string;
    shopId: string;
    userAccount: string;
    userPhone: string;
    details: INewPurchaseDetails[];
}

export interface IProducts {
    product: IProductData;
    count: number;
}

export class FakerStoreServer {
    protected _app: express.Application;
    protected _server: http.Server | null = null;
    protected _deployment: Deployments;
    private readonly port: number;
    // private readonly _worker: Worker;

    private products: IProductData[];
    private shops: IShopData[];
    private users: IUserData[];
    private sequence: bigint;
    private prev_hash: Hash;
    private prev_height: bigint;

    private ipfs: Map<string, string>;
    private ready: boolean;

    constructor(port: number | string, deployment: Deployments) {
        if (typeof port === "string") this.port = parseInt(port, 10);
        else this.port = port;
        this.ready = false;
        this._app = e();
        this._deployment = deployment;
        this.products = [];
        this.shops = [];
        this.users = [];
        this.sequence = 0n;
        this.prev_hash = Hash.Null;
        this.prev_height = 0n;
        this.ipfs = new Map<string, string>();
        // this._worker = new Worker("*/1 * * * * *", this);
    }

    private get manager(): Signer {
        return new NonceManager(this._deployment.accounts.purchaseManager);
    }

    private get contract(): StorePurchase {
        const contract = this._deployment.getContract("StorePurchase");
        if (contract !== undefined) return contract.connect(this.manager) as StorePurchase;
        else {
            logger.error("Contract is not ready yet.");
            process.exit(1);
        }
    }

    public start(): Promise<void> {
        this._app.use(bodyParser.urlencoded({ extended: false }));
        this._app.use(bodyParser.json());
        this._app.use(
            cors({
                allowedHeaders: "*",
                credentials: true,
                methods: "GET, POST",
                origin: "*",
                preflightContinue: false,
            })
        );

        this._app.get("/", [], this.getHealthStatus.bind(this));
        this._app.get("/ipfs/:cid", [], this.getBlock.bind(this));

        return new Promise<void>((resolve, reject) => {
            this._server = http.createServer(this._app);
            this._server.on("error", reject);
            this._server.listen(this.port, async () => {
                await this.onStart();
                // await this._worker.start();
                resolve();
            });
        });
    }

    private async onStart() {
        await this.loadData();
    }

    public async loadData() {
        this.users.push(...(JSON.parse(fs.readFileSync("./test/helper/data/users.json", "utf8")) as IUserData[]));
        this.shops.push(...(JSON.parse(fs.readFileSync("./test/helper/data/shops.json", "utf8")) as IShopData[]));
        this.products.push(
            ...(JSON.parse(fs.readFileSync("./test/helper/data/products.json", "utf8")) as IProductData[])
        );
        this.ready = true;
    }

    public stop(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            // await this._worker.stop();
            // await this._worker.waitForStop();
            if (this._server != null) {
                this._server.close((err?) => {
                    if (err) reject(err);
                    else resolve();
                });
            } else resolve();
        });
    }

    private async getHealthStatus(_: express.Request, res: express.Response) {
        return res.status(200).json("OK");
    }

    private async getBlock(req: express.Request, res: express.Response) {
        const cid: string = String(req.params.cid);
        const data = this.ipfs.get(cid);
        if (data !== undefined) {
            return res.status(200).send(data);
        } else {
            return res.status(400);
        }
    }

    public async onWork() {
        if (!this.ready) return;
        const txs = await this.makeTransactions(16);
        const block = Block.createBlock(this.prev_hash, this.prev_height, txs);
        const cid = this.addToIPFS(JSON.stringify(block));

        const cur_hash = hashFull(block.header);
        await this.contract.add(
            block.header.height,
            cur_hash.toString(),
            block.header.prevBlock.toString(),
            block.header.merkleRoot.toString(),
            block.header.timestamp,
            cid
        );

        this.prev_hash = cur_hash;
        this.prev_height = block.header.height;
    }

    public async storePurchaseBlock(txCount: number) {
        const txs = await this.makeTransactions(txCount);
        const block = Block.createBlock(this.prev_hash, this.prev_height, txs);
        const cid = this.addToIPFS(JSON.stringify(block));

        const cur_hash = hashFull(block.header);
        await this.contract.add(
            block.header.height,
            cur_hash.toString(),
            block.header.prevBlock.toString(),
            block.header.merkleRoot.toString(),
            block.header.timestamp,
            cid
        );

        this.prev_hash = cur_hash;
        this.prev_height = block.header.height;
    }

    private makeProductInPurchase(): IProducts[] {
        const res: IProducts[] = [];
        const count = Math.floor(Math.random() * 10 + 1);
        for (let idx = 0; idx < count; idx++) {
            const i = Math.floor(Math.random() * this.products.length);
            const l = Math.floor(Math.random() * 2 + 1);
            res.push({
                product: this.products[i],
                count: l,
            });
        }
        return res;
    }

    private async makeTransactions(count: number): Promise<NewTransaction[]> {
        const txs = [];
        for (let idx = 0; idx < count; idx++) {
            const purchaseId = getPurchaseId();
            const products = this.makeProductInPurchase();
            let totalAmount: number = 0;
            for (const elem of products) {
                totalAmount += elem.product.amount * elem.count;
            }
            const details: INewPurchaseDetails[] = products.map((m) => {
                return {
                    productId: m.product.productId,
                    amount: m.product.amount * m.count,
                    providePercent: m.product.providerPercent,
                };
            });
            const cashAmount = totalAmount;

            const userIndex = Math.floor(Math.random() * this.users.length);
            const shopIndex = Math.floor(Math.random() * this.shops.length);
            const purchase: INewPurchaseData =
                Math.random() < 0.2
                    ? {
                          purchaseId,
                          timestamp: ContractUtils.getTimeStamp(),
                          totalAmount,
                          cashAmount,
                          currency: "krw",
                          shopId: this.shops[shopIndex].shopId,
                          userAccount: AddressZero,
                          userPhone: this.users[userIndex].phone,
                          details,
                      }
                    : {
                          purchaseId,
                          timestamp: ContractUtils.getTimeStamp(),
                          totalAmount,
                          cashAmount,
                          currency: "krw",
                          shopId: this.shops[shopIndex].shopId,
                          userAccount: this.users[userIndex].address,
                          userPhone: "",
                          details,
                      };

            const purchaseDetails: PurchaseDetails[] = [];
            for (const elem of purchase.details) {
                if (elem.productId !== undefined && elem.amount !== undefined && elem.providePercent !== undefined) {
                    purchaseDetails.push(
                        new PurchaseDetails(
                            elem.productId,
                            Amount.make(String(elem.amount).trim(), 18).value,
                            BigNumber.from(Math.floor(Number(elem.providePercent) * 100))
                        )
                    );
                }
            }

            const userPhoneHash = ContractUtils.getPhoneHash(purchase.userPhone);
            const tx: NewTransaction = new NewTransaction(
                this.sequence,
                String(purchase.purchaseId).trim(),
                BigInt(purchase.timestamp),
                Amount.make(String(purchase.totalAmount).trim(), 18).value,
                Amount.make(String(purchase.cashAmount).trim(), 18).value,
                String(purchase.currency).trim(),
                String(purchase.shopId).trim(),
                purchase.userAccount,
                userPhoneHash,
                purchaseDetails,
                this._deployment.accounts.foundation.address,
                await this.manager.getAddress()
            );
            this.sequence++;
            txs.push(tx);
        }
        return txs;
    }

    private addToIPFS(data: string): string {
        const cid = Buffer.from(randomBytes(32)).toString("hex");
        this.ipfs.set(cid, data);
        return cid;
    }
}

export enum WorkerState {
    NONE = 0,
    STARTING = 2,
    RUNNING = 3,
    STOPPING = 4,
    STOPPED = 5,
}

export class Worker {
    protected task: cron.ScheduledTask | null = null;
    private readonly _storeServer: FakerStoreServer;
    protected state: WorkerState;
    protected expression: string;
    private is_working: boolean = false;

    constructor(expression: string, validator: FakerStoreServer) {
        this._storeServer = validator;
        this.expression = expression;
        this.state = WorkerState.NONE;
    }

    public async start() {
        this.state = WorkerState.STARTING;
        this.is_working = false;
        this.task = cron.schedule(this.expression, this.workTask.bind(this));
        this.state = WorkerState.RUNNING;
        await this.onStart();
    }

    public async onStart() {
        //
    }

    public async stop() {
        this.state = WorkerState.STOPPING;

        if (!this.is_working) {
            this.state = WorkerState.STOPPED;
        }

        await this.onStop();
    }

    public async onStop() {
        //
    }

    private stopTask() {
        if (this.task !== null) {
            this.task.stop();
            this.task = null;
        }
    }

    public waitForStop(timeout: number = 60000): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            const start = Math.floor(new Date().getTime() / 1000);
            const wait = () => {
                if (this.state === WorkerState.STOPPED) {
                    this.stopTask();
                    resolve(true);
                } else {
                    const now = Math.floor(new Date().getTime() / 1000);
                    if (now - start < timeout) setTimeout(wait, 10);
                    else {
                        this.stopTask();
                        resolve(false);
                    }
                }
            };
            wait();
        });
    }

    public isRunning(): boolean {
        return this.task !== null;
    }

    public isWorking(): boolean {
        return this.is_working;
    }

    private async workTask() {
        if (this.state === WorkerState.STOPPED) return;
        if (this.is_working) return;

        this.is_working = true;
        try {
            await this.work();
        } catch (error) {
            console.error(`Failed to execute a scheduler: ${error}`);
        }
        this.is_working = false;

        if (this.state === WorkerState.STOPPING) {
            this.state = WorkerState.STOPPED;
        }
    }

    protected async work() {
        await this._storeServer.onWork();
    }
}
