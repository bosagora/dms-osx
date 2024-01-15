import { Client } from "ntp-time";

async function main() {
    const client = new Client("kr.pool.ntp.org", 123, { timeout: 5000 });
    const res = await client.syncTime();
    console.log(res);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
