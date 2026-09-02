'use client';
import { useState } from 'react';

export default function UploadPage() {
    const [status, setStatus] = useState("Esperando...");

    const uploadFile = async (e) => {
        setStatus("Subiendo mágico...");
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const resp = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            if (resp.ok) {
                setStatus("¡Completado! Redirigiendo...");
                setTimeout(() => {
                    window.location.href = '/';
                }, 1500);
            } else {
                setStatus("Hubo un error al subir el archivo.");
            }
        } catch (e) {
            setStatus("Error de conexión.");
        }
    }

    return (
        <div style={{ padding: '5rem', textAlign: 'center', fontFamily: 'var(--font-sans)', minHeight: '100vh', backgroundColor: 'var(--background)' }}>
            <h1 style={{ color: 'var(--primary)', marginBottom: '1rem', fontFamily: 'var(--font-serif)' }}>Módulo de Asistencia</h1>
            <p style={{ fontSize: '1.2rem', color: 'var(--text-light)', maxWidth: '600px', margin: '0 auto 2rem' }}>
                Como fue complicado encontrar la carpeta interna del código, te he programado esta herramienta rápida.
            </p>

            <div style={{ backgroundColor: 'white', padding: '3rem', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', display: 'inline-block' }}>
                <h3 style={{ marginBottom: '1rem' }}>Sube la imagen de tu Logo aquí:</h3>
                <input
                    type="file"
                    accept="image/*"
                    onChange={uploadFile}
                    style={{
                        marginTop: '1rem',
                        padding: '1rem',
                        border: '2px dashed #ccc',
                        borderRadius: '8px',
                        width: '100%',
                        cursor: 'pointer'
                    }}
                />
                <p style={{ marginTop: '1.5rem', fontWeight: 'bold', color: 'var(--secondary)' }}>Estado: {status}</p>
            </div>
        </div>
    );
}
