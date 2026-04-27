const fs = require('fs');

async function test() {
    const res = await fetch('https://admin.alsasa.co/wp-json/wp/v2/estate_property?per_page=15');
    const data = await res.json();
    
    data.forEach(item => {
        const rawText = (item.yoast_head_json?.og_description || '') + ' ' + (item.content?.rendered || '').replace(/<[^>]+>/g, ' ');
        let fullText = rawText.toLowerCase().replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');

        const textNums = {'un ': '1 ', 'una ': '1 ', 'dos ': '2 ', 'tres ': '3 ', 'cuatro ': '4 ', 'cinco ': '5 ', 'seis ': '6 '};
        for (const [word, num] of Object.entries(textNums)) {
            fullText = fullText.replace(new RegExp(`\\b${word}`, 'g'), num);
        }
        
        let price = 'Consultar';
        const priceOpts = [
            /(?:valor|precio|venta|arriendo|inversión)[\s:\-\w]{0,20}(?:\$|cop)?\s*([\d\.]+(?:\s*millones)?)/,
            /precio[\s:\-\w]{0,10}([\d\.]+\s*millones)/,
            /\$\s*([\d\.]{7,}(?:\s*millones)?)/
        ];
        
        for (const r of priceOpts) {
            const match = fullText.match(r);
            if (match) {
                const lCtx = fullText.substring(Math.max(0, match.index - 30), match.index);
                if (!lCtx.includes('admon') && !lCtx.includes('administración') && !lCtx.includes('predial') && !lCtx.includes('anual')) {
                    price = match[1].trim();
                    break;
                }
            }
        }
        
        const areaMatch = fullText.match(/([\d\.,]+)\s*(?:mt2|mts|m2|metros)\b/) || fullText.match(/(?:área|area)[\s:]*([\d\.,]+)/);
        const area = areaMatch ? areaMatch[1] : '-';

        const bedsMatch = fullText.match(/(\d+)\s{0,3}(?:alcobas?|habitaci[óo]n(?:es)?|habs?)\b/) || fullText.match(/(?:alcobas?|habitaci[óo]n(?:es)?|habs?)[\s:]*(\d+)/);
        const beds = bedsMatch ? (bedsMatch[1] || bedsMatch[2]) : '-';

        let baths = '-';
        const bathsMatch = fullText.match(/(\d+)\s{0,3}ba[ñn]os?\b/) || fullText.match(/ba[ñn]os?[\s:]*(\d+)/);
        if (bathsMatch) {
            baths = bathsMatch[1] || bathsMatch[2];
        } else if (fullText.includes('baño') || fullText.includes('bano')) {
            baths = '1';
        }

        console.log(`[${item.title.rendered}] Price: ${price} | Beds: ${beds} | Baths: ${baths}`);
    });
}
test();
