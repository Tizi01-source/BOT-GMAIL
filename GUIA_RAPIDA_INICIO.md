# 🚀 GUÍA RÁPIDA DE INICIO - 5 MINUTOS

## 0️⃣ Prerequisitos

- Node.js v18+ instalado
- Una cuenta Google (Gmail + Google Cloud)
- Acceso a este repositorio

---

## 1️⃣ Descargar y Preparar (1 minuto)

```bash
# Ir a carpeta del proyecto
cd BOT-GMAIL-CUPOS

# Instalar dependencias
npm install dotenv @google/generative-ai
```

---

## 2️⃣ Obtener Credenciales (2 minutos)

### A. GEMINI API KEY

1. Abre: https://aistudio.google.com/app/apikey
2. Haz clic en "Create API Key" o copia la existente
3. Copia la clave (algo como: `AIzaSy...`)

### B. Gmail OAuth (credenciales.json)

1. Abre: https://console.cloud.google.com
2. Crea nuevo proyecto (o usa uno existente)
3. APIs & Services → Library → Busca "Gmail"
4. Haz clic en "Gmail API" → "Enable"
5. Vuelve a APIs & Services → Credentials
6. "Create Credentials" → "OAuth 2.0 Client ID"
7. Elige "Desktop application"
8. Descarga el JSON
9. Guarda como `credenciales.json` en la carpeta del proyecto

---

## 3️⃣ Configurar .env (1 minuto)

```bash
# Copiar plantilla
cp .env.example .env

# Abrir para editar (elige tu editor)
nano .env
# O en Windows PowerShell:
notepad .env
```

**Reemplaza estos valores:**

```env
GEMINI_API_KEY=AIzaSy... # ← Tu clave copiada en 2A
GMAIL_CREDENTIALS_PATH=./credenciales.json  # ← Archivo de 2B
```

**Guarda el archivo.**

---

## 4️⃣ Validar que Todo Funciona (1 minuto)

```bash
npx ts-node src/diagnose.ts
```

**Deberías ver:**
```
1️⃣  VALIDANDO CONFIGURACIÓN... ✅
2️⃣  Verificando credenciales.json ✅
3️⃣  Verificando token.json ℹ️
4️⃣  Inicializando GmailService ✅
[← Aquí se abrirá el navegador para autenticar]
```

**En el navegador:**
- Se abrirá Google Login
- Loguéate con tu cuenta Gmail
- Autoriza los permisos
- Verás un mensaje: "✅ ¡Autenticación exitosa!"

**De vuelta en la consola:**
```
✅ DIAGNÓSTICO EXITOSO: 8/8 etapas OK
🚀 ¡El bot está listo para funcionar!
```

---

## 5️⃣ OPCIÓN A: Probar una Sola Vez

```bash
npx ts-node src/app.ts --once --max=5
```

**Esto:**
- Lee hasta 5 emails no leídos
- Analiza recibos con Gemini IA
- Calcula cupos
- Envía respuestas automáticas
- **Termina**

Perfecto para testing.

---

## 5️⃣ OPCIÓN B: Modo Continuo (Producción)

```bash
npx ts-node src/app.ts
```

**Esto:**
- Chequea cada 5 minutos
- Procesa emails automáticamente
- Responde cupos
- Marca como leído
- **Sigue corriendo indefinidamente**

Perfecto para producción (100+ emails/día).

---

## 🧪 TESTING SEGURO (Recomendado Antes de Producción)

### Opción A: Email Sandbox
```bash
# Lee TESTING_GUIDE.md sección "OPCIÓN A"
# Crea cuenta sandbox: pruebas-bot@gmail.com
# Usa eso para probar sin riesgo
```

### Opción B: Modo Simulacro (Dry-Run)
```bash
# No envía emails reales, solo simula
export DRY_RUN=true
npx ts-node src/app.ts --once --max=3

# En Windows:
$env:DRY_RUN="true"
npx ts-node src/app.ts --once --max=3
```

---

## 📊 Ejemplos de Uso

```bash
# Procesar 1 email y salir
npx ts-node src/app.ts --once --max=1

# Procesar máximo 20 emails (por defecto) y salir
npx ts-node src/app.ts --once

# Procesar 100 emails en modo continuo
npx ts-node src/app.ts --max=100

# Simulacro sin enviar emails reales
DRY_RUN=true npx ts-node src/app.ts --once

# Diagnóstico completo del setup
npx ts-node src/diagnose.ts
```

---

## ⚠️ Si Algo Falla

### Error: "GEMINI_API_KEY no definida"
```bash
# Abre .env y verifica:
# GEMINI_API_KEY=... (no debe estar vacío)

# O establece como variable:
export GEMINI_API_KEY=AIzaSy...
npx ts-node src/diagnose.ts
```

### Error: "credenciales.json no encontrado"
```bash
# 1. Ve a paso 2B y descarga archivo
# 2. Guarda exactamente como "credenciales.json"
# 3. En la raíz del proyecto (mismo nivel que package.json)
# 4. Verifica: ls credenciales.json (o dir en Windows)
```

### Error: "Token inválido (401)"
```bash
# Limpia token y reautentica:
rm token.json
npx ts-node src/diagnose.ts
# → Loguéate nuevamente en el navegador
```

### Error: "No hay correos"
```bash
# Posibles causas:
# 1. No hay emails sin leer con "solicitud" en asunto
# 2. Envía un email de prueba a tu cuenta
# 3. Asunto debe contener: "Solicitud de crédito"
# 4. Adjunta un PDF/imagen
```

---

## 📚 Documentación Completa

- **TESTING_GUIDE.md** → Casos de prueba detallados
- **CAMBIOS_REALIZADOS.md** → Todo lo que cambió
- **README.md** → Documentación técnica
- **RESUMEN_REFACTOR.md** → Arquitectura del código

---

## ✨ ¡LISTO!

Tu bot está configurado. Ahora:

1. **Prueba:** `npx ts-node src/app.ts --once --max=1`
2. **Envía un email** con asunto "Solicitud de crédito" + PDF
3. **Verifica respuesta** que recibas automáticamente
4. **En producción:** `npx ts-node src/app.ts` (continuo)

---

**¿Preguntas?** Lee `TESTING_GUIDE.md` sección "Troubleshooting"

**🎉 ¡A procesar créditos automáticamente!**
