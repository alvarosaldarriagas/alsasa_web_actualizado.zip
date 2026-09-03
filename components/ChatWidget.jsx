'use client';
import { useState, useRef, useEffect } from 'react';

export default function ChatWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { role: 'assistant', content: '¡Hola! 🏠 Soy la IA Asesora de Alsasa Inmobiliaria. Fui entrenada para conocer todos nuestros inmuebles. ¿Qué tipo de propiedad estás buscando hoy?' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMessage = input;
        const newMessages = [...messages, { role: 'user', content: userMessage }];
        setMessages(newMessages);
        setInput('');
        setIsLoading(true);

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: newMessages })
            });
            const data = await res.json();

            setMessages([...newMessages, { role: 'assistant', content: data.reply }]);
        } catch (error) {
            setMessages([...newMessages, { role: 'assistant', content: 'Disculpa, ocurrió un error en mis circuitos. Por favor intenta de nuevo en unos minutos.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 9999 }}>
            {/* Burbuja minimizada flotante */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    style={{
                        width: '65px', height: '65px', borderRadius: '50%', backgroundColor: 'var(--primary)',
                        color: 'white', border: '5px solid white', cursor: 'pointer', boxShadow: '0 10px 30px rgba(13, 71, 161, 0.4)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem',
                        transition: 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                    🤖
                </button>
            )}

            {/* Ventana de Chat Abierta */}
            {isOpen && (
                <div style={{
                    width: '380px', height: '550px', backgroundColor: 'white', borderRadius: '20px',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column',
                    overflow: 'hidden', border: '1px solid #eaeaea',
                    animation: 'slideUp 0.3s ease-out forwards'
                }}>
                    {/* Header del Chat */}
                    <div style={{ backgroundColor: 'var(--primary)', color: 'white', padding: '1.2rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '40px', height: '40px', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                                🤖
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', fontFamily: 'var(--font-sans)', fontWeight: 'bold' }}>Alsasa AI ✨</h3>
                                <span style={{ fontSize: '0.75rem', color: '#a8c7fa', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ width: '8px', height: '8px', backgroundColor: '#4ade80', borderRadius: '50%', display: 'inline-block' }}></span>
                                    En línea (Asesor Virtual 24/7)
                                </span>
                            </div>
                        </div>
                        <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', fontSize: '2rem', cursor: 'pointer', lineHeight: '1' }}>
                            ×
                        </button>
                    </div>

                    {/* Área de Mensajes */}
                    <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto', backgroundColor: '#f9fafb', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                        {messages.map((m, i) => (
                            <div key={i} style={{
                                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                                backgroundColor: m.role === 'user' ? 'var(--secondary)' : 'white',
                                color: m.role === 'user' ? 'white' : 'var(--text)',
                                padding: '1rem 1.2rem',
                                borderRadius: m.role === 'user' ? '18px 18px 2px 18px' : '2px 18px 18px 18px',
                                maxWidth: '85%',
                                boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
                                fontSize: '0.95rem',
                                lineHeight: '1.5'
                            }}>
                                {m.content}
                            </div>
                        ))}
                        {isLoading && (
                            <div style={{ alignSelf: 'flex-start', backgroundColor: 'white', padding: '1rem 1.2rem', borderRadius: '2px 18px 18px 18px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', fontSize: '0.95rem', color: 'var(--text-light)' }}>
                                <span className="dot-typing">Pensando...</span>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Área */}
                    <form onSubmit={sendMessage} style={{ padding: '1.2rem', backgroundColor: 'white', borderTop: '1px solid #f0f0f0', display: 'flex', gap: '10px' }}>
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Escribe tu pregunta aquí..."
                            style={{ flex: 1, padding: '0.9rem 1.2rem', borderRadius: '30px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.95rem', backgroundColor: '#f8fafc', color: '#333' }}
                        />
                        <button type="submit" disabled={isLoading || !input.trim()} style={{ backgroundColor: input.trim() ? 'var(--primary)' : '#cbd5e1', color: 'white', border: 'none', width: '45px', height: '45px', borderRadius: '50%', cursor: input.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 0.2s', fontSize: '1.2rem' }}>
                            ➤
                        </button>
                    </form>
                </div>
            )}

            {/* Animación local CSS for slideUp */}
            <style dangerouslySetInnerHTML={{
                __html: `
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}} />
        </div>
    );
}
