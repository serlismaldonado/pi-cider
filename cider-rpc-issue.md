# Problema Cider RPC - pi-cider

## Estado: EN PROGRESO

## Error
```
Error: Cider RPC error: 403 Forbidden
Error: UNAUTHORIZED_APP_TOKEN
```

## Pruebas realizadas
1. ✅ Token del .env → Falla con UNAUTHORIZED
2. ✅ Token del auth.json → Falla con UNAUTHORIZED
3. ✅ Headers: apitoken, API-Token, Bearer, X-API-Token → Todos fallan
4. ✅ Sin auth → Falla con UNAUTHORIZED
5. ✅ Reiniciar Cider → Sigue fallando

## Solución Parcial Implementada
- Código ahora soporta múltiples formatos de header
- Soporte para mode sin token (auth deshabilitado en Cider)
- Mejor manejo de errores

## Problema Actual
El código tiene errores de TypeScript en cider_status tool - necesita fix de sintaxis.

## Próximos Pasos
1. Fix errores de compilación en cider_status tool
2. Compilar y copiar a global
3. Testear sin auth

## Fecha
2026-04-26 (pausado)
