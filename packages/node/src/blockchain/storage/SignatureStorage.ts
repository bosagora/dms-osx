import { NodeStorage } from "../../storage/NodeStorage";
import { BlockElementType } from "../node/tasks";
import { IBranchSignatureWithAccount } from "../types";

export class SignatureStorage {
    protected readonly storage: NodeStorage;

    constructor(storage: NodeStorage) {
        this.storage = storage;
    }

    public async save(slot: bigint, type: BlockElementType, signature: IBranchSignatureWithAccount) {
        await this.storage.postSignature(slot, type, signature.branchIndex, signature.account, signature.signature);
    }

    public async load(slot: bigint, type: BlockElementType): Promise<IBranchSignatureWithAccount[]> {
        return this.storage.getSignatures(slot, type);
    }
}
