import Navbar from "@/components/Navbar";
import { getPropertyById } from "@/lib/wp-api";
import Link from 'next/link';
import Image from 'next/image';
export async function generateMetadata({ params }) {
    const { id } = await params;
    const property = await getPropertyById(id);

    if (!property) return { title: 'Propiedad no encontrada | Alsasa Inmobiliaria' };

    return {
        title: `${property.title} | Propiedades Alsasa`,
        description: `Espectacular propiedad en ${property.location}. Precio: $${property.price}. Área: ${property.area} m², ${property.beds} habitaciones, ${property.baths} baños. Contacta a Alsasa Inmobiliaria.`,
        openGraph: {
            title: `${property.title} - ${property.action && property.action !== 'Consultar' ? property.action : 'En Venta'}`,
            description: `Propiedad disponible en ${property.location}. Conoce más destalles de esta increíble opción de ${property.area} m² por $${property.price}.`,
            url: `https://www.alsasa.co/propiedad/${id}`,
            images: property.image ? [{ url: property.image, width: 1200, height: 630, alt: property.title }] : [],
        },
        twitter: {
            card: "summary_large_image",
            title: property.title,
            description: `Inmueble en ${property.location} por $${property.price}.`,
            images: property.image ? [property.image] : [],
        }
    };
}

export default async function PropertyPage({ params }) {
    const { id } = await params;
    const property = await getPropertyById(id);

    if (!property) {
        return (
            <main style={{ backgroundColor: 'var(--background)', minHeight: '100vh' }}>
                <Navbar />
                <div style={{ padding: '10rem 2rem', textAlign: 'center' }}>
                    <h2 style={{ fontSize: '2rem', color: 'var(--primary)', margin: '1rem' }}>Propiedad no encontrada</h2>
                    <p style={{ color: 'var(--text-light)', marginBottom: '2rem' }}>Ocurrió un error o esta propiedad fue retirada.</p>
                    <Link href="/" style={{ color: 'white', backgroundColor: 'var(--secondary)', padding: '0.8rem 1.5rem', borderRadius: '6px', textDecoration: 'none', fontWeight: 'bold' }}>
                        Volver al catálogo
                    </Link>
                </div>
            </main>
        );
    }

    return (
        <main style={{ backgroundColor: 'var(--background)', minHeight: '100vh' }}>
            <Navbar />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "RealEstateListing",
                        "name": property.title,
                        "description": property.content?.replace(/<[^>]*>?/gm, '').substring(0, 160) || '',
                        "url": `https://www.alsasa.co/propiedad/${id}`,
                        "image": property.image,
                        "offers": {
                            "@type": "Offer",
                            "price": property.price.replace(/\./g, ''), // Asegurando formato numérico
                            "priceCurrency": "COP"
                        }
                    })
                }}
            />

            {/* Cabecera / Imagen Principal */}
            <div className="property-hero" style={{
                height: '65vh',
                minHeight: '400px',
                position: 'relative',
                backgroundColor: '#1a1a1a'
            }}>
                {property.image && (
                    <Image src={property.image} alt={property.title} fill style={{ objectFit: 'cover' }} priority sizes="100vw" />
                )}
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.7) 100%)',
                    zIndex: 1
                }} />

                <div style={{
                    position: 'absolute', bottom: '0', left: '0', right: '0',
                    padding: '4rem 2rem',
                    zIndex: 2
                }}>
                    <div style={{ maxWidth: '1200px', margin: '0 auto', color: 'white' }}>
                        <span style={{ backgroundColor: 'var(--secondary)', padding: '0.4rem 1rem', borderRadius: '4px', fontSize: '0.9rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>
                            {property.action && property.action !== 'Consultar' ? property.action : 'En Venta'}
                        </span>
                        <h1 className="hero-title" style={{ margin: '1rem 0', fontFamily: 'var(--font-serif)', letterSpacing: '-1px', color: 'white', textShadow: '0 4px 20px rgba(0,0,0,0.8), 0 0 40px rgba(0,0,0,0.6)' }}>
                            {property.title}
                        </h1>
                        <p style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px', opacity: '0.9' }}>
                            📍 {property.location}
                        </p>
                    </div>
                </div>
            </div>

            {/* Contenido Principal */}
            <div className="responsive-grid two-cols mobile-padding" style={{ maxWidth: '1200px', margin: '-3rem auto', display: 'grid', zIndex: 10, position: 'relative' }}>

                {/* Lado Izquierdo: Descripción */}
                <div>
                    <div className="responsive-grid two-cols-even property-stats-grid" style={{ gap: '1rem', marginBottom: '3rem', padding: '2rem', backgroundColor: 'var(--surface)', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.06)' }}>
                        <div style={{ textAlign: 'center' }}>
                            <h3 style={{ color: 'var(--text-light)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>Precio Base</h3>
                            <p style={{ color: 'var(--primary)', fontSize: '1.8rem', fontWeight: 'bold' }}>${property.price}</p>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <h3 style={{ color: 'var(--text-light)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>Área Construida</h3>
                            <p style={{ color: 'var(--text)', fontSize: '1.8rem', fontWeight: 'bold' }}>{property.area} m²</p>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <h3 style={{ color: 'var(--text-light)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>Habitaciones</h3>
                            <p style={{ color: 'var(--text)', fontSize: '1.8rem', fontWeight: 'bold' }}>{property.beds}</p>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <h3 style={{ color: 'var(--text-light)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>Baños</h3>
                            <p style={{ color: 'var(--text)', fontSize: '1.8rem', fontWeight: 'bold' }}>{property.baths}</p>
                        </div>
                    </div>

                    <h2 style={{ fontSize: '2.2rem', marginBottom: '1.5rem', color: 'var(--primary)', fontFamily: 'var(--font-serif)' }}>Acerca de este Inmueble</h2>
                    <div
                        style={{ fontSize: '1.15rem', color: 'var(--text)', lineHeight: '1.9' }}
                        dangerouslySetInnerHTML={{ __html: property.content }}
                    />
                </div>

                {/* Lado Derecho: Formulario de Contacto */}
                <div style={{ marginTop: '2rem' }}>
                    <div style={{ backgroundColor: 'var(--primary)', padding: '2.5rem 2rem', borderRadius: '12px', boxShadow: '0 20px 40px rgba(13, 71, 161, 0.15)', position: 'sticky', top: '5rem', color: 'white' }}>
                        <h3 style={{ fontSize: '1.6rem', marginBottom: '0.5rem', fontFamily: 'var(--font-serif)' }}>¿Te interesa esta propiedad?</h3>
                        <p style={{ color: 'rgba(255,255,255,0.8)', marginBottom: '2rem', fontSize: '0.95rem' }}>Deja tus datos y un agente especialista de Alsasa te contactará al instante.</p>

                        <form action="/api/leads" method="POST" style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                            <input type="hidden" name="source" value="web_property" />
                            <input type="hidden" name="lead_type" value="interes_propiedad" />
                            <input type="hidden" name="property_id" value={property.base44Id || property.id} />
                            <input type="text" name="website" tabIndex="-1" autoComplete="off" aria-hidden="true" style={{ display: 'none' }} />
                            <input type="text" name="full_name" placeholder="Nombre completo *" style={{ padding: '1.1rem', borderRadius: '6px', border: 'none', fontSize: '1rem', outline: 'none', color: '#333' }} required />
                            <input type="tel" name="phone" placeholder="Tu número de teléfono *" style={{ padding: '1.1rem', borderRadius: '6px', border: 'none', fontSize: '1rem', outline: 'none', color: '#333' }} required />
                            <input type="email" name="email" placeholder="Correo electrónico *" required style={{ padding: '1.1rem', borderRadius: '6px', border: 'none', fontSize: '1rem', outline: 'none', color: '#333' }} />
                            <label style={{ display: 'flex', gap: '0.7rem', alignItems: 'flex-start', color: 'rgba(255,255,255,0.9)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                                <input type="checkbox" name="consent" required style={{ marginTop: '0.25rem' }} />
                                Autorizo a ALSASA Inmobiliaria a tratar mis datos para responder esta solicitud.
                            </label>
                            <button type="submit" style={{ backgroundColor: 'var(--secondary)', color: 'white', padding: '1.2rem', borderRadius: '6px', fontSize: '1.1rem', fontWeight: 'bold', marginTop: '0.5rem', cursor: 'pointer', border: 'none', transition: 'transform 0.2s', boxShadow: '0 4px 10px rgba(0,0,0,0.2)' }}>
                                Enviar Consulta a Alsasa
                            </button>
                            <div style={{ fontSize: '0.85rem', textAlign: 'center', opacity: 0.9, marginTop: '0.5rem', lineHeight: '1.6' }}>
                                O escríbenos directamente a nuestro <br />
                                <a href={`https://wa.me/573134321523?text=${encodeURIComponent(`Hola equipo Alsasa, vengo de su página web y estoy interesado en el inmueble: ${property.title}. ¿Podrían darme más información?`)}`} target="_blank" rel="noopener noreferrer" style={{ color: '#fff', fontWeight: 'bold', textDecoration: 'underline' }}>WhatsApp: +57 313 432 1523</a>
                            </div>
                        </form>
                    </div>
                </div>

            </div>

            {/* Nueva Sección de Galería de Imágenes */}
            {property.gallery && property.gallery.length > 0 && (
                <section className="mobile-padding" style={{ maxWidth: '1200px', margin: '4rem auto 8rem', padding: '0 2rem' }}>
                    <h2 style={{ fontSize: '2.6rem', marginBottom: '2.5rem', color: 'var(--primary)', fontFamily: 'var(--font-serif)', textAlign: 'center' }}>Galería del Inmueble</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                        {property.gallery.map((url, index) => {
                            if (url.endsWith('.mp4') || url.endsWith('.mov')) {
                                return (
                                    <video key={index} src={url} controls style={{ width: '100%', height: '300px', objectFit: 'cover', borderRadius: '12px', boxShadow: '0 10px 20px rgba(0,0,0,0.05)' }} />
                                );
                            }
                            return (
                                <div key={index} style={{ width: '100%', height: '300px', position: 'relative', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 10px 20px rgba(0,0,0,0.05)' }}>
                                    <Image src={url} alt={`Imagen ${index + 1} de la propiedad ${property.title}`} fill style={{ objectFit: 'cover', transition: 'transform 0.3s ease', cursor: 'pointer' }} className="gallery-img" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" />
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}
        </main>
    );
}
