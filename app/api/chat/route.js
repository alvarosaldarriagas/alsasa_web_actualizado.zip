import { protectRequest } from '@/lib/turnstile-guard.mjs';
import { NextResponse } from 'next/server';

import { getProperties } from '@/lib/wp-api';
import { submitLeadToBase44 } from '@/lib/base44-leads';

export const runtime = 'nodejs';

const MAX_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_CONVERSATION_LENGTH = 8000;

function sanitizeMessages(input) {
    if (!Array.isArray(input) || input.length === 0 || input.length > MAX_MESSAGES) {
        return null;
    }

    const messages = input.map((message) => ({
        role: message?.role === 'assistant' ? 'assistant' : 'user',
        content: typeof message?.content === 'string' ? message.content.trim() : ''
    }));

    if (
        messages.some(
            (message) =>
                !message.content ||
                message.content.length > MAX_MESSAGE_LENGTH
        )
    ) {
        return null;
    }

    const totalLength = messages.reduce(
        (total, message) => total + message.content.length,
        0
    );
    return totalLength <= MAX_CONVERSATION_LENGTH ? messages : null;
}

function normalizeText(value = '') {
    return String(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function resolveProperty(properties, reference = '') {
    const rawReference = String(reference || '').trim();
    const normalizedReference = normalizeText(rawReference);
    if (!normalizedReference) return null;

    const codeMatch = rawReference.match(/\b[A-Z]{1,5}[-:]?\d{2,}\b/i);
    const normalizedCode = codeMatch
        ? normalizeText(codeMatch[0]).replace(/\s+/g, '')
        : '';

    const exactMatch = properties.find((item) => {
        const identifiers = [item.id, item.customId, item.base44Id]
            .filter(Boolean)
            .map((value) => normalizeText(value).replace(/\s+/g, ''));

        return (
            identifiers.includes(normalizedReference.replace(/\s+/g, '')) ||
            (normalizedCode && identifiers.includes(normalizedCode))
        );
    });
    if (exactMatch) return exactMatch;

    const titleMatches = properties.filter((item) => {
        const title = normalizeText(item.title);
        return (
            title &&
            (normalizedReference.includes(title) || title.includes(normalizedReference))
        );
    });

    return titleMatches.length === 1 ? titleMatches[0] : null;
}

function getPropertiesContext(properties) {
    if (!properties || properties.length === 0) {
        return 'No hay propiedades disponibles actualmente.';
    }

    return properties
        .map((item) => {
            return `- **${item.title}** (Código comercial: ${item.id})
  Precio: ${item.price !== 'Consultar' ? '$' + item.price : 'Consultar'} | Operación: ${item.action}
  Área: ${item.area} m²
  Habitaciones: ${item.beds} | Baños: ${item.baths}
  Ubicación: ${item.location}`;
        })
        .join('\n\n');
}

export async function POST(req) {
  return protectRequest(req, 'chat', async (body, context) => {
    try {
        const messages = sanitizeMessages(body.messages);
        if (!messages) {
            return NextResponse.json({ error: 'Conversación inválida.' }, { status: 400 });
        }

        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json({ error: 'El asesor está temporalmente indisponible.' }, { status: 503 });
        }

        const properties = await getProperties();
        const propertiesContext = getPropertiesContext(properties);

        const systemPrompt = {
            role: 'system',
            content: `Eres "Alsasa AI", el asistente virtual experto 24/7 de la agencia Alsasa Inmobiliaria en Medellín, Antioquia (Colombia).

## Tu personalidad:
- Muy cordial, profesional, empática, y orientada a ventas y servicio de alto nivel.
- Respuestas concisas (máximo 3-4 oraciones por respuesta).
- Solo si el cliente solicita ser contactado, acepta el tratamiento de datos y brinda nombre, correo y teléfono, utiliza la herramienta \`capture_lead\` para registrarlo en el CRM.

## INVENTARIO ACTUAL DE PROPIEDADES (datos reales actualizados en tiempo real):
(¡IMPORTANTE!: La lista a continuación está ordenada cronológicamente en orden descendente. La primera propiedad es la más nueva).

${propertiesContext}

## Instrucciones:
- Cuando el cliente pregunte por propiedades, responde con información ESPECÍFICA del inventario anterior.
- Si el cliente quiere contacto humano, solicita **Nombre, correo, teléfono y autorización para tratar sus datos**. Usa \`capture_lead\` únicamente cuando entregue los cuatro.
- Al usar \`capture_lead\`, envía en \`property_reference\` el código comercial exacto del inventario, por ejemplo A1160.
- Nunca inventes propiedades que no estén en tu inventario.
- Nunca menciones identificadores internos del CRM.
- Para ver fotos, invita al cliente a navegar por el catálogo en la web.`
        };

        const tools = [
            {
                type: 'function',
                function: {
                    name: 'capture_lead',
                    description: 'Registra en Base44 un cliente que pidió contacto y autorizó el tratamiento de sus datos.',
                    parameters: {
                        type: 'object',
                        properties: {
                            name: { type: 'string', description: 'Nombre completo del cliente' },
                            email: { type: 'string', description: 'Correo electrónico del cliente' },
                            phone: { type: 'string', description: 'Número de teléfono del cliente' },
                            property_reference: { type: 'string', description: 'Código comercial exacto de la propiedad, por ejemplo A1160' },
                            property_interest: { type: 'string', description: 'Nombre o detalles de la propiedad en la que el cliente mostró interés' },
                            consent: { type: 'boolean', description: 'Debe ser true solo si el cliente autorizó expresamente el tratamiento de datos' }
                        },
                        required: ['name', 'email', 'phone', 'property_reference', 'property_interest', 'consent']
                    }
                }
            }
        ];

        const payload = {
            model: 'gpt-4o-mini',
            messages: [systemPrompt, ...messages],
            temperature: 0.7,
            max_tokens: 500,
            tools,
            tool_choice: 'auto'
        };

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            signal: AbortSignal.timeout(20000),
            redirect: 'error',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || 'Error en la conexión con OpenAI');
        }

        const data = await response.json();
        const message = data.choices[0].message;

        if (message.tool_calls && message.tool_calls.length > 0) {
            const toolCall = message.tool_calls[0];

            if (toolCall.function.name === 'capture_lead') {
                if (body.contactConsent !== true) return NextResponse.json({ reply: 'Para solicitar que un asesor te contacte, marca la autorización de tratamiento de datos debajo del chat.' });
                const args = JSON.parse(toolCall.function.arguments);
                const matchedProperty = resolveProperty(
                    properties,
                    `${args.property_reference || ''} ${args.property_interest || ''}`
                );

                if (!matchedProperty?.base44Id) {
                    return NextResponse.json({
                        reply: 'Antes de registrar tu solicitud necesito confirmar la propiedad. Por favor indícame su código comercial exacto, por ejemplo A1160.'
                    });
                }

                const leadResult = await submitLeadToBase44({
                    full_name: args.name,
                    email: args.email,
                    phone: args.phone,
                    message: args.property_interest,
                    source: 'Alsasa AI Chatbot',
                    lead_type: 'chatbot',
                    property_id: matchedProperty.base44Id,
                    consent: body.contactConsent === true && args.consent === true,
                    messages
                }, context);

                if (!leadResult.success) {
                    throw new Error(leadResult.error || 'No se pudo registrar el lead en Base44');
                }

                return NextResponse.json({ reply: `Recibimos tu solicitud sobre la propiedad ${matchedProperty.id}. Un asesor se comunicará contigo.` });
            }
        }

        if (typeof message.content !== 'string' || !message.content.trim()) throw new Error('Empty reply');
        return NextResponse.json({ reply: message.content });
    } catch (error) {
        return NextResponse.json({ error: 'No pudimos completar la consulta. Si solicitaste contacto, confirma por WhatsApp antes de reenviar.' }, { status: 502 });
    }
  });
}
