import Navbar from "@/components/Navbar";
import { getPosts } from "@/lib/wp-api";
import Link from 'next/link';
import Image from 'next/image';

export async function generateMetadata({ params }) {
    const { slug } = await params;
    const posts = await getPosts();
    const post = posts.find(p => p.slug === slug);

    if (!post) return { title: 'Artículo no encontrado | Blog Alsasa' };

    return {
        title: `${post.title} | Blog Alsasa Inmobiliaria`,
        description: post.excerpt,
        openGraph: {
            title: post.title,
            description: post.excerpt,
            url: `https://www.alsasa.co/blog/${slug}`,
            type: 'article',
            publishedTime: post.date,
            images: post.image ? [{ url: post.image, width: 1200, height: 630, alt: post.title }] : [],
        },
        twitter: {
            card: "summary_large_image",
            title: post.title,
            description: post.excerpt,
            images: post.image ? [post.image] : [],
        }
    };
}

export default async function BlogPostPage({ params }) {
    const { slug } = await params;

    // Extraemos todos y lo filtramos (suficiente para catálogos de blogs estándar)
    const posts = await getPosts();
    const post = posts.find(p => p.slug === slug);

    if (!post) {
        return (
            <main style={{ backgroundColor: 'var(--background)', minHeight: '100vh' }}>
                <Navbar />
                <div style={{ padding: '10rem 2rem', textAlign: 'center' }}>
                    <h2 style={{ fontSize: '2rem', color: 'var(--primary)', marginBottom: '1rem' }}>Artículo no encontrado</h2>
                    <Link href="/blog" style={{ color: 'white', backgroundColor: 'var(--secondary)', padding: '0.8rem 1.5rem', borderRadius: '6px', textDecoration: 'none', fontWeight: 'bold' }}>
                        Volver al Blog
                    </Link>
                </div>
            </main>
        );
    }

    return (
        <main style={{ backgroundColor: 'var(--background)', minHeight: '100vh' }}>
            <Navbar />

            {/* Schema Markup y Cabecera */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "BlogPosting",
                        "headline": post.title,
                        "image": post.image ? [post.image] : [],
                        "author": [{
                            "@type": "Organization",
                            "name": "Alsasa Inmobiliaria",
                            "url": "https://www.alsasa.co"
                        }]
                    })
                }}
            />
            <div style={{
                height: '50vh',
                minHeight: '300px',
                position: 'relative',
                backgroundColor: '#eef2f5'
            }}>
                {post.image && (
                    <Image src={post.image} alt={post.title} fill style={{ objectFit: 'cover' }} priority sizes="100vw" />
                )}
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.8) 100%)',
                    zIndex: 1
                }} />
            </div>

            {/* Contenido del Artículo */}
            <article className="blog-article-card" style={{ maxWidth: '800px', margin: '-5rem auto 5rem', padding: '4rem 5rem', backgroundColor: 'var(--surface)', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.06)', position: 'relative', zIndex: 10 }}>

                <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                    <time style={{ fontSize: '0.9rem', color: 'var(--secondary)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
                        {post.date}
                    </time>
                    <h1 style={{ fontSize: '3rem', color: 'var(--primary)', margin: '1rem 0 2.5rem', fontFamily: 'var(--font-serif)', lineHeight: '1.2' }}>
                        {post.title}
                    </h1>
                    <div style={{ width: '60px', height: '4px', backgroundColor: 'var(--secondary)', margin: '0 auto' }} />
                </div>

                {/* Global Styles for Typography inside Blog */}
                <div className="blog-content" style={{ fontSize: '1.15rem', color: 'var(--text)', lineHeight: '1.9' }} dangerouslySetInnerHTML={{ __html: post.content }} />

                <div style={{ marginTop: '5rem', paddingTop: '2.5rem', borderTop: '1px solid #eaeaea', textAlign: 'center' }}>
                    <Link href="/blog" style={{ color: 'var(--primary)', fontWeight: 'bold', textDecoration: 'none', fontSize: '1.1rem', padding: '10px 20px', borderRadius: '4px', border: '1px solid var(--primary)' }}>
                        ← Leer más artículos
                    </Link>
                </div>
            </article>

            <footer className="site-footer" style={{ padding: '3rem 4rem', textAlign: 'center', borderTop: '1px solid #eaeaea', color: 'var(--text-light)', fontSize: '0.9rem', backgroundColor: 'var(--surface)' }}>
                <p>© {new Date().getFullYear()} Alsasa Inmobiliaria. Todos los derechos reservados.</p>
            </footer>
        </main>
    );
}
