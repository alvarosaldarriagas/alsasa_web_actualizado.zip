const fs = require('fs');

async function test() {
    const res = await fetch('https://admin.alsasa.co/wp-json/wp/v2/estate_property?per_page=100&_embed');
    const data = await res.json();
    
    let failed = [];

    data.forEach(item => {
        let fullText = (item.yoast_head_json?.og_description || '') + ' ' + (item.content?.rendered || '').replace(/<[^>]+>/g, ' ');
        fullText = fullText.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
        
        const countText = fullText.toLowerCase()
            .replace(/\b(?:un|una)\b/g, '1')
            .replace(/\bdos\b/g, '2')
            .replace(/\btres\b/g, '3')
            .replace(/\bcuatro\b/g, '4')
            .replace(/\bcinco\b/g, '5');

        let price = 'Consultar';
        // Allow optional dollar sign, but not starting with admon or predial. Wait, easier to search for exact phrases:
        const priceRegex = /(?:Valor|Precio|Venta|Arriendo|Inversión)[\s:\-\w]{0,15}(?:\$|COP|)?\s*([\d\.]+(?:\s*millones)?)/i;
        const pMatch = fullText.match(priceRegex);
        if (pMatch) {
            price = pMatch[1].trim();
        } else {
            const fallbackMatch = fullText.match(/(?<!admon.*)\$\s*([\d\.]{7,}(?:\s*millones)?)/i);
            if (fallbackMatch) price = fallbackMatch[1];
        }

        const areaMatch = fullText.match(/([\d\.,]+)\s*(?:MT2|Mts|m2|metros)\b/i) || fullText.match(/[ÁA]rea:\s*([\d\.,]+)/i);
        const area = areaMatch ? areaMatch[1] : '-';

        const bedsMatch = countText.match(/(\d+)\s{0,2}(?:alcobas?|habitaci[óo]n(?:es)?|habs?)/i) || countText.match(/(?:alcobas?|habitaci[óo]n(?:es)?|habs?)[\s:]*(\d+)\b/i);
        const beds = bedsMatch ? (bedsMatch[1] || bedsMatch[2]) : '-';

        let baths = '-';
        const bathsMatch = countText.match(/(\d+)\s{0,2}baños?/i) || countText.match(/baños?[\s:]*(\d+)\b/i);
        if (bathsMatch) {
             baths = bathsMatch[1] || bathsMatch[2];
        } else if (countText.includes('baño') || countText.includes('baños')) {
             baths = '1';
        }

        if (price === 'Consultar' || beds === '-' || baths === '-') {
            failed.push({
                title: item.title.rendered,
                price, beds, baths,
                textSnippet: fullText.substring(0, 200) + '...'
            });
        }
    });

    console.log(`Failed Properties: ${failed.length} out of ${data.length}`);
    failed.slice(0, 15).forEach(f => console.log(`[${f.title}] Price: ${f.price} | Beds: ${f.beds} | Baths: ${f.baths}\nTEXT: ${f.textSnippet}\n`));
}
test();
