'use client';

import Script from 'next/script';
import { useCallback, useEffect, useRef, useState } from 'react';
import { TURNSTILE_SITE_KEY, TURNSTILE_ACTIONS } from '@/lib/turnstile-public.mjs';

export default function TurnstileChallenge({ kind, onProof }) {
  const container = useRef(null);
  const widget = useRef(null);
  const notify = useRef(onProof);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [generation, setGeneration] = useState(0);
  useEffect(() => { notify.current = onProof; }, [onProof]);
  const invalidate = useCallback(() => { notify.current(null); setFailed(true); }, []);

  useEffect(() => {
    if (!ready || !container.current || !window.turnstile) return;
    let active = true;
    const operation = crypto.randomUUID();
    notify.current(null);
    setFailed(false);
    try {
      widget.current = window.turnstile.render(container.current, {
        sitekey: TURNSTILE_SITE_KEY, action: TURNSTILE_ACTIONS[kind], cData: operation,
        language: 'es', theme: 'light', size: 'flexible', retry: 'never',
        'response-field': false, 'refresh-expired': 'manual', 'refresh-timeout': 'manual',
        callback: token => { if (active) { setFailed(false); notify.current({ proof: token, operation }); } },
        'expired-callback': () => { if (active) invalidate(); },
        'timeout-callback': () => { if (active) invalidate(); },
        'error-callback': () => { if (active) invalidate(); },
      });
    } catch { invalidate(); }
    return () => {
      active = false;
      notify.current(null);
      if (widget.current !== null) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, [ready, generation, kind, invalidate]);

  return <div style={{ width: '100%', minWidth: 0 }}>
    <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
      strategy="afterInteractive" onReady={() => setReady(true)} onError={invalidate} />
    <div ref={container} />
    {!ready && !failed && <p role="status">Cargando verificación de seguridad…</p>}
    {failed && <div role="status">
      <p>No se pudo completar la verificación.</p>
      {ready ? <button type="button" onClick={() => setGeneration(n => n + 1)}>Verificar de nuevo</button>
        : <p>Recarga la página o contáctanos por WhatsApp.</p>}
    </div>}
  </div>;
}
