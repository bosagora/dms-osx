import { Wallet } from "ethers";

async function main() {
    const users = [];
    for (let idx = 0; idx < 20; idx++) {
        const phone = "08201010005" + idx.toString().padStart(3, "0");
        const wallet = Wallet.createRandom();
        const loyaltyType = idx < 5 ? 0 : 1;
        users.push({
            idx,
            phone,
            address: wallet.address,
            privateKey: wallet.privateKey,
            loyaltyType,
        });
    }
    console.log(JSON.stringify(users));
}
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
