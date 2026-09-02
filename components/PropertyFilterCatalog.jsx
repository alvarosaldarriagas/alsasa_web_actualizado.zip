'use client';

import { useState, useMemo } from 'react';
import PropertyCard from './PropertyCard';

export default function PropertyFilterCatalog({ properties }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [priceRange, setPriceRange] = useState('all');
    const [minBeds, setMinBeds] = useState('all');

    const filteredProperties = useMemo(() => {
        return properties.filter(prop => {
            // Filtro por búsqueda de texto (zona, título)
            const matchesSearch = prop.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  prop.location.toLowerCase().includes(searchTerm.toLowerCase());
            
            // Filtro por número mínimo de habitaciones
            let matchesBeds = true;
            if (minBeds !== 'all') {
                const beds = parseInt(prop.beds);
                matchesBeds = !isNaN(beds) && beds >= parseInt(minBeds);
            }

            // Filtro por rangos de precio
            let matchesPrice = true;
            if (priceRange !== 'all') {
                // Removemos puntos de mil y convertimos a número
                const priceValue = parseInt(prop.price.replace(/\./g, ''));
                if (priceRange === 'under_300') {
                    matchesPrice = priceValue < 300000000;
                } else if (priceRange === '300_500') {
                    matchesPrice = priceValue >= 300000000 && priceValue <= 500000000;
                } else if (priceRange === 'over_500') {
                    matchesPrice = priceValue > 500000000;
                }
            }

            return matchesSearch && matchesBeds && matchesPrice;
        });
    }, [properties, searchTerm, priceRange, minBeds]);

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            {/* Barra de Filtros */}
            <div className="filter-bar" style={{
                display: 'flex', gap: '1rem', flexWrap: 'wrap', 
                marginBottom: '3rem', justifyContent: 'center',
                backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.05)'
            }}>
                <input 
                    type="text" 
                    placeholder="Buscar por zona o título..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ padding: '0.8rem 1.2rem', borderRadius: '8px', border: '1px solid #e2e8f0', minWidth: '250px', flex: '1', fontSize: '1rem', outline: 'none' }}
                />
                
                <select 
                    value={priceRange} 
                    onChange={(e) => setPriceRange(e.target.value)}
                    style={{ padding: '0.8rem 1.2rem', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', backgroundColor: '#f8fafc', fontSize: '1rem', cursor: 'pointer' }}
                >
                    <option value="all">Precio: Cualquier Rango</option>
                    <option value="under_300">Menos de $300 Millones</option>
                    <option value="300_500">Entre $300M y $500M</option>
                    <option value="over_500">Más de $500 Millones</option>
                </select>

                <select 
                    value={minBeds} 
                    onChange={(e) => setMinBeds(e.target.value)}
                    style={{ padding: '0.8rem 1.2rem', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', backgroundColor: '#f8fafc', fontSize: '1rem', cursor: 'pointer' }}
                >
                    <option value="all">Habitaciones: Todas</option>
                    <option value="1">1+ Alcoba</option>
                    <option value="2">2+ Alcobas</option>
                    <option value="3">3+ Alcobas</option>
                    <option value="4">4+ Alcobas</option>
                </select>
            </div>

            {/* Grid de Resultados Dinámico */}
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '2.5rem'
            }}>
                {filteredProperties.length > 0 ? (
                    filteredProperties.map(prop => (
                        <PropertyCard key={prop.id} {...prop} />
                    ))
                ) : (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem 2rem', backgroundColor: 'white', borderRadius: '12px', color: 'var(--text-light)', border: '1px dashed #cbd5e1' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
                        <h3 style={{ fontSize: '1.4rem', marginBottom: '0.5rem', color: 'var(--text)', fontFamily: 'var(--font-serif)' }}>No se encontraron propiedades</h3>
                        <p style={{ marginBottom: '1.5rem' }}>Intenta ajustar los filtros de búsqueda para visualizar más opciones disponibles del catálogo.</p>
                        <button 
                            onClick={() => { setSearchTerm(''); setPriceRange('all'); setMinBeds('all'); }}
                            style={{ padding: '0.8rem 1.5rem', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                            Limpiar Filtros
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
