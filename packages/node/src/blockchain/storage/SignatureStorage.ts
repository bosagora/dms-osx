import { BlockElementType } from "../node/tasks";
import { BranchSignatureWithAccount } from "../types";

export class SignatureStorage {
    private proofs: Map<string, BranchSignatureWithAccount[]>;

    constructor() {
        this.proofs = new Map<string, BranchSignatureWithAccount[]>();
    }

    private makeKey(height: bigint, type: BlockElementType): string {
        return height.toString().padStart(16, "0") + "_" + type.toString().padStart(3, "0");
    }

    public save(height: bigint, type: BlockElementType, signature: BranchSignatureWithAccount) {
        const key = this.makeKey(height, type);
        const signatures = this.proofs.get(key);
        signature.account = signature.account.toLowerCase();
        if (signatures !== undefined) {
            const idx = signatures.findIndex(
                (m) => m.account === signature.account && m.branchIndex === signature.branchIndex
            );
            if (idx >= 0) signatures[idx] = signature;
            else signatures.push(signature);
        } else {
            this.proofs.set(key, [signature]);
        }
    }

    public load(height: bigint, type: BlockElementType): BranchSignatureWithAccount[] | undefined {
        const key = this.makeKey(height, type);
        return this.proofs.get(key);
    }
}
