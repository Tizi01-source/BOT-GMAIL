# 🧪 GUÍA COMPLETA DE TESTING - BOT DE SOLICITUDES DE CRÉDITO

## ⚠️ ADVERTENCIA CRÍTICA

**NUNCA pruebes un bot de correos directamente con la cuenta de clientes reales.**

Podrías enviar:
- 50 correos por accidente
- Datos de clientes a direcciones incorrectas
- Cupos incorrectos que comprometan la cooperativa

**Solución:** Usa una cuenta Sandbox de Gmail para testing.

---

## 🏠 OPCIÓN A: USAR GMAIL SANDBOX (RECOMENDADO)

### Paso 1: Crear una Cuenta de Prueba

1. Crea una cuenta de Gmail nueva (ej: `pruebas-bot@gmail.com`)
2. Ve a [Google Cloud Console](https://console.cloud.google.com)
3. En **OAuth Consent Screen**, ve a "Test users"
4. Haz clic en **"+ Add users"**
5. Agrega el email de tu cuenta sandbox: `pruebas-bot@gmail.com`
6. Guarda

### Paso 2: Autorizar en la Cuenta Sandbox

1. **Elimina token.json** (para forzar nueva autenticación):
   ```bash
   rm token.json
   ```

2. Ejecuta el bot:
   ```bash
   npx ts-node src/diagnose.ts
   ```

3. Se abrirá el navegador. **Loguéate con la cuenta sandbox** (`pruebas-bot@gmail.com`)

4. Autoriza los permisos solicitados

5. El token se guardará y podrá ser usado para testing

### Paso 3: Envía Correos de Prueba

Desde tu cuenta personal, envía correos a `pruebas-bot@gmail.com` con:

- **Asunto:** "Solicitud de crédito"
- **Adjunto:** PDF/imagen de recibo
- Cuerpo: Información de contacto

El bot procesará el correo y responderá a tu email personal.

---

## 🎪 OPCIÓN B: MODO DRY-RUN (SIN ENVIAR EMAILS)

### ¿Qué es?

Modo de simulacro donde el bot:
- ✅ Lee correos reales
- ✅ Usa IA real para analizar (cobra API calls)
- ✅ Consulta base de datos
- ✅ Calcula cupos
- ❌ **NO envía emails** (solo imprime)
- ❌ **NO marca como leído** (el correo permanece sin leer)

### Cómo usar:

```bash
# Activar en .env
DRY_RUN=true

# O como variable de entorno
export DRY_RUN=true
npx ts-node src/app.ts --once --max=5
```

**Salida esperada:**
```
✅ PROCESAMIENTO EN MODO DRY-RUN
📧 De: cliente@example.com
📋 Asunto: Re: Solicitud
📩 [SIMULADO - NO ENVIADO]
   Para: cliente@example.com
   Mensaje: "Estimado Juan, tu cupo aprobado es de..."
```

---

## 🧬 CASOS DE PRUEBA ESENCIALES

Cuando pruebes con tu sandbox, envía estos escenarios:

### Caso 1: FLUJO IDEAL ✅
- **Correo:** "Solicitud de crédito"
- **Adjunto:** Recibo claro en PDF (1-2 páginas)
- **DNI:** Que exista en tu base de datos de prueba
- **Estado:** Socio activo sin deuda
- **Resultado esperado:** Cupo máximo (500k)

**Cómo enviar:**
```bash
# Usa un PDF de recibo real (puedes crear uno fake en Word/Google Docs)
# Envía a: pruebas-bot@gmail.com
```

### Caso 2: IMAGEN BORROSA 📸
- **Adjunto:** Foto de celular de un recibo arrugado/mal iluminado
- **Resultado esperado:** 
  - ✅ Si Gemini puede leer: procesa normalmente
  - ❌ Si no puede: error, correo marcado como leído (no loop)

**Cómo enviar:**
```bash
# Toma foto de un recibo real, envía como JPG
```

### Caso 3: SIN ADJUNTOS ❌
- **Correo:** "Hola quiero un crédito"
- **Adjuntos:** Ninguno
- **Resultado esperado:** 
  - Respuesta: "Por favor adjunta tu recibo de sueldo"
  - O: Correo ignorado sin error

**Cómo enviar:**
```bash
# Solo envía texto, sin archivos
```

### Caso 4: ORGANISMO VARIADO 🏢
Prueba con diferentes organismos que varían el coeficiente:

| Organismo | Coeficiente | Ejemplo DNI |
|-----------|-------------|-----------|
| IPS | 1.0 | 12345678 |
| ANDE | 1.05 | 87654321 |
| Itaipú | 1.1 | 11111111 |
| ANA | 0.9 | 22222222 |

**Cómo:**
1. Crea 4 recibos falsos (uno para cada organismo)
2. Asigna DNI diferentes en tu Excel (datos/socios.xlsx)
3. Envía 4 correos
4. Verifica que los cupos varían según coeficiente

### Caso 5: SOCIO NUEVO vs ENDEUDADO 💰
- **Socio Nuevo:** Cupo máximo = 150k
- **Socio Activo:** Cupo máximo = 500k
- **Socio con Deuda:** Cupo × 0.5 (50% descuento)

**Cómo probar:**
```
Correo 1: DNI 33333333 (nuevo, sueldo 1M)
  Esperado: 150k (máximo para nuevo)

Correo 2: DNI 44444444 (activo, sueldo 1M)
  Esperado: 500k (máximo para activo)

Correo 3: DNI 55555555 (activo con deuda, sueldo 1M)
  Esperado: 250k (500k × 0.5)
```

### Caso 6: SUELDO POR DEBAJO DEL MÍNIMO 📉
- **Sueldo:** $30,000 (mínimo es 50,000)
- **Resultado esperado:** "Sueldo insuficiente para otorgar crédito"

### Caso 7: PDF GRANDE (>50 MB) ⚠️
- **Adjunto:** PDF de 100 páginas o múltiples archivos
- **Resultado esperado:** Error de Gemini API (tamaño límite)
- **Acción:** Correo marcado como leído, no loop infinito

---

## 🔄 CICLO DE TESTING RECOMENDADO

### Día 1: Setup
```bash
# 1. Crear cuenta sandbox
# 2. Agregar como test user en Google Cloud

# 3. Limpiar token
rm token.json

# 4. Inicializar con sandbox
npx ts-node src/diagnose.ts
# → Loguéate con: pruebas-bot@gmail.com

# 5. Verifica que funciona
npx ts-node src/app.ts --once --max=3
```

### Día 2: Casos Básicos
```bash
# Envía Casos 1-3 a pruebas-bot@gmail.com

# Verifica resultados en la consola
npx ts-node src/app.ts --once --max=10

# Revisa respuestas en tu inbox personal
```

### Día 3: Casos Avanzados
```bash
# Envía Casos 4-7

# Usa dry-run si quieres sin usar API calls
export DRY_RUN=true
npx ts-node src/app.ts --once

# Verifica lógica sin consumir cuota
```

### Día 4: Integración Completa
```bash
# Modo continuo (simula producción)
npx ts-node src/app.ts

# Observa durante 30 minutos que:
# ✅ Procesa automáticamente cada email
# ✅ Responde correctamente
# ✅ Marca como leído
# ✅ No hay loops infinitos
# ✅ Los errores se manejan gracefully
```

---

## 🛡️ CHECKLIST PRE-PRODUCCIÓN

Antes de usar con cuenta real, verifica:

- [ ] ✅ Diagnose completo sin errores críticos
- [ ] ✅ 10+ correos de prueba procesados exitosamente
- [ ] ✅ Respuestas correctas (cupos acertados)
- [ ] ✅ Ningún email procesado 2 veces
- [ ] ✅ Errores marcados como leído (no loops)
- [ ] ✅ PDFs grandes rechazan sin crash
- [ ] ✅ Base de datos consulta funcionando
- [ ] ✅ Cupos calculan correctamente matemática
- [ ] ✅ Emails enviados con formato profesional
- [ ] ✅ Token se renueva automáticamente

---

## 🐛 DEBUGGING

### Ver logs detallados
```bash
# Activa debug en .env
DEBUG=true
npx ts-node src/app.ts --once
```

### Ver solo un correo
```bash
npx ts-node src/app.ts --once --max=1
```

### Simular sin consumir API calls
```bash
DRY_RUN=true npx ts-node src/app.ts --once --max=5
```

### Ver estado actual
```bash
npx ts-node src/diagnose.ts
```

---

## 📞 SOPORTE Y TROUBLESHOOTING

### Problema: "No encuentra correos"
- ✅ Verifica que el asunto tenga "Solicitud"
- ✅ Verifica que están sin leer (is:unread)
- ✅ Usa `npx ts-node src/diagnose.ts` paso 5

### Problema: Gemini devuelve datos incompletos
- ✅ Prueba con image más clara
- ✅ Recorta a solo el recibo (sin fondo)
- ✅ Verifica que es PDF o JPG/PNG

### Problema: Bucle infinito de emails
- ✅ Fue corregido: EmailProcessor marca como leído incluso con error
- ✅ Si ves que un correo se reprocesa: ejecuta `npx ts-node src/diagnose.ts` 

### Problema: "Token inválido (401)"
```bash
# Solución: Reautentica
rm token.json
npx ts-node src/diagnose.ts
# → Loguéate nuevamente
```

---

## 🚀 FINALMENTE: MIGRACIÓN A PRODUCCIÓN

Cuando estés listo:

1. **Crea credenciales para cuenta REAL:**
   - Google Cloud Console
   - Nueva OAuth para cuenta: `bot@cooperativa.com`
   - Agrega en .env: `GMAIL_CREDENTIALS_PATH=./credenciales-prod.json`

2. **Elimina token de sandbox:**
   ```bash
   rm token.json
   ```

3. **Loguéate con cuenta real:**
   ```bash
   npx ts-node src/diagnose.ts
   # → Loguéate con: bot@cooperativa.com
   ```

4. **Ejecuta una prueba final:**
   ```bash
   npx ts-node src/app.ts --once --max=1
   ```

5. **Si todo OK → Modo continuo:**
   ```bash
   npx ts-node src/app.ts
   # Bot procesará 100+ emails/día automáticamente
   ```

---

## 📊 MÉTRICAS A MONITOREAR

En producción, observa:
- Correos procesados/día
- Tasa de error
- Tiempo promedio por email
- API calls a Gemini (costo)
- Cupos otorgados vs rechazados

Guarda estos datos en `movimientos.xlsx` para auditoría.

---

**¡Felicidades! Tu bot está listo para producción segura. 🎉**
