import Link from 'next/link';

export default function PropertyCard({ id, title, location, price, beds, baths, area, image, action }) {
    return (
        <Link href={`/propiedad/${id}`} style={{ textDecoration: 'none' }}>
            <div style={styles.card}>
                <div style={{ ...styles.imagePlaceholder, backgroundImage: image ? `url(${image})` : 'none', position: 'relative' }}>
                    {!image && <span style={styles.noImageText}>🏠 Imagen No Disponible</span>}
                    {action && action !== 'Consultar' && (
                        <div style={styles.badge}>{action}</div>
                    )}
                </div>
                <div style={styles.content}>
                    <div style={styles.price}>${price}</div>
                    <h3 style={styles.title}>{title}</h3>
                    <p style={styles.location}>{location}</p>

                    <div style={styles.features}>
                        <div style={styles.feature}><span>🛏️</span> {beds} Habs</div>
                        <div style={styles.feature}><span>🛁</span> {baths} Baños</div>
                        <div style={styles.feature}><span>📐</span> {area} m²</div>
                    </div>

                    <button style={styles.button}>Ver Detalles</button>
                </div>
            </div>
        </Link>
    );
}

const styles = {
    card: {
        backgroundColor: 'var(--surface)',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
        transition: 'transform 0.3s ease, box-shadow 0.3s ease',
        cursor: 'pointer',
        border: '1px solid #f0f0f0',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
    },
    badge: {
        position: 'absolute',
        top: '12px',
        right: '12px',
        backgroundColor: 'var(--primary)',
        color: 'white',
        padding: '6px 12px',
        borderRadius: '20px',
        fontSize: '0.75rem',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        zIndex: 2,
    },
    imagePlaceholder: {
        height: '240px',
        backgroundColor: '#eef2f5',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        borderBottom: '1px solid #eaeaea',
    },
    noImageText: {
        color: '#8da0b1',
        fontFamily: 'var(--font-sans)',
        fontWeight: '500',
    },
    content: {
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        flexGrow: 1,
    },
    price: {
        color: 'var(--primary)',
        fontWeight: '700',
        fontSize: '1.4rem',
        marginBottom: '0.3rem',
    },
    title: {
        fontSize: '1.25rem',
        marginBottom: '0.3rem',
        color: 'var(--text)',
        lineHeight: '1.3',
    },
    location: {
        color: 'var(--text-light)',
        fontSize: '0.9rem',
        marginBottom: '1.2rem',
    },
    features: {
        display: 'flex',
        justifyContent: 'space-between',
        borderTop: '1px solid #f0f0f0',
        borderBottom: '1px solid #f0f0f0',
        padding: '0.8rem 0',
        marginBottom: '1.2rem',
        marginTop: 'auto',
    },
    feature: {
        fontSize: '0.85rem',
        color: 'var(--text-light)',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontWeight: '500',
    },
    button: {
        width: '100%',
        padding: '0.8rem',
        backgroundColor: 'var(--secondary)',
        color: 'white',
        borderRadius: '6px',
        fontWeight: '600',
        border: 'none',
        cursor: 'pointer',
    }
};
