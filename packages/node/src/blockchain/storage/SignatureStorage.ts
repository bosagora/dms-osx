import { BlockElementType } from "../node/tasks";
import { BranchSignature } from "../types";

export class SignatureStorage {
    private proofs: Map<string, BranchSignature[]>;

    constructor() {
        this.proofs = new Map<string, BranchSignature[]>();
    }

    private makeKey(height: bigint, type: BlockElementType): string {
        return height.toString().padStart(16, "0") + "_" + type.toString().padStart(3, "0");
    }

    public save(height: bigint, type: BlockElementType, signature: BranchSignature) {
        const key = this.makeKey(height, type);
        const ph = this.proofs.get(key);
        if (ph !== undefined) {
            ph.push(signature);
        } else {
            this.proofs.set(key, [signature]);
        }
    }

    public load(height: bigint, type: BlockElementType): BranchSignature[] | undefined {
        const key = this.makeKey(height, type);
        return this.proofs.get(key);
    }
}
