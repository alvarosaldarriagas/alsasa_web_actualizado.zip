import { NextResponse } from 'next/server';

import { getProperties } from '@/lib/wp-api';
import { submitLeadToBase44 } from '@/lib/base44-leads';

async function getPropertiesContext() {
    try {
        const properties = await getProperties();
        
        if (!properties || properties.length === 0) return 'No hay propiedades disponibles actualmente.';

        const summaries = properties.map(item => {
            return `- **${item.title}** (ID: ${item.id})
  Precio: ${item.price !== 'Consultar' ? '$' + item.price : 'Consultar'} | Operación: ${item.action}
  Área: ${item.area} m²
  Habitaciones: ${item.beds} | Baños: ${item.baths}
  Ubicación: ${item.location}`;
        });

        return summaries.join('\n\n');
    } catch (error) {
        console.error('Error fetching properties for chatbot:', error);
        return 'No se pudieron cargar las propiedades en este momento.';
    }
}

export async function POST(req) {
    try {
        const { messages } = await req.json();

        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json({ reply: 'La clave de OpenAI no está configurada.' });
        }

        // Obtener contexto real de propiedades desde WordPress
        const propertiesContext = await getPropertiesContext();

        // Configuración del cerebro cognitivo del Asistente con datos reales
        const systemPrompt = {
            role: 'system',
            content: `Eres "Alsasa AI", el asistente virtual experto 24/7 de la agencia Alsasa Inmobiliaria en Medellín, Antioquia (Colombia).

## Tu personalidad:
- Muy cordial, profesional, empática, y orientada a ventas y servicio de alto nivel.
- Respuestas concisas (máximo 3-4 oraciones por respuesta).
- Solo si el cliente solicita ser contactado, acepta el tratamiento de datos y brinda nombre, correo y teléfono, utiliza la herramienta \`capture_lead\` para registrarlo en el CRM.

## INVENTARIO ACTUAL DE PROPIEDADES (datos reales actualizados en tiempo real):
(¡IMPORTANTE!: La lista a continuación está ordenada cronológicamente en orden descendente. Esto significa que LA PRIMERA propiedad de arriba es la más nueva o recién agregada al catálogo. NO asumas que la que está al fondo de la lista es la más nueva, esa es la más antigua).

${propertiesContext}

## Instrucciones:
- Cuando el cliente pregunte por propiedades, responde con información ESPECÍFICA del inventario anterior.
- Si el cliente quiere contacto humano, solicita **Nombre, correo, teléfono y autorización para tratar sus datos**. Usa \`capture_lead\` únicamente cuando entregue los cuatro.
- Nunca inventes propiedades que no estén en tu inventario.
- Para ver fotos, invita al cliente a navegar por el catálogo en la web.`
        };

        const tools = [
            {
                type: "function",
                function: {
                    name: "capture_lead",
                    description: "Registra en Base44 un cliente que pidió contacto y autorizó el tratamiento de sus datos.",
                    parameters: {
                        type: "object",
                        properties: {
                            name: { type: "string", description: "Nombre completo del cliente" },
                            email: { type: "string", description: "Correo electrónico del cliente" },
                            phone: { type: "string", description: "Número de teléfono del cliente" },
                            property_interest: { type: "string", description: "Nombre o detalles de la propiedad en la que el cliente mostró interés" },
                            consent: { type: "boolean", description: "Debe ser true solo si el cliente autorizó expresamente el tratamiento de datos" }
                        },
                        required: ["name", "email", "phone", "property_interest", "consent"]
                    }
                }
            }
        ];

        let payload = {
            model: "gpt-4o-mini",
            messages: [systemPrompt, ...messages],
            temperature: 0.7,
            max_tokens: 500,
            tools: tools,
            tool_choice: "auto"
        };

        let response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || 'Error en la conexión con OpenAI');
        }

        let data = await response.json();
        let message = data.choices[0].message;

        // Verificar si la IA decidió llamar a la función (Tool Calling)
        if (message.tool_calls && message.tool_calls.length > 0) {
            const toolCall = message.tool_calls[0];
            
            if (toolCall.function.name === 'capture_lead') {
                const args = JSON.parse(toolCall.function.arguments);
                console.log("Lead capturado por la IA:", args);

                const leadResult = await submitLeadToBase44({
                    full_name: args.name,
                    email: args.email,
                    phone: args.phone,
                    message: args.property_interest,
                    source: 'Alsasa AI Chatbot',
                    lead_type: 'chatbot',
                    consent: args.consent === true
                });

                if (!leadResult.success) {
                    throw new Error(leadResult.error || 'No se pudo registrar el lead en Base44');
                }

                // Generar un segundo llamado a OpenAI para confirmar al usuario que su solicitud fue enviada
                payload.messages.push(message); // Agregar la decisión de la IA al historial
                payload.messages.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: "El lead fue guardado en el CRM exitosamente. Agradécele al usuario formalmente y confirma que pronto lo llamaremos." // Mensaje oculto al sistema
                });

                // Remover 'tools' en este segundo llamado para que solo responda texto
                delete payload.tools;
                delete payload.tool_choice;

                response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
                    },
                    body: JSON.stringify(payload)
                });

                data = await response.json();
                message = data.choices[0].message;
            }
        }

        return NextResponse.json({ reply: message.content });

    } catch (error) {
        console.error('Error OpenAI AI:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

