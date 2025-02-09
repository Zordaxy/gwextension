import { Storage } from './storage';
import { Settings } from './settings';
import { Ordinal } from '../data/ordinal';
import { Http } from './http';

export const Parse = {
    parseMinAdvPrice(div, itemId) {
        let rawElems = div.querySelectorAll('table')[0].querySelectorAll('tr');

        let elems = [].filter.call(rawElems, elem => {
            const tds = elem.querySelectorAll('td')
            return [].filter.call(tds, element => {
                return element.textContent.trim() === "[G]";
            })
        });

        let item = Ordinal.get(itemId);
        let results = [];

        if (!item) return null;

        let durability = item.durability;

        elems.forEach((tr) => {
            const td = [...tr.querySelectorAll('td')];
            let dur = td[1]?.textContent;
            let island = td[3]?.textContent?.slice(1, 2);
            let price = td[0]?.textContent?.replace(/[\$\,]/g, '') | 0;
            let seller = td[4]?.textContent?.slice(0, td[4]?.textContent?.indexOf(" ["));
            const isIndirectSell = td[4]?.textContent?.indexOf("написать") > 0;

            if (!isIndirectSell && dur === (durability + "/" + durability) && island === 'G' && price) {
                results.push({ price, seller });
            }
        });
        results?.sort((a, b) => a?.price < b?.price);

        return results?.[0];
    },

    parseMinShopPrice(div, cost) {
        let result = { difference: '-' };
        if (div.getElementsByTagName('li')[2]) {
            result.minPrice = +div.getElementsByTagName('li')[2].getElementsByTagName('b')[0].textContent.slice(0, -1).replace(',', '');
            result.seller = div.getElementsByTagName('li')[2].getElementsByTagName('b')[1]?.textContent;

            if (cost) {
                result.difference = +result.minPrice - cost;
            }
            result.title = div.getElementsByTagName('li')[0].parentNode.getElementsByTagName('a')[0]?.textContent;

            if (!result.seller) console.log(`Cannot parse seller for ${result.title}`);
        } else {
            result.title = div.querySelector(".wb b a[href]")?.textContent;
            if (!result.title) console.log(`Cannot parse title for item`);
        }
        return result;
    },

    /**
     * 
     * @param {*} resourceId 
     * @param {*} island 
     * @returns {
     *      title,
     *      Z: {
     *          minPrice: string
     *          seller: string,
     *          isNoOffers: boolean
     *      },
     *      G: {
     *          minPrice: string
     *          seller: string,
     *          isNoOffers: boolean
     *      }
     * 
     * }
     */
    async parseShopsPrice(resourceId) {
        const result = {
            Z: {},
            G: {}
        }
        const response = await Http.fetchGet(`/statlist.php?r=${resourceId}&type=i`)

        result.title = response.querySelector('center table a b').innerText;
        const listSelector = response.querySelectorAll('center table table tr');
        const list = [...listSelector];
        // Remove table header
        list?.shift();

        const gList = list.filter((tr) => {
            const shopIsland = tr.querySelector("a").innerText.substring(1, 2);
            return shopIsland === "G";
        });
        result.G = this._aggregateShopRows(gList);

        const zList = list.filter((tr) => {
            const shopIsland = tr.querySelector("a").innerText.substring(1, 2);
            return shopIsland === "Z";
        });
        result.Z = this._aggregateShopRows(zList);


        return result;
    },

    _aggregateShopRows(rows) {
        const minPriceElement = rows.find((tr) => {
            const owner = tr.querySelector("b").innerText;
            const price = tr.querySelectorAll("td")[2].innerText.trim().substring(1);
            if (!owner || !price) {
                console.log("[Parsing error] - specific shop data is missing");
                return false;
            }

            if (owner === "Michegan") {
                return false;
            }
            return true;
        });
        const minPrice = minPriceElement?.querySelectorAll("td")[2].innerText.trim().substring(1);
        const seller = minPriceElement?.querySelector("b").innerText;

        return {
            minPrice,
            seller,
            isNoOffers: !minPrice
        }
    },

    async parseSellersPrice(resourceId, island) {
        const response = await Http.fetchGet(`/market.php?buy=1&item_id=${resourceId}`);

        const gosShopRawPrice = response.querySelector('table [class="greengraybg"] div b')?.innerText;
        if (!gosShopRawPrice) {
            console.log('[Parsing errors] - cannot parse gos price');
            return;
        }

        const gosShopPrice = gosShopRawPrice.substring(0, gosShopRawPrice.length - 1).split(',').join('');
        return +gosShopPrice;
    },

    parseResPrice(div, itemId) {
        let prices = [];
        let trs = div.querySelector("a[href='/stats.php']").parentNode.querySelector("table td").nextElementSibling.getElementsByTagName("tr");
        for (let i = 0; i < trs.length; i++) {
            if (trs[i].children[2]) {
                let price = +trs[i].children[2].textContent.slice(2, -1);
                if (price) {
                    prices.push(price);
                }
            }
        }
        return prices.length ? (Math.min.apply(Math, prices) - Storage.getCost(itemId)) : "-";
    },
}