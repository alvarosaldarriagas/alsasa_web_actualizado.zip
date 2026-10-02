import Navbar from '@/components/Navbar';
import Link from 'next/link';

export default function PropertyNotFound() {
    return (
        <main style={{ backgroundColor: 'var(--background)', minHeight: '100vh' }}>
            <Navbar />
            <div style={{ padding: '10rem 2rem', textAlign: 'center' }}>
                <h1 style={{ fontSize: '2rem', color: 'var(--primary)', margin: '1rem' }}>Propiedad no disponible</h1>
                <p style={{ color: 'var(--text-light)', marginBottom: '2rem' }}>Esta propiedad fue retirada o el enlace no corresponde a una propiedad disponible.</p>
                <Link href="/#propiedades" style={{ color: 'white', backgroundColor: 'var(--secondary)', padding: '0.8rem 1.5rem', borderRadius: '6px', textDecoration: 'none', fontWeight: 'bold' }}>
                    Volver al catálogo
                </Link>
            </div>
        </main>
    );
}
