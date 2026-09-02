'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function Navbar() {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <nav className="nav-container">
            <div style={{ flex: '1', display: 'flex', justifyContent: 'flex-start' }}>
                <Link href="/">
                    {/* Logo tamaño dinámico */}
                    <img src="/logo.png" alt="Alsasa Logo" style={{ height: isOpen ? '40px' : '55px', objectFit: 'contain', transition: 'height 0.3s' }} />
                </Link>
            </div>

            <button className="hamburger" onClick={() => setIsOpen(!isOpen)}>
                {isOpen ? '✕' : '☰'}
            </button>

            <ul className={`nav-links ${isOpen ? 'open' : ''}`} style={{ listStyle: 'none', gap: '2rem', alignItems: 'center', margin: 0, paddingProps: 0 }}>
                <li><Link href="/" onClick={() => setIsOpen(false)} style={{ color: 'var(--text)', fontWeight: '500', textDecoration: 'none', fontSize: '1.1rem' }}>Inicio</Link></li>
                <li><Link href="/#propiedades" onClick={() => setIsOpen(false)} style={{ color: 'var(--text)', fontWeight: '500', textDecoration: 'none', fontSize: '1.1rem' }}>Propiedades</Link></li>
                <li><Link href="/nosotros" onClick={() => setIsOpen(false)} style={{ color: 'var(--text)', fontWeight: '500', textDecoration: 'none', fontSize: '1.1rem' }}>Nosotros</Link></li>
                <li><Link href="/blog" onClick={() => setIsOpen(false)} style={{ color: 'var(--text)', fontWeight: '500', textDecoration: 'none', fontSize: '1.1rem' }}>Blog</Link></li>

                {/* Menú Móvil - Botones extra aparecen solo cuando está abierto */}
                {isOpen && (
                    <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', alignItems: 'center' }}>
                        <a href="/#contacto" onClick={() => setIsOpen(false)} style={{ backgroundColor: 'var(--primary)', color: 'white', padding: '0.8rem 2rem', borderRadius: '4px', textDecoration: 'none', display: 'inline-block', width: '100%', textAlign: 'center' }}>
                            Agendar Asesoría
                        </a>
                        <a href="https://wa.me/573134321523?text=Hola%20equipo%20Alsasa,%20necesito%20asesor%C3%ADa." target="_blank" rel="noopener noreferrer" onClick={() => setIsOpen(false)} style={{ backgroundColor: '#25D366', color: 'white', padding: '0.8rem 2rem', borderRadius: '4px', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%' }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12.031 0C5.385 0 0 5.388 0 12.035c0 2.126.551 4.195 1.6 6.02L.034 24l6.096-1.597c1.764.954 3.754 1.458 5.804 1.458h.005c6.645 0 12.033-5.386 12.033-12.033C23.972 5.39 18.59 0 12.031 0zm.006 21.84c-1.8 0-3.567-.482-5.11-1.396l-.367-.217-3.799.996.996-3.705-.238-.378a10.02 10.02 0 01-1.534-5.275c0-5.543 4.512-10.054 10.056-10.054 5.542 0 10.055 4.51 10.055 10.054.001 5.54-4.512 10.053-10.053 10.053c0-.001-.003-.001-.006-.001V21.84z"></path><path d="M17.558 14.18c-.276-.139-1.636-.808-1.89-.901-.252-.092-.437-.139-.62.139-.185.276-.714.9-.875 1.085-.162.185-.323.208-.599.069-.276-.139-1.168-.43-2.223-1.371-.82-.731-1.374-1.635-1.536-1.912-.162-.276-.017-.426.12-.564.124-.125.276-.323.414-.485.139-.162.185-.276.276-.46.092-.185.046-.346-.023-.485-.069-.139-.62-1.498-.85-2.051-.225-.54-.452-.467-.62-.475-.162-.008-.346-.008-.531-.008a1.018 1.018 0 00-.738.346c-.252.276-.967.945-.967 2.305 0 1.36.99 2.674 1.129 2.859.139.185 1.95 2.977 4.723 4.173.66.284 1.176.454 1.579.581.662.209 1.265.179 1.741.108.534-.08 1.636-.668 1.867-1.314.23-.645.23-1.198.162-1.314-.069-.115-.253-.184-.53-.323z"></path></svg>
                            WhatsApp
                        </a>
                    </div>
                )}
            </ul>

            {/* Menú Desktop */}
            <div className="nav-actions" style={{ flex: '1', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem', display: 'flex' }}>
                <a href="https://wa.me/573134321523?text=Hola%20equipo%20Alsasa,%20necesito%20asesor%C3%ADa." target="_blank" rel="noopener noreferrer" style={{ backgroundColor: '#25D366', color: 'white', padding: '0.7rem 1.6rem', borderRadius: '4px', fontWeight: '600', textDecoration: 'none', boxShadow: '0 4px 10px rgba(37, 211, 102, 0.2)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12.031 0C5.385 0 0 5.388 0 12.035c0 2.126.551 4.195 1.6 6.02L.034 24l6.096-1.597c1.764.954 3.754 1.458 5.804 1.458h.005c6.645 0 12.033-5.386 12.033-12.033C23.972 5.39 18.59 0 12.031 0zm.006 21.84c-1.8 0-3.567-.482-5.11-1.396l-.367-.217-3.799.996.996-3.705-.238-.378a10.02 10.02 0 01-1.534-5.275c0-5.543 4.512-10.054 10.056-10.054 5.542 0 10.055 4.51 10.055 10.054.001 5.54-4.512 10.053-10.053 10.053c0-.001-.003-.001-.006-.001V21.84z"></path><path d="M17.558 14.18c-.276-.139-1.636-.808-1.89-.901-.252-.092-.437-.139-.62.139-.185.276-.714.9-.875 1.085-.162.185-.323.208-.599.069-.276-.139-1.168-.43-2.223-1.371-.82-.731-1.374-1.635-1.536-1.912-.162-.276-.017-.426.12-.564.124-.125.276-.323.414-.485.139-.162.185-.276.276-.46.092-.185.046-.346-.023-.485-.069-.139-.62-1.498-.85-2.051-.225-.54-.452-.467-.62-.475-.162-.008-.346-.008-.531-.008a1.018 1.018 0 00-.738.346c-.252.276-.967.945-.967 2.305 0 1.36.99 2.674 1.129 2.859.139.185 1.95 2.977 4.723 4.173.66.284 1.176.454 1.579.581.662.209 1.265.179 1.741.108.534-.08 1.636-.668 1.867-1.314.23-.645.23-1.198.162-1.314-.069-.115-.253-.184-.53-.323z"></path></svg>
                    WhatsApp
                </a>
                <a href="/#contacto" style={{ backgroundColor: 'var(--primary)', color: 'white', padding: '0.7rem 1.6rem', borderRadius: '4px', fontWeight: '600', textDecoration: 'none', boxShadow: '0 4px 10px rgba(13, 71, 161, 0.2)' }}>
                    Formulario
                </a>
            </div>
        </nav>
    );
}
