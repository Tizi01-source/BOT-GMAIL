# 🤖 BOT DE SOLICITUDES DE CRÉDITO AUTOMATIZADO

Automatización completa de procesamiento de solicitudes de crédito mediante análisis de recibos con IA.

## Tabla de Contenidos hola

1. [Características](#características)
2. [Arquitectura](#arquitectura)
3. [Requisitos](#requisitos)
4. [Instalación](#instalación)
5. [Configuración](#configuración)
6. [Uso](#uso)
7. [Estructura de Proyecto](#estructura-de-proyecto)
8. [Servicios](#servicios)
9. [Flujo Completo](#flujo-completo)
10. [Ejemplos](#ejemplos)
11. [Troubleshooting](#troubleshooting)

---

## Características

✅ **Lee automáticamente** correos de solicitud de crédito de Gmail
✅ **Extrae adjuntos** (PDF, PNG, JPG) de los correos
✅ **Análisis con IA** - Gemini extrae DNI, organismo, sueldo del recibo
✅ **Busca socio** en base de datos Excel por DNI
✅ **Calcula cupo** automáticamente basado en:
   - Sueldo neto
   - Organismo (IPS, ANDE, Itaipú, etc.)
   - Estado del socio (nuevo/activo)
   - Deuda existente
✅ **Genera respuesta personalizada** con el cupo aprobado/rechazado
✅ **Envía por email** automáticamente
✅ **Procesa en lote** múltiples solicitudes
✅ **Modo continuo** - chequea cada 5 minutos
✅ **Modo una sola vez** - procesa y sale
✅ **Escalable y modular** - agregar nuevas reglas sin tocar código existente

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                      APP.TS (ORQUESTADOR)                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │    GMAIL     │  │   GEMINI     │  │    EXCEL     │      │
│  │   SERVICE    │  │   SERVICE    │  │   SERVICE    │      │
│  │              │  │              │  │              │      │
│  │ - Leer       │  │ - Analizar   │  │ - Buscar     │      │
│  │ - Enviar     │  │   recibos    │  │   socios     │      │
│  │ - Adjuntos   │  │ - Extraer    │  │ - Obtener    │      │
│  │              │  │   datos      │  │   datos      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                          │                                  │
│  ┌─────────────────────┬──┴───────────────────────────┐    │
│  │                     │                              │    │
│  ▼                     ▼                              ▼    │
│ ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│ │    QUOTA     │  │    EMAIL     │  │    CONFIG    │     │
│ │  PROCESSOR   │  │  PROCESSOR   │  │  & TYPES     │     │
│ │              │  │              │  │              │     │
│ │ - Calcular   │  │ - Orquestar  │  │ - Centrali-  │     │
│ │   cupo       │  │   flujo      │  │   zación     │     │
│ │ - Aplicar    │  │ - Generar    │  │ - Tipos      │     │
│ │   reglas     │  │   respuesta  │  │   compar-    │     │
│ │              │  │              │  │   tidos      │     │
│ └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Flujo de Datos

```
CORREO (Gmail)
    ↓
Extraer DNI, adjuntos
    ↓
GEMINI AI → Analizar recibo → Datos extraídos (DNI, organismo, sueldo)
    ↓
EXCEL → Buscar socio por DNI
    ↓
QUOTA PROCESSOR → Calcular cupo (aplicar reglas de negocio)
    ↓
EMAIL PROCESSOR → Generar respuesta personalizada
    ↓
GMAIL → Enviar por email
    ↓
Marcar como leído
```

---

## 📦 Requisitos

- **Node.js** v18+ 
- **TypeScript** v5+
- **npm** o **yarn**
- **Google Cloud Project** con Gmail API habilitada
- **Gemini API Key** (Google AI Studio)
- **Excel** con datos de socios (o similar)

---

## 🚀 Instalación

### 1. Clonar o crear el proyecto

```bash
cd BOT-GMAIL-CUPOS
npm install
```

### 2. Instalar dependencias principales

```bash
npm install @google/generative-ai googleapis google-auth-library
npm install --save-dev ts-node typescript
```

### 3. Configurar Google Cloud

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un proyecto nuevo
3. Habilita "Gmail API"
4. Crea credenciales de tipo "Desktop App"
5. Descarga el archivo JSON y renómbralo a `credenciales.json`
6. Colócalo en la raíz del proyecto

### 4. Configurar Gemini API

1. Ve a [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Crea una API Key
3. Establece la variable de entorno:

```bash
# En Windows (PowerShell)
$env:GEMINI_API_KEY="tu-clave-aqui"

# En Linux/Mac
export GEMINI_API_KEY="tu-clave-aqui"

# O en .env (crear archivo en raíz)
GEMINI_API_KEY=tu-clave-aqui
```

---

## ⚙️ Configuración

Edita `src/config.ts` para personalizar:

```typescript
export const CONFIG: ConfiguracionBot = {
  gmail: {
    pollIntervalMs: 5 * 60 * 1000,  // Chequea cada 5 minutos
  },
  cupos: {
    minimoSueldo:          50000,        // Mínimo para tener cupo
    porcentajeDelSueldo:   0.30,         // 30% del sueldo = cupo base
    cupoMaximoNuevoSocio:  150000,       // Máx para nuevos
    cupoMaximoSocioActivo: 500000,       // Máx para activos
    descuentoPorDeuda:     0.50,         // 50% descuento si hay deuda
  },
  organismos: {
    'IPS': { coeficiente: 1.0 },
    'ANDE': { coeficiente: 1.05 },
    'Itaipú': { coeficiente: 1.1 },
    // Agregar más...
  },
};
```

---

## 🎮 Uso

### Opción 1: Diagnóstico (Validar todo está OK)

```bash
npx ts-node src/diagnose.ts
```

Valida:
- ✅ Credenciales de Gmail
- ✅ Token OAuth2
- ✅ Conexión a Gmail API
- ✅ Gemini API Key
- ✅ Base de datos de socios
- ✅ Lógica de cupos

### Opción 2: Ejecutar una sola vez

```bash
npx ts-node src/app.ts --once
```

Procesa todos los emails pendientes y se detiene.

### Opción 3: Ejecutar continuamente (RECOMENDADO)

```bash
npx ts-node src/app.ts
```

Chequea cada 5 minutos automáticamente.

### Opciones adicionales

```bash
# Procesar máximo 5 correos
npx ts-node src/app.ts --max=5 --once

# Ejecutar con diagnóstico primero
npx ts-node src/app.ts --diagnose --once
```

---

## 📂 Estructura de Proyecto

```
BOT-GMAIL-CUPOS/
├── src/
│   ├── config.ts                    # Configuración centralizada
│   ├── types.ts                     # Tipos e interfaces compartidas
│   ├── app.ts                       # Aplicación principal
│   ├── diagnose.ts                  # Script de diagnóstico
│   ├── test-gmail.ts                # DEPRECATED - mover a servicios
│   ├── services/
│   │   ├── GmailService.ts          # Gmail API integration
│   │   ├── GeminiService.ts         # AI receipt analysis
│   │   ├── ExcelService.ts          # Partner database
│   │   ├── QuotaProcessor.ts        # Quota calculation logic
│   │   └── EmailProcessor.ts        # Workflow orchestration
│   ├── config/                      # (vacío - para futuro uso)
│   └── controllers/                 # (vacío - para futuro uso)
├── datos/
│   ├── socios.xlsx                  # Base de datos de socios
│   └── movimientos.xlsx             # Movimientos (opcional)
├── credenciales.json                # Credenciales de Google
├── token.json                       # Token OAuth2 (generado)
├── package.json
├── tsconfig.json
└── README.md                        # Este archivo
```

---

## 🔧 Servicios

### GmailService

Lee y gestiona correos de Gmail.

```typescript
const gmail = new GmailService();
await gmail.init();

// Obtener solicitudes sin leer
const correos = await gmail.obtenerSolicitudes(20);

// Marcar como leído
await gmail.marcarLeido(correo.id);

// Enviar respuesta
await gmail.responder(
  threadId,
  para,
  "Re: Solicitud de Crédito",
  "Su cupo es de $150.000..."
);
```

### GeminiService

Analiza recibos/imágenes con IA.

```typescript
const gemini = new GeminiService();

const analisis = await gemini.analizarRecibo(
  bufferPDF,
  "recibo.pdf",
  "application/pdf"
);

console.log(analisis.datos); // { dni: "12345678", organismo: "IPS", sueldoNeto: 2500000 }
```

### ExcelService

Busca datos de socios.

```typescript
const excel = new ExcelService();
await excel.cargar();

// Buscar socio
const socio = excel.buscarPorDNI("12345678");

// Obtener estadísticas
const stats = excel.obtenerEstadisticas();
console.log(stats.totalSocios); // 150
console.log(stats.deudaTotal);  // $5.000.000
```

### QuotaProcessor

Calcula cupo con reglas de negocio.

```typescript
const quota = new QuotaProcessor(excel);

const calculo = quota.calcularCupo(
  dni,
  sueldoNeto,
  organismo
);

console.log(calculo.montoQupo); // 750000
console.log(calculo.razon);     // "Socio activo (máx: $500000) | Tiene deuda: 50%..."
```

### EmailProcessor

Orquesta el flujo completo.

```typescript
const procesador = new EmailProcessor(gmail, gemini, excel, quota);

const resultado = await procesador.procesarSolicitud(correo);

console.log(resultado.exitoso);  // true
console.log(resultado.detalles); // { dni, montoQupo, organismo, ... }
```

---

## 🔄 Flujo Completo

### 1. Leer Correo

```
Gmail → obtenerSolicitudes() → Retorna array de CorreoSolicitud
├─ id
├─ de
├─ asunto
├─ cuerpo
├─ adjuntos[]
│  └─ datos (Buffer), tipo, nombre
```

### 2. Analizar Recibo

```
Gemini AI → analizarRecibo(buffer, nombre, tipoMime)
├─ Lee imagen/PDF
├─ Extrae datos estructurados
└─ Retorna DatosRecibo
   ├─ dni: "12345678"
   ├─ organismo: "IPS"
   └─ sueldoNeto: 2500000
```

### 3. Buscar Socio

```
Excel → buscarPorDNI("12345678")
├─ Si existe:
│  ├─ nombre
│  ├─ estado
│  ├─ tieneDeuda
│  ├─ estadoCredito
│  └─ montoDeuda
└─ Si no existe: NULL (nuevo socio)
```

### 4. Calcular Cupo

```
QuotaProcessor → calcularCupo(dni, sueldo, organismo)
├─ 1. Validar sueldo mínimo
├─ 2. Calcular cupo base (% del sueldo)
├─ 3. Aplicar coeficiente del organismo
├─ 4. Aplicar límite (nuevo vs activo)
├─ 5. Aplicar descuento por deuda
└─ Retorna CalculoCupo
   ├─ montoQupo
   ├─ razon
   └─ detalles
```

### 5. Generar Respuesta

```
EmailProcessor → generarMensajeCupo(calculoCupo)
├─ Personaliza con nombre del socio
├─ Incluye monto, organismo, estado
└─ Retorna mensaje listo para enviar
```

### 6. Enviar Email

```
Gmail → responder(threadId, para, asunto, cuerpo)
├─ Construye RFC 2822 válido
├─ Envía como respuesta en el thread
└─ Marca correo como leído
```

---

## 📝 Ejemplos

### Ejemplo 1: Procesar un correo completo

```typescript
import { EmailProcessor } from './services/EmailProcessor';
import { GmailService } from './services/GmailService';
// ... otros imports

async function procesarUno() {
  // Inicializar servicios
  const gmail = new GmailService();
  const gemini = new GeminiService();
  const excel = new ExcelService();
  const quota = new QuotaProcessor(excel);
  const procesador = new EmailProcessor(gmail, gemini, excel, quota);

  // Preparar
  await gmail.init();
  await excel.cargar();

  // Obtener un correo
  const correos = await gmail.obtenerSolicitudes(1);
  
  if (correos.length === 0) {
    console.log('No hay solicitudes');
    return;
  }

  // Procesarlo
  const resultado = await procesador.procesarSolicitud(correos[0]);
  
  console.log('Resultado:', resultado);
}

procesarUno().catch(console.error);
```

### Ejemplo 2: Calcular cupo manualmente

```typescript
const excel = new ExcelService();
await excel.cargar();

const quota = new QuotaProcessor(excel);

const calculo = quota.calcularCupo(
  '12345678',    // DNI
  2500000,       // Sueldo neto
  'IPS'          // Organismo
);

console.log(`Cupo: $${calculo.montoQupo}`);
console.log(`Razón: ${calculo.razon}`);

// Generar mensaje
const mensaje = quota.generarMensajeCupo(calculo, 'Juan Pérez');
console.log(mensaje);
```

### Ejemplo 3: Buscar socio

```typescript
const excel = new ExcelService();
await excel.cargar();

const socio = excel.buscarPorDNI('12345678');

if (socio) {
  excel.imprimirResumenSocio(socio);
} else {
  console.log('Nuevo socio - no existe en la base de datos');
}

// Obtener estadísticas
const stats = excel.obtenerEstadisticas();
console.log(`Total de socios: ${stats.totalSocios}`);
console.log(`Deuda total: $${stats.deudaTotal}`);
```

---

## 🛠️ Troubleshooting

### Error: "GEMINI_API_KEY no configurada"

**Solución:**
```bash
$env:GEMINI_API_KEY="tu-clave"  # PowerShell
# o
export GEMINI_API_KEY="tu-clave"  # Bash
```

### Error: "credenciales.json no encontrado"

**Solución:**
1. Descarga credenciales de Google Cloud Console
2. Renombra a `credenciales.json`
3. Colócalo en la raíz del proyecto

### Error: "401 Unauthorized"

**Solución:**
1. Elimina `token.json`
2. Ejecuta: `npx ts-node src/diagnose.ts`
3. Autentica en el navegador

### Error: "No hay socios en la base de datos"

**Solución:**
1. Crea `datos/socios.xlsx`
2. Agrega columnas: DNI, nombre, estado, esNuevo, tieneDeuda, etc.
3. Implementa lectura real de Excel en `ExcelService.cargar()`

### El bot no procesa correos

**Verificar:**
1. ✅ `npx ts-node src/diagnose.ts`
2. ✅ Correos marcados como "No leídos" o con etiqueta "Solicitudes"
3. ✅ Busca en `src/config.ts` → `email.busquedaQuery`
4. ✅ Adjuntos: Solo acepta PDF, PNG, JPG

---

## 📚 Referencias

- [Gmail API Docs](https://developers.google.com/gmail/api)
- [Gemini API](https://ai.google.dev)
- [Google Auth Library](https://github.com/googleapis/google-auth-library-nodejs)
- [googleapis npm](https://www.npmjs.com/package/googleapis)

---

## 📝 Licencia

Privado - Uso interno

---

## ✉️ Soporte

Para preguntas o issues, contacta al equipo de desarrollo.

---

**Última actualización:** Mayo 2026
**Versión:** 2.0 (Arquitectura Modular)
