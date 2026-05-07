# 🔐 Solución: Error 401 "Login Required" en Gmail API

## 🎯 Causa Raíz del Problema

El error **401 "Login Required"** después de autenticación exitosa ocurría por **una de estas razones**:

### 1. **El cliente OAuth2 no tenía el token configurado correctamente**
El tipo `as any` estaba ocultando un problema en cómo se pasaba la autenticación al servicio de Gmail. Sin validación, no había forma de diagnosticar que el token no llegaba a las solicitudes.

### 2. **Falta de verificación después de cargar el token**
El código original no validaba que `this.client` tuviera credenciales configuradas después de `tryLoadToken()` o `runAuthFlow()`. Si algo fallaba silenciosamente, la API se llamaba sin autenticación.

### 3. **Manejo insuficiente de errores de renovación**
Si el `refresh_token` expiraba, el código no informaba correctamente al usuario, resultando en solicitudes 401.

---

## ✅ Cambios Implementados

### **test-gmail.ts**

#### 1️⃣ **Eliminación de `as any`**
```typescript
// ❌ ANTES (problema oculto)
this.gmail = google.gmail({ version: 'v1', auth: this.client as any });

// ✅ DESPUÉS (tipo correcto)
this.gmail = google.gmail({ version: 'v1', auth: this.client });
```

#### 2️⃣ **Validación crítica de credenciales en `init()`**
```typescript
// ✅ NUEVO: Verificación de que el cliente tiene access_token
const creds = this.client.credentials;
if (!creds || !creds.access_token) {
  throw new Error('❌ CRÍTICO: Cliente OAuth2 sin access_token...');
}
```

#### 3️⃣ **Logging detallado en `tryLoadToken()`**
- Indica qué token se cargó
- Valida que se configuró correctamente en el cliente
- Detecta tokens expirados y renueva automáticamente
- Diferencia entre "token no existe" y "token inválido"

#### 4️⃣ **Logging detallado en `runAuthFlow()`**
- Documenta cada paso del flujo OAuth
- Verifica que el token se guardó correctamente en disco
- Proporciona mejor diagnosticabilidad

#### 5️⃣ **Manejo mejorado de errores en `getCorreosSolicitud()`**
```typescript
if (err.response?.status === 401) {
  console.error(
    '   → Error 401: El token probablemente está inválido o expirado.\n' +
    '   → SOLUCIÓN: Elimina token.json y reinicia la autenticación.\n'
  );
}
```

---

## 🧪 Cómo Usar el Diagnóstico

```bash
# Ejecutar el script de diagnóstico
npx ts-node src/diagnose.ts
```

Este script:
1. ✅ Valida `credenciales.json`
2. ✅ Verifica `token.json` si existe
3. ✅ Inicializa `GmailService` con logging completo
4. ✅ Realiza una llamada de prueba a `gmail.users.messages.list()`
5. ✅ Proporciona pasos para resolver si hay problemas

**Salida esperada:**
```
🔍 DIAGNÓSTICO DE GMAIL API
1️⃣  Verificando credenciales.json...
   ✅ credenciales.json válido
   ✅ client_id: 123456789...
   ✅ client_secret presente: true

2️⃣  Verificando token.json...
   ℹ️  Token no existe (primera ejecución)

3️⃣  Inicializando GmailService...
   ✅ OAuth2 cliente creado
   📋 Token previo no encontrado
   🔐 Iniciando flujo de autenticación OAuth2...
   [Abre navegador para autenticar]
   ...
   ✅ TODAS LAS PRUEBAS PASARON
```

---

## 🔧 Solución Rápida Si Aún Tienes 401

1. **Elimina `token.json`** desde la raíz del proyecto:
   ```bash
   rm token.json
   # O en Windows
   del token.json
   ```

2. **Ejecuta diagnóstico**:
   ```bash
   npx ts-node src/diagnose.ts
   ```
   Esto te forzará a pasar por el flujo de autenticación desde cero.

3. **Verifica que:**
   - ✅ La URL del navegador se abre automáticamente
   - ✅ Ves "✅ ¡Autenticación exitosa!"
   - ✅ El script muestra "✅ TODAS LAS PRUEBAS PASARON"

---

## 📋 Verificación Previa (Google Cloud Console)

Antes de ejecutar, asegúrate que:

1. **OAuth 2.0 Desktop App creada**
   - En "Credenciales", tienes un archivo JSON descargado

2. **Scopes correctos**
   - `https://www.googleapis.com/auth/gmail.readonly`
   - (+ `gmail.send`, `gmail.modify` si necesitas enviar/modificar)

3. **Pantalla de consentimiento en Testing**
   - Tu correo está agregado como "Usuario de Prueba"

4. **Redirect URI exacto**
   - Google Cloud Console: `http://localhost:3000`
   - En `test-gmail.ts`: `http://localhost:3000` (debe coincidir)

5. **API de Gmail habilitada**
   - En "APIs y servicios" → "Bibliotecas" → Gmail API activada

---

## 🚀 Cómo Usar en Producción

Una vez que `diagnose.ts` pasa todas las pruebas:

```typescript
import { GmailService } from './src/test-gmail';

async function main() {
  const gmail = new GmailService();
  await gmail.init(); // Logging completo te mostrará todo

  // Ahora puedes usar:
  const correos = await gmail.getCorreosSolicitud('INBOX', 20);
  console.log(`Encontrados ${correos.length} correos no leídos`);

  // Marcar como leído
  await gmail.marcarLeido(correos[0].id);

  // Responder
  await gmail.responder(
    correos[0].threadId,
    'recipient@example.com',
    'Re: ' + correos[0].asunto,
    'Contenido de la respuesta...'
  );
}

main().catch(console.error);
```

---

## ❓ Preguntas Frecuentes

### P: ¿Por qué me pide autenticar cada vez?
**R:** `token.json` se eliminó o se corrompió. El script `diagnose.ts` lo regenerará automáticamente.

### P: ¿Qué pasa cuando el token expira?
**R:** El código intenta renovarlo automáticamente usando el `refresh_token`. Si falla, el usuario debe autenticarse nuevamente.

### P: ¿Puedo usar esto en un servidor sin interfaz gráfica?
**R:** Sí, pero necesitas guardar el token la primera vez desde una máquina con navegador. Luego copia el `token.json` al servidor.

### P: ¿El logging ralentiza la app?
**R:** No. Puedes comentar las líneas `console.log()` en producción si lo necesitas, pero el overhead es mínimo.

---

## 📚 Referencias

- [Google Gmail API Docs](https://developers.google.com/gmail/api)
- [OAuth2 Node.js Guide](https://developers.google.com/identity/protocols/oauth2)
- [googleapis npm package](https://www.npmjs.com/package/googleapis)
