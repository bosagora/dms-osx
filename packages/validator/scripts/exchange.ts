import { HTTPClient } from "../src/utils/HTTPClient";

import { parseFromString } from "dom-parser";

async function main() {
    const url = "https://www.kita.net/cmmrcInfo/ehgtGnrlzInfo/rltmEhgt.do";
    const client = new HTTPClient();
    const res = await client.get(url);
    const rates = [];
    if (res.status === 200) {
        try {
            const text: string = res.data;
            const pos0 = text.indexOf('<table class="table table-bordered text-center table-fixed">');
            if (pos0 < 0) return [];
            const text0 = text.substring(pos0);
            const pos1 = text0.indexOf("</table>");
            if (pos1 < 0) return [];
            const text1 = text0.substring(0, pos1 + 8);
            const dom = parseFromString(text1);
            if (text1 === undefined) return [];
            const tbody = dom.getElementsByTagName("tbody");
            if (tbody === undefined || tbody.length === 0) return [];

            const nodes = tbody[0].getElementsByTagName("tr");
            if (nodes === undefined || nodes.length === 0) return [];

            for (const tr of nodes) {
                const th = tr.getElementsByTagName("th");
                if (th[0].childNodes[0].childNodes[0].text !== null) {
                    const symbol = th[0].childNodes[0].childNodes[0].text.toLowerCase();
                    const td = tr.getElementsByTagName("td");
                    if (td !== undefined && td.length > 0 && td[0].childNodes[0].text !== null) {
                        const rate = Math.floor(Number(td[0].childNodes[0].text.replace(/[,_]/gi, "")) * 1000000000);
                        rates.push({ symbol, rate });
                    }
                }
            }
            console.log(rates);
            return rates;
        } catch (error) {
            return [];
        }
    } else return [];
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
