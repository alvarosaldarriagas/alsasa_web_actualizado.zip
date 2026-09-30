import wordpressArchive from "@/data/wordpress-archive.json";
import { getBase44Properties, getBase44PropertyById } from "@/lib/base44-api";

// Base44 is the sole source of the public catalog. Propagate upstream failures
// so ISR can retain its last successful page instead of restoring retired stock.
export async function getProperties() {
    return getBase44Properties();
}

export async function getPropertyById(id) {
    return getBase44PropertyById(id);
}

// The seven existing articles are archived with this deployment, including images.
export async function getPosts() {
    return wordpressArchive.posts.map(post => ({
        ...post,
        date: new Date(post.publishedAt).toLocaleDateString('es-CO', {
            year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
        }),
    }));
}
