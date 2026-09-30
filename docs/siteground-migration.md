# Migración SiteGround — fase 1 — 2026-09-30

Esta fase conserva los siete artículos publicados y sus imágenes dentro del despliegue de Vercel. Se incluyen además las galerías verificadas de A1163, A1164, A1165 y A1149 para la siguiente fase del catálogo.

- 82 imágenes, 6 901 910 bytes; formato, tamaño y SHA-256 verificados.
- A1164 usa exclusivamente el original WordPress 25004.
- No se incluyen datos de propietarios ni direcciones privadas.
- Los artículos conservan slug y fecha, con HTML saneado.
- El catálogo todavía consulta WordPress en esta fase. No apagar SiteGround.
- Pendientes: importar los tres inmuebles al CRM, trasladar galerías A1149, retirar el puente WordPress, respaldar correo/hosting y trasladar DNS.
- A1166 está bajo contrato en Base44. A1167 no aparece en la captura actual de WordPress. No volver a publicarlos desde copias históricas.

## Verificación

`node --test tests/wordpress-bridge.test.mjs`: 8 pruebas aprobadas.
`npm run build`: compilación y 12 rutas estáticas correctas.
El HTML generado de /blog no contiene referencias a admin.alsasa.co.

## Reproducibilidad

`scripts/archive-wordpress.py` requiere Python, beautifulsoup4 y bleach. Sus entradas son capturas verificadas del contenido público. `docs/wordpress-assets-manifest.json` registra procedencia, tamaño y checksum de cada imagen; `data/wordpress-archive.json` contiene solamente contenido público saneado.
