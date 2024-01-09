import "@nomiclabs/hardhat-ethers";
import { parseFromString } from "dom-parser";
import { Config } from "../common/Config";
import { logger } from "../common/Logger";
import { NodeStorage } from "../storage/NodeStorage";
import { IExchangeRate } from "../types";
import { HTTPClient } from "../utils/HTTPClient";
import { Scheduler } from "./Scheduler";

export class CollectExchangeRateScheduler extends Scheduler {
    private multiple: bigint = 1000000000n;
    private _config: Config | undefined;
    private _storage: NodeStorage | undefined;

    constructor(expression: string) {
        super(expression);
    }

    private get config(): Config {
        if (this._config !== undefined) return this._config;
        else {
            logger.error("Config is not ready yet.");
            process.exit(1);
        }
    }

    private get storage(): NodeStorage {
        if (this._storage !== undefined) return this._storage;
        else {
            logger.error("Storage is not ready yet.");
            process.exit(1);
        }
    }

    public setOption(options: any) {
        if (options) {
            if (options.config && options.config instanceof Config) this._config = options.config;
            if (options.storage && options.storage instanceof NodeStorage) this._storage = options.storage;
        }
    }

    protected async work() {
        try {
            const rates = await this.getExchangeRateData();
            let usd = 1300n * this.multiple;
            const item = rates.find((m) => m.symbol === "usd");
            if (item !== undefined) {
                usd = item.rate;
            }
            rates.push(await this.getTokenPriceData(usd));

            await this.storage.postExchangeRate(rates);
        } catch (error) {
            logger.error(`Failed to execute the CollectExchangeRateScheduler: ${error}`);
        }
    }

    private async getExchangeRateData(): Promise<IExchangeRate[]> {
        const url = "https://www.kita.net/cmmrcInfo/ehgtGnrlzInfo/rltmEhgt.do";
        const client = new HTTPClient();
        const res = await client.get(url);
        const rates = [];
        if (res.status === 200) {
            const text: string = res.data;

            const pos0 = text.indexOf(`<table class="table table-bordered text-center table-fixed">`);
            if (pos0 < 0) throw new Error("Error, Parse Exchange Rate");
            const text0 = text.substring(pos0);
            const pos1 = text0.indexOf("</table>");
            if (pos1 < 0) throw new Error("Error, Parse Exchange Rate");
            const text1 = text0.substring(0, pos1 + 8);
            const dom = parseFromString(text1);
            if (dom === undefined) throw new Error("Error, Parse Exchange Rate");
            const tbody = dom.getElementsByTagName("tbody");
            if (tbody === undefined || tbody.length === 0) throw new Error("Error, Parse Exchange Rate");

            const nodes = tbody[0].getElementsByTagName("tr");
            if (nodes === undefined || nodes.length === 0) throw new Error("Error, Parse Exchange Rate");

            for (const tr of nodes) {
                const th = tr.getElementsByTagName("th");
                if (th[0].childNodes[0].childNodes[0].text !== null) {
                    const symbol = th[0].childNodes[0].childNodes[0].text.trim().toLowerCase();
                    const td = tr.getElementsByTagName("td");
                    if (td !== undefined && td.length > 0 && td[0].childNodes[0].text !== null) {
                        const rate =
                            (BigInt(Math.floor(Number(td[0].childNodes[0].text.trim().replace(/[,_]/gi, "")) * 10000)) *
                                this.multiple) /
                            10000n;
                        rates.push({ symbol, rate });
                    }
                }
            }
            return rates;
        } else throw new Error("Error, Load Exchange Rate");
    }

    private async getTokenPriceData(usd: bigint): Promise<IExchangeRate> {
        const url = "https://api.lbkex.com/v2/ticker.do?symbol=the9_usdt";
        const client = new HTTPClient();
        const res = await client.get(url);
        if (res.status === 200) {
            const data = res.data;
            if (data.result !== "true") throw new Error("Error, Parse Token Price");
            if (data.data.length === 0) throw new Error("Error, Can not found token symbol");
            if (data.data[0].ticker === undefined) throw new Error("Error, Can not found token symbol");

            return {
                symbol: "the9",
                rate: (BigInt(Math.floor(data.data[0].ticker.latest * 10000)) * usd) / 10000n,
            };
        } else throw new Error("Error, Load Exchange Rate");
    }
}
