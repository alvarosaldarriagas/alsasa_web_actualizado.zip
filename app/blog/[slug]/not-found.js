import Navbar from "@/components/Navbar";
import Link from 'next/link';

export default function ArticleNotFound() {
    return (
            <main style={{ backgroundColor: 'var(--background)', minHeight: '100vh' }}>
                <Navbar />
                <div style={{ padding: '10rem 2rem', textAlign: 'center' }}>
                    <h1 style={{ fontSize: '2rem', color: 'var(--primary)', marginBottom: '1rem' }}>Artículo no encontrado</h1>
                    <Link href="/blog" style={{ color: 'white', backgroundColor: 'var(--secondary)', padding: '0.8rem 1.5rem', borderRadius: '6px', textDecoration: 'none', fontWeight: 'bold' }}>
                        Volver al Blog
                    </Link>
                </div>
            </main>
    );
}
