'use client';

import { useRef, useState } from 'react';
import TurnstileChallenge from './TurnstileChallenge';

export default function ProtectedLeadForm({ children, style }) {
  const [proof, setProof] = useState(null);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState('');
  const [generation, setGeneration] = useState(0);
  const inFlight = useRef(false);

  async function submit(event) {
    event.preventDefault();
    if (!proof || inFlight.current || uncertain) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    const data = new URLSearchParams(new FormData(event.currentTarget));
    data.set('proof', proof.proof);
    data.set('operation', proof.operation);
    setProof(null);
    try {
      const response = await fetch('/api/leads', {
        method: 'POST', body: data, cache: 'no-store', redirect: 'error',
        signal: AbortSignal.timeout(30000),
      });
      const result = await response.json();
      if (response.ok && result.success === true) {
        window.location.assign('/gracias?status=ok');
        return;
      }
      if (response.status === 502) throw new Error('uncertain');
      setError(result.error || 'No pudimos enviar la solicitud.');
    } catch {
      setUncertain(true);
      setError('No pudimos confirmar la recepción. Evita reenviar la solicitud y consulta con nosotros por WhatsApp.');
    } finally {
      inFlight.current = false;
      setBusy(false);
      setGeneration(n => n + 1);
    }
  }

  return <form onSubmit={submit} style={style}>
    {!busy && !uncertain && <TurnstileChallenge key={generation} kind="form" onProof={setProof} />}
    <fieldset disabled={!proof || busy || uncertain} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, ...style }}>
      {children}
    </fieldset>
    {busy && <p role="status">Enviando solicitud…</p>}
    {error && <p role="alert">{error}</p>}
    <noscript>Activa JavaScript para verificar y enviar, o contáctanos por WhatsApp.</noscript>
  </form>;
}
