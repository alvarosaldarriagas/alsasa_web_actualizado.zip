import Navbar from "@/components/Navbar";
import Link from 'next/link';
import Image from 'next/image';

export const metadata = {
    title: 'Sobre Nosotros | Alsasa Inmobiliaria Medellín',
    description: 'Conoce la historia, valores y el equipo detrás de Alsasa Inmobiliaria. Más de 10 años de experiencia asesorando inversiones en bienes raíces en Colombia.',
    keywords: ['nosotros alsasa', 'agencia inmobiliaria medellin', 'historia alsasa', 'asesores bienes raíces antioquia'],
    openGraph: {
        title: 'Sobre Nosotros | Alsasa Inmobiliaria Medellín',
        description: 'Conoce la historia, valores y el equipo detrás de Alsasa Inmobiliaria.',
        url: 'https://www.alsasa.co/nosotros',
        type: 'website',
    }
};

export default function AboutPage() {
    return (
        <main style={{ backgroundColor: 'var(--background)', minHeight: '100vh', overflowX: 'hidden' }}>
            <Navbar />

            {/* Hero Section */}
            <section className="about-hero" style={{
                padding: '8rem 2rem',
                textAlign: 'center',
                backgroundColor: 'var(--primary)',
                color: 'white',
                backgroundImage: 'linear-gradient(rgba(13, 71, 161, 0.85), rgba(13, 71, 161, 0.95)), url("https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80")',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundAttachment: 'fixed'
            }}>
                <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                    <span style={{ display: 'inline-block', backgroundColor: 'var(--secondary)', color: 'white', padding: '0.4rem 1.2rem', borderRadius: '30px', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '1.5rem', textTransform: 'uppercase', letterSpacing: '2px' }}>
                        Nuestra Historia
                    </span>
                    <h1 style={{ fontSize: '4.5rem', marginBottom: '1.5rem', fontFamily: 'var(--font-serif)', letterSpacing: '-1px', textShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
                        Alsasa Inmobiliaria
                    </h1>
                    <p style={{ fontSize: '1.3rem', color: 'rgba(255, 255, 255, 0.9)', lineHeight: '1.8', fontWeight: '400' }}>
                        No solo vendemos propiedades; construimos confianzas y acompañamos a las familias en la búsqueda del lugar ideal para llamar hogar.
                    </p>
                </div>
            </section>

            {/* Main Content */}
            <section className="about-content-section" style={{ padding: '8rem 4rem', maxWidth: '1200px', margin: '0 auto' }}>
                <div className="about-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '6rem', alignItems: 'center' }}>

                    <div style={{ position: 'relative' }}>
                        <div className="about-image-container" style={{ width: '100%', height: '550px', backgroundColor: '#eef2f5', borderRadius: '12px', position: 'relative', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
                            <Image src="https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80" alt="Equipo Alsasa Inmobiliaria" fill style={{ objectFit: 'cover' }} sizes="(max-width: 768px) 100vw, 50vw" priority />
                        </div>
                        {/* Pequeña tarjeta flotante estilo Trust */}
                        <div className="about-floating-card" style={{ position: 'absolute', bottom: '-2rem', right: '-2rem', backgroundColor: 'white', padding: '2rem 2.5rem', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', flexShrink: 0 }}>
                            <h3 style={{ fontSize: '3rem', color: 'var(--secondary)', fontFamily: 'var(--font-serif)', margin: '0 0 0.2rem 0', lineHeight: 1 }}>10+</h3>
                            <p style={{ color: 'var(--text-light)', fontSize: '1rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>Años de Confianza</p>
                        </div>
                    </div>

                    <div>
                        <span style={{ color: 'var(--secondary)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '2px', fontSize: '0.95rem' }}>
                            Quiénes Somos
                        </span>
                        <h2 style={{ fontSize: '3.2rem', color: 'var(--primary)', margin: '1rem 0 2rem', fontFamily: 'var(--font-serif)', lineHeight: '1.1', letterSpacing: '-1px' }}>
                            Dedicación, Ética y Excelencia.
                        </h2>
                        <div style={{ fontSize: '1.15rem', color: 'var(--text)', lineHeight: '1.9' }}>
                            <p style={{ marginBottom: '1.5rem' }}>
                                Alsasa Inmobiliaria nace con la profunda convicción de que el mercado de bienes raíces necesitaba un enfoque más humano, ético y sumamente personalizado. Durante años hemos sido el faro que guía a inversionistas y familias.
                            </p>
                            <p>
                                Nos especializamos en brindar asesoría integral, abarcando no solo la transacción comercial, sino garantizando una transición fluida y 100% segura en uno de los momentos económicos más importantes en la vida de nuestros clientes. Tu tranquilidad es nuestro mayor activo.
                            </p>
                        </div>
                    </div>

                </div>
            </section>

            {/* Valores */}
            <section className="about-values-section" style={{ backgroundColor: 'var(--surface)', padding: '7rem 4rem', position: 'relative' }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
                    <h2 style={{ fontSize: '2.8rem', color: 'var(--primary)', marginBottom: '5rem', fontFamily: 'var(--font-serif)', letterSpacing: '-0.5px' }}>Nuestros Pilares</h2>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '3rem' }}>

                        <div style={{ padding: '3.5rem 2rem', backgroundColor: 'var(--background)', borderRadius: '12px', transition: 'transform 0.3s ease, box-shadow 0.3s ease', cursor: 'default' }}>
                            <div style={{ width: '70px', height: '70px', backgroundColor: 'rgba(230, 126, 34, 0.1)', color: 'var(--secondary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', fontSize: '1.8rem' }}>
                                🤝
                            </div>
                            <h3 style={{ fontSize: '1.4rem', color: 'var(--primary)', marginBottom: '1rem', fontFamily: 'var(--font-serif)' }}>Confianza Absoluta</h3>
                            <p style={{ color: 'var(--text-light)', lineHeight: '1.7' }}>Transparencia total en cada contrato y proceso legal. Trabajamos protegiendo siempre tus intereses económicos y patrimoniales.</p>
                        </div>

                        <div style={{ padding: '3.5rem 2rem', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 20px 40px rgba(0,0,0,0.06)', position: 'relative', top: '-1rem' }}>
                            <div style={{ width: '70px', height: '70px', backgroundColor: 'var(--secondary)', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', fontSize: '1.8rem', boxShadow: '0 10px 20px rgba(230, 126, 34, 0.3)' }}>
                                💎
                            </div>
                            <h3 style={{ fontSize: '1.4rem', color: 'var(--primary)', marginBottom: '1rem', fontFamily: 'var(--font-serif)' }}>Experiencia Premium</h3>
                            <p style={{ color: 'var(--text)', lineHeight: '1.7' }}>Un acompañamiento VIP y personalizado de inicio a fin. Elevamos el estándar de servicio tradicional en la industria inmobiliaria.</p>
                        </div>

                        <div style={{ padding: '3.5rem 2rem', backgroundColor: 'var(--background)', borderRadius: '12px', transition: 'transform 0.3s ease, box-shadow 0.3s ease' }}>
                            <div style={{ width: '70px', height: '70px', backgroundColor: 'rgba(230, 126, 34, 0.1)', color: 'var(--secondary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', fontSize: '1.8rem' }}>
                                📍
                            </div>
                            <h3 style={{ fontSize: '1.4rem', color: 'var(--primary)', marginBottom: '1rem', fontFamily: 'var(--font-serif)' }}>Conocimiento Local</h3>
                            <p style={{ color: 'var(--text-light)', lineHeight: '1.7' }}>Expertos absolutos en el mercado inmobiliario colombiano. Detectamos las mejores valorizaciones para asegurar tu inversión.</p>
                        </div>

                    </div>
                </div>
            </section>

            {/* Call to action */}
            <section className="about-cta-section" style={{ backgroundColor: 'var(--primary)', color: 'white', padding: '7rem 2rem', textAlign: 'center', backgroundImage: 'radial-gradient(circle at center, #1565C0 0%, #0D47A1 100%)' }}>
                <h2 style={{ fontSize: '3.2rem', fontFamily: 'var(--font-serif)', marginBottom: '1.5rem', letterSpacing: '-1px' }}>¿Listo para el siguiente paso?</h2>
                <p style={{ fontSize: '1.25rem', opacity: 0.9, maxWidth: '650px', margin: '0 auto 3rem', lineHeight: '1.7' }}>
                    Ya sea que busques comprar tu primera casa patrimonial, un apartamento de lujo o un poderoso local comercial, Alsasa es tu aliado estratégico.
                </p>
                <Link href="/" style={{ backgroundColor: 'white', color: 'var(--primary)', padding: '1.2rem 3.5rem', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', textDecoration: 'none', display: 'inline-block', boxShadow: '0 10px 30px rgba(0,0,0,0.3)', transition: 'transform 0.2s', letterSpacing: '0.5px' }}>
                    Consultar con un Agente
                </Link>
            </section>

            <footer className="site-footer" style={{ padding: '3rem 4rem', textAlign: 'center', color: 'var(--text-light)', fontSize: '0.95rem', backgroundColor: 'var(--surface)' }}>
                <p>© {new Date().getFullYear()} Alsasa Inmobiliaria. Todos los derechos reservados.</p>
            </footer>
        </main>
    );
}
