import { NodeStorage } from "../../storage/NodeStorage";
import { BlockElementType } from "../node/tasks";
import { IBranchSignatureWithAccount } from "../types";

export class SignatureStorage {
    protected readonly storage: NodeStorage;

    constructor(storage: NodeStorage) {
        this.storage = storage;
    }

    public async save(height: bigint, type: BlockElementType, signature: IBranchSignatureWithAccount) {
        await this.storage.postSignature(height, type, signature.branchIndex, signature.account, signature.signature);
    }

    public async load(height: bigint, type: BlockElementType): Promise<IBranchSignatureWithAccount[]> {
        return this.storage.getSignatures(height, type);
    }
}
