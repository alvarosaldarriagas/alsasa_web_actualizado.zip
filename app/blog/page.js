import Navbar from "@/components/Navbar";
import { getPosts } from "@/lib/wp-api";
import Link from 'next/link';
import Image from 'next/image';
export const metadata = {
    title: 'Blog Inmobiliario | Alsasa Inmobiliaria Medellín',
    description: 'Guías, noticias del mercado inmobiliario y consejos expertos para comprar, vender o arrendar tu hogar ideal en Medellín y Antioquia.',
    keywords: ['blog inmobiliario', 'noticias bienes raíces colombia', 'consejos para comprar casa', 'mercado inmobiliario medellín'],
    openGraph: {
        title: 'Blog Inmobiliario | Alsasa Inmobiliaria Medellín',
        description: 'Guías, noticias del mercado inmobiliario y consejos expertos para comprar, vender o arrendar tu hogar ideal en Medellín y Antioquia.',
        url: 'https://www.alsasa.co/blog',
        type: 'website',
    }
};

export default async function BlogPage() {
    const posts = await getPosts();

    return (
        <main style={{ backgroundColor: 'var(--background)', minHeight: '100vh' }}>
            <Navbar />

            {/* Cabecera del Blog */}
            <section className="blog-header" style={{ padding: '6rem 2rem 4rem', textAlign: 'center', backgroundColor: 'var(--surface)', borderBottom: '1px solid #eaeaea' }}>
                <h1 style={{ fontSize: '3.5rem', marginBottom: '1rem', fontFamily: 'var(--font-serif)', color: 'var(--primary)' }}>
                    El Blog de Alsasa
                </h1>
                <p style={{ fontSize: '1.2rem', color: 'var(--text-light)', maxWidth: '600px', margin: '0 auto' }}>
                    Mantente informado con nuestras guías, noticias del mercado inmobiliario y consejos para encontrar tu hogar ideal en Medellín.
                </p>
            </section>

            {/* Grid de Artículos */}
            <section className="blog-grid-section" style={{ padding: '5rem 4rem', maxWidth: '1200px', margin: '0 auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '3rem' }}>
                    {posts.length > 0 ? posts.map(post => (
                        <article key={post.id} style={{ backgroundColor: 'var(--surface)', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', transition: 'transform 0.3s ease', display: 'flex', flexDirection: 'column' }}>
                            <Link href={`/blog/${post.slug}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', height: '100%' }}>
                                <div style={{ height: '220px', position: 'relative', backgroundColor: '#eef2f5' }}>
                                    {post.image && (
                                        <Image 
                                            src={post.image} 
                                            alt={post.title} 
                                            fill 
                                            style={{ objectFit: 'cover' }} 
                                            sizes="(max-width: 768px) 100vw, 350px"
                                        />
                                    )}
                                </div>
                                <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                                    <time style={{ fontSize: '0.85rem', color: 'var(--secondary)', fontWeight: 'bold', marginBottom: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                        {post.date}
                                    </time>
                                    <h2 style={{ fontSize: '1.4rem', color: 'var(--text)', marginBottom: '1rem', lineHeight: '1.4', fontFamily: 'var(--font-serif)' }}>
                                        {post.title}
                                    </h2>
                                    <p style={{ color: 'var(--text-light)', fontSize: '1rem', lineHeight: '1.6', marginBottom: '1.5rem', flexGrow: 1 }}>
                                        {post.excerpt}
                                    </p>
                                    <span style={{ color: 'var(--primary)', fontWeight: 'bold', fontSize: '0.95rem', alignSelf: 'flex-start', borderBottom: '2px solid var(--primary)', paddingBottom: '2px' }}>
                                        Leer el artículo completo →
                                    </span>
                                </div>
                            </Link>
                        </article>
                    )) : (
                        <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-light)', padding: '4rem 0' }}>
                            Aún no hay artículos publicados en tu Blog de Alsasa.co.
                        </p>
                    )}
                </div>
            </section>

            <footer className="site-footer" style={{ padding: '3rem 4rem', textAlign: 'center', borderTop: '1px solid #eaeaea', color: 'var(--text-light)', fontSize: '0.9rem', backgroundColor: 'var(--surface)' }}>
                <p>© {new Date().getFullYear()} Alsasa Inmobiliaria. Todos los derechos reservados.</p>
            </footer>
        </main>
    );
}
