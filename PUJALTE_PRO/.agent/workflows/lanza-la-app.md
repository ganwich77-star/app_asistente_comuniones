---
description: Lanza el entorno de desarrollo local con el Motor Maestro y la App real
---

Este workflow configura el servidor local simulando el hosting y abre la App cliente con datos reales.

// turbo
1. Configurar estructura y lanzar servidor:
```bash
# Liberar puerto y lanzar servidor en el root del proyecto
lsof -ti :8000 | xargs kill -9 2>/dev/null || true
python3 -m http.server 8000 &
```

2. Abrir la App en el navegador:
Use the browser subagent to navigate to:
`http://localhost:8000/index.html?id=claudia-2026`
