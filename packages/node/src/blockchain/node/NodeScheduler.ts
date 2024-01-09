import "@nomiclabs/hardhat-ethers";

import { Scheduler } from "../../scheduler/Scheduler";
import { Node } from "./Node";

export class NodeScheduler extends Scheduler {
    private node: Node;

    constructor(node: Node) {
        super("*/1 * * * * *");
        this.node = node;
    }

    protected async work() {
        await this.node.work();
    }
}
