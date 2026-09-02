import Navbar from "@/components/Navbar";
import PropertyFilterCatalog from "@/components/PropertyFilterCatalog";
import { getProperties } from "@/lib/wp-api";

export default async function Home() {
  // Conexión real a WordPress de Alsasa
  const properties = await getProperties();

  return (
    <main>
      <Navbar />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "RealEstateAgent",
            "name": "Alsasa Inmobiliaria",
            "image": "https://alsasa-web.vercel.app/logo.png",
            "url": "https://alsasa-web.vercel.app",
            "telephone": "+573134321523",
            "address": {
              "@type": "PostalAddress",
              "addressLocality": "Medellín",
              "addressRegion": "Antioquia",
              "addressCountry": "CO"
            }
          })
        }}
      />
      <section className="home-hero" style={{ padding: '7rem 2rem', textAlign: 'center', backgroundColor: 'var(--background)' }}>
        <h1 style={{ fontSize: '3.8rem', marginBottom: '1.5rem', letterSpacing: '-1.5px', maxWidth: '800px', margin: '0 auto 1.5rem' }}>
          Juntos encontramos el hogar de tus Sueños.
        </h1>
        <p style={{ fontSize: '1.2rem', color: 'var(--text-light)', maxWidth: '600px', margin: '0 auto 2.5rem', lineHeight: '1.8' }}>
          Alsasa provee una experiencia premium y de confianza para familias que buscan propiedades excepcionales. Tu tranquilidad es nuestro compromiso.
        </p>
        <button style={{
          backgroundColor: 'var(--secondary)', color: 'white', padding: '1rem 2.5rem',
          borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', border: 'none', cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(230, 126, 34, 0.4)'
        }}>
          Explorar Propiedades
        </button>
      </section>

      <section id="propiedades" className="home-catalog" style={{ padding: '5rem 4rem', backgroundColor: 'var(--surface)' }}>
        <h2 style={{ fontSize: '2.5rem', marginBottom: '3rem', textAlign: 'center', color: 'var(--primary)' }}>Últimas Propiedades Añadidas</h2>
        {properties.length > 0 ? (
          <PropertyFilterCatalog properties={properties} />
        ) : (
          <p style={{ textAlign: 'center', color: 'var(--text-light)', padding: '3rem' }}>
            Cargando propiedades desde alsasa.co...
          </p>
        )}
      </section>

      <section id="contacto" className="home-contact" style={{ padding: '6rem 4rem', backgroundColor: 'var(--background)' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', backgroundColor: 'var(--surface)', padding: '3rem', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.05)' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <h2 style={{ fontSize: '2.5rem', color: 'var(--primary)', marginBottom: '1rem' }}>Contactar un Asesor</h2>
            <p style={{ color: 'var(--text-light)', fontSize: '1.1rem' }}>Déjanos tus datos y un especialista de Alsasa Inmobiliaria se comunicará contigo a la mayor brevedad posible.</p>
          </div>

          <form action="https://formsubmit.co/info@alsasa.co" method="POST" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <input type="hidden" name="_subject" value="Nuevo Contacto desde la Página de Inicio (Alsasa Web)" />
              <input type="hidden" name="_captcha" value="false" />
              <input type="hidden" name="_next" value="https://alsasa-web.vercel.app/" />
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
                  <input type="text" name="name" placeholder="Nombre completo *" required style={{ padding: '1.2rem', borderRadius: '8px', border: '1px solid #eaeaea', fontSize: '1rem', outline: 'none', backgroundColor: '#f9fafb' }} />
                  <input type="tel" name="phone" placeholder="Teléfono / Celular *" required style={{ padding: '1.2rem', borderRadius: '8px', border: '1px solid #eaeaea', fontSize: '1rem', outline: 'none', backgroundColor: '#f9fafb' }} />
              </div>
              
              <input type="email" name="email" placeholder="Correo electrónico" style={{ padding: '1.2rem', borderRadius: '8px', border: '1px solid #eaeaea', fontSize: '1rem', outline: 'none', backgroundColor: '#f9fafb' }} />
              
              <textarea name="message" placeholder="¿En qué te podemos ayudar? (Opcional)" rows="4" style={{ padding: '1.2rem', borderRadius: '8px', border: '1px solid #eaeaea', fontSize: '1rem', outline: 'none', backgroundColor: '#f9fafb', resize: 'vertical' }}></textarea>
              
              <button type="submit" style={{ backgroundColor: 'var(--secondary)', color: 'white', padding: '1.2rem', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', border: 'none', transition: 'transform 0.2s', boxShadow: '0 4px 14px rgba(230, 126, 34, 0.3)', marginTop: '0.5rem' }}>
                  Enviar Mensaje
              </button>
              
              <div style={{ textAlign: 'center', marginTop: '1rem', color: 'var(--text-light)', fontSize: '0.9rem' }}>
                  O háblanos directamente por <a href="https://wa.me/573134321523?text=Hola%20equipo%20Alsasa,%20necesito%20asesor%C3%ADa." target="_blank" rel="noopener noreferrer" style={{ color: '#25D366', fontWeight: 'bold', textDecoration: 'none' }}>WhatsApp</a>
              </div>
          </form>
        </div>
      </section>

      <footer className="site-footer" style={{ padding: '3rem 4rem', textAlign: 'center', borderTop: '1px solid #eaeaea', color: 'var(--text-light)', fontSize: '0.9rem' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <a href="https://www.facebook.com/alsasainmobiliaria" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontSize: '1.5rem', transition: 'color 0.3s' }} aria-label="Facebook">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
          </a>
          <a href="https://www.instagram.com/alsasainmobiliaria" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontSize: '1.5rem', transition: 'color 0.3s' }} aria-label="Instagram">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
          </a>
          <a href="https://www.tiktok.com/@alsasainmobiliaria" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontSize: '1.5rem', transition: 'color 0.3s' }} aria-label="TikTok">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
          </a>
        </div>
        <p>© {new Date().getFullYear()} Alsasa Inmobiliaria. Todos los derechos reservados.</p>
      </footer>
    </main>
  );
}
