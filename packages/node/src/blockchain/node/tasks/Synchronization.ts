import { Config } from "../../../common/Config";
import { logger } from "../../../common/Logger";
import { NodeStorage } from "../../../storage/NodeStorage";
import { ContractUtils } from "../../../utils/ContractUtils";
import { Node } from "../Node";
import { NodeTask } from "./NodeTask";

import { Client } from "ntp-time";

export class Synchronization extends NodeTask {
    private client: Client;
    private oldTime: number;

    constructor(config: Config, storage: NodeStorage, node: Node) {
        super(config, storage, node);
        this.client = new Client(this.config.setting.nptServer, 123, { timeout: 5000 });
        this.oldTime = ContractUtils.getTimeStamp();
    }

    public async work() {
        await this.dispatcher();
        const newTime = ContractUtils.getTimeStamp();
        if (newTime - this.oldTime >= this.config.setting.nptInterval) {
            const res = await this.client.syncTime();
            this.oldTime = newTime;
        }
    }
}
