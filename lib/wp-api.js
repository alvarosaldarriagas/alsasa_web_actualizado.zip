import { getBase44Properties, getBase44PropertyById } from "@/lib/base44-api";

// Helper: las imágenes físicas viven en admin.alsasa.co (SiteGround)
const fixImageUrl = (url) => url ? url.replace('https://alsasa.co/', 'https://admin.alsasa.co/').replace('http://alsasa.co/', 'https://admin.alsasa.co/').replace('https://www.alsasa.co/', 'https://admin.alsasa.co/') : url;

async function getWordPressProperties() {
    try {
        const res = await fetch('https://admin.alsasa.co/wp-json/wp/v2/estate_property?per_page=100&_embed', {
            next: { revalidate: 10 }
        });
        const data = await res.json();

        if (!Array.isArray(data)) return [];

        return data.map(item => {
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
            if (price === 'Consultar') {
                const amounts = [...fullText.matchAll(/\$\s*([\d\.]+)/g)].map(m => parseInt(m[1].replace(/\./g, ''))).filter(n => !isNaN(n));
                if (amounts.length > 0) {
                    const max = Math.max(...amounts);
                    if (max > 500000) price = max.toLocaleString('es-CO').replace(/,/g, '.');
                }
            }

            const areaMatch = fullText.match(/([\d\.,]+)\s*(?:mt2|mts|m2|metros)\b/) || fullText.match(/(?:área|area)[\s:]*([\d\.,]+)/);
            const area = areaMatch ? areaMatch[1] : '-';

            let beds = '-';
            let bedsMatch = fullText.match(/(?:alcobas?|habitaci[óo]n(?:es)?|habs?)[\s:]+(\d+)\b/);
            if (!bedsMatch) bedsMatch = fullText.match(/(\d+)\s{1,3}(?:alcobas?|habitaci[óo]n(?:es)?|habs?)\b/);
            if (bedsMatch) beds = bedsMatch[1];

            let baths = '-';
            let bathsMatch = fullText.match(/ba[ñn]os?[\s:]+(\d+)\b/);
            if (!bathsMatch) bathsMatch = fullText.match(/(\d+)\s{1,3}ba[ñn]os?\b/);
            if (bathsMatch) {
                baths = bathsMatch[1];
            } else if (fullText.match(/ba[ñn]o\b/)) {
                baths = '1';
            }

            let actionCategory = 'Consultar';
            if (item._embedded?.['wp:term']) {
                item._embedded['wp:term'].forEach(termsArray => {
                    if (Array.isArray(termsArray)) {
                        termsArray.forEach(term => {
                            if (term.taxonomy === 'property_action_category') actionCategory = term.name;
                        });
                    }
                });
            }

            let imageUrl = fixImageUrl(item.yoast_head_json?.og_image?.[0]?.url || '');
            if (!imageUrl && item._embedded?.['wp:featuredmedia']?.[0]?.source_url) {
                imageUrl = fixImageUrl(item._embedded['wp:featuredmedia'][0].source_url);
            }

            let cleanTitle = item.title.rendered.replace(/&#8211;/g, '-').replace(/&#8217;/g, "'");

            return {
                id: item.id,
                title: cleanTitle,
                link: item.link,
                image: imageUrl,
                price: price,
                area: area,
                beds: beds,
                baths: baths,
                location: 'Medellín, Antioquia',
                action: actionCategory
            };
        });
    } catch (error) {
        console.error('Error fetching WP Properties:', error);
        return [];
    }
}

async function getWordPressPropertyById(id) {
    try {
        const res = await fetch(`https://admin.alsasa.co/wp-json/wp/v2/estate_property/${id}?_embed`, {
            next: { revalidate: 10 }
        });

        if (!res.ok) return null;
        const item = await res.json();

        // FETCH GALERIA DE MEDIOS ADJUNTOS
        let galleryUrls = [];
        try {
            const mediaRes = await fetch(`https://admin.alsasa.co/wp-json/wp/v2/media?parent=${id}&per_page=30`, { next: { revalidate: 10 } });
            if (mediaRes.ok) {
                const mediaItems = await mediaRes.json();
                galleryUrls = mediaItems.map(m => fixImageUrl(m.source_url)).filter(url => url);
            }
        } catch (e) { console.error('No gallery found'); }

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
        if (price === 'Consultar') {
            const amounts = [...fullText.matchAll(/\$\s*([\d\.]+)/g)].map(m => parseInt(m[1].replace(/\./g, ''))).filter(n => !isNaN(n));
            if (amounts.length > 0) {
                const max = Math.max(...amounts);
                if (max > 500000) price = max.toLocaleString('es-CO').replace(/,/g, '.');
            }
        }

        const areaMatch = fullText.match(/([\d\.,]+)\s*(?:mt2|mts|m2|metros)\b/) || fullText.match(/(?:área|area)[\s:]*([\d\.,]+)/);
        const area = areaMatch ? areaMatch[1] : '-';

        let beds = '-';
        let bedsMatch = fullText.match(/(?:alcobas?|habitaci[óo]n(?:es)?|habs?)[\s:]+(\d+)\b/);
        if (!bedsMatch) bedsMatch = fullText.match(/(\d+)\s{1,3}(?:alcobas?|habitaci[óo]n(?:es)?|habs?)\b/);
        if (bedsMatch) beds = bedsMatch[1];

        let baths = '-';
        let bathsMatch = fullText.match(/ba[ñn]os?[\s:]+(\d+)\b/);
        if (!bathsMatch) bathsMatch = fullText.match(/(\d+)\s{1,3}ba[ñn]os?\b/);
        if (bathsMatch) {
            baths = bathsMatch[1];
        } else if (fullText.match(/ba[ñn]o\b/)) {
            baths = '1';
        }

        let actionCategory = 'Consultar';
        if (item._embedded?.['wp:term']) {
            item._embedded['wp:term'].forEach(termsArray => {
                if (Array.isArray(termsArray)) {
                    termsArray.forEach(term => {
                        if (term.taxonomy === 'property_action_category') actionCategory = term.name;
                    });
                }
            });
        }

        let imageUrl = fixImageUrl(item.yoast_head_json?.og_image?.[0]?.url || '');
        if (!imageUrl && item._embedded?.['wp:featuredmedia']?.[0]?.source_url) {
            imageUrl = fixImageUrl(item._embedded['wp:featuredmedia'][0].source_url);
        }

        let cleanTitle = item.title.rendered.replace(/&#8211;/g, '-').replace(/&#8217;/g, "'");

        return {
            id: item.id,
            title: cleanTitle,
            content: item.content.rendered,
            image: imageUrl,
            gallery: galleryUrls,
            price: price,
            area: area,
            beds: beds,
            baths: baths,
            location: 'Medellín, Antioquia',
            action: actionCategory
        };
    } catch (error) {
        console.error('Error fetching WP Property:', error);
        return null;
    }
}

export async function getProperties() {
    try {
        return await getBase44Properties();
    } catch (error) {
        console.error('Base44 inventory fallback to WordPress:', error);
        return getWordPressProperties();
    }
}

export async function getPropertyById(id) {
    try {
        return await getBase44PropertyById(id);
    } catch (error) {
        console.error('Base44 property fallback to WordPress:', error);
        return getWordPressPropertyById(id);
    }
}

export async function getPosts() {
    try {
        const res = await fetch('https://admin.alsasa.co/wp-json/wp/v2/posts?_embed&per_page=12', {
            next: { revalidate: 3600 }
        });
        const data = await res.json();

        if (!Array.isArray(data)) return [];

        return data.map(item => {
            let imageUrl = fixImageUrl(item.yoast_head_json?.og_image?.[0]?.url || '');
            if (!imageUrl && item._embedded?.['wp:featuredmedia']?.[0]?.source_url) {
                imageUrl = fixImageUrl(item._embedded['wp:featuredmedia'][0].source_url);
            }

            const dateObj = new Date(item.date);
            const formattedDate = dateObj.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });

            let cleanTitle = item.title.rendered.replace(/&#8211;/g, '-').replace(/&#8217;/g, "'").replace(/&#8220;/g, '"').replace(/&#8221;/g, '"');
            let cleanExcerpt = item.excerpt?.rendered?.replace(/<[^>]+>/g, '').replace(/&hellip;/g, '...').slice(0, 150) + '...';

            return {
                id: item.id,
                title: cleanTitle,
                excerpt: cleanExcerpt,
                content: item.content.rendered,
                image: imageUrl,
                slug: item.slug,
                date: formattedDate
            };
        });
    } catch (error) {
        console.error('Error fetching WP Posts:', error);
        return [];
    }
}
