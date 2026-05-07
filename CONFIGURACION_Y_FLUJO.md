# 📖 CONFIGURACIÓN Y FLUJO DEL BOT - GUÍA ÚNICA

**Última actualización:** Mayo 7, 2026  
**Versión:** 2.0.0  
**Estado:** Funcionando (errores corregidos)

---

## 🎯 VISIÓN RÁPIDA

**¿Qué hace el bot?**
1. Lee correos de Gmail con asunto "Solicitud"
2. Extrae adjuntos (PDF, imágenes)
3. **AHORA:** Busca si el remitente es socio en tu base de datos
4. **LUEGO (TÚ lo programas):** Valida condiciones para dar crédito/cupo
5. Responde con el resultado

**¿Está listo?**
- ✅ Lectura de Gmail funciona
- ✅ Gestión de credenciales segura
- ⏳ Búsqueda en BD (tú la conectas)
- ⏳ Lógica de cupos (tú la programas)

---

## 📁 ESTRUCTURA DEL CÓDIGO

```
src/
├── config.ts                    ← PARÁMETROS Y CLAVES (edita aquí)
├── types.ts                     ← Definiciones de tipos
├── app.ts                       ← Punto de entrada (ejecutable)
├── diagnose.ts                  ← Validación del setup
└── services/
    ├── GmailService.ts          ← Lee/envía correos Gmail
    ├── GeminiService.ts         ← [OPCIONAL] IA para analizar recibos
    ├── ExcelService.ts          ← Tu base de datos (integrar con tu archivo)
    ├── QuotaProcessor.ts        ← [TÚ PROGRAMAS] Lógica de cupos
    └── EmailProcessor.ts        ← Orquestador del flujo

.env                            ← CLAVES Y URLs (PRIVADO - nunca git)
credenciales.json              ← OAuth de Gmail (PRIVADO - nunca git)
```

---

## 🔑 CONFIGURACIÓN: DÓNDE CAMBIAR COSAS

### OPCIÓN 1: Variables de Entorno (.env)

**Archivo:** `.env` (en raíz del proyecto)

```ini
# Gmail OAuth
GMAIL_CREDENTIALS_PATH=./credenciales.json
GMAIL_REDIRECT_URI=http://localhost:3000
GMAIL_POLLING_INTERVAL=300000

# Gemini AI (opcional)
GEMINI_API_KEY=AIzaSy...
GEMINI_MODEL=gemini-2.0-flash

# Excel/Base de Datos
EXCEL_SOCIOS_PATH=./datos/socios.xlsx

# Cupos (parámetros de negocio)
CUPO_SUELDO_MINIMO=50000
CUPO_PORCENTAJE_BASE=30
CUPO_MAXIMO_NUEVO=150000
CUPO_MAXIMO_ACTIVO=500000
```

**¿Cómo cambiar?**
1. Abre `.env` en tu editor
2. Modifica los valores
3. Guarda
4. Reinicia el bot

### OPCIÓN 2: En el código (`src/config.ts`)

**Archivo:** `src/config.ts`

Aquí se definen valores por defecto si no están en `.env`:

```typescript
export const CONFIG: ConfiguracionBot = {
  gmail: {
    credencialesPath: './credenciales.json',
    tokenPath: './token.json',
    redirectUri: 'http://localhost:3000',
    pollIntervalMs: 5 * 60 * 1000,  // 5 minutos
  },
  
  cupos: {
    minimoSueldo: 50000,
    porcentajeDelSueldo: 0.30,      // 30%
    cupoMaximoNuevoSocio: 150000,
    cupoMaximoSocioActivo: 500000,
    descuentoPorDeuda: 0.50,        // Si tiene deuda, reduce 50%
  },
  
  organismos: {
    'IPS': { coeficiente: 1.0 },
    'ANDE': { coeficiente: 1.05 },
    'Itaipú': { coeficiente: 1.1 },
    // Agrega más aquí
  },
};
```

---

## 🚀 CÓMO EJECUTAR

### Instalación (Primera Vez)

```bash
# 1. Instalar dependencias
npm install

# 2. Copiar plantilla de configuración
cp .env.example .env

# 3. Editar .env con tus valores
# (GEMINI_API_KEY, credenciales.json, etc)
```

### Ejecución

```bash
# Validar que todo funciona
npx ts-node src/diagnose.ts

# Procesar UNA SOLA VEZ (testing)
npx ts-node src/app.ts --once --max=5

# Procesar CONTINUAMENTE (producción)
npx ts-node src/app.ts

# Modo SIMULACRO (sin enviar emails reales)
export DRY_RUN=true
npx ts-node src/app.ts --once
```

---

## 📋 FLUJO DEL BOT (Paso a Paso)

```
┌─────────────────────────────────┐
│  1. LEER CORREOS DE GMAIL       │
│  (busca: "is:unread")           │
└──────────────┬──────────────────┘
               │
┌──────────────v──────────────────┐
│  2. EXTRAER ADJUNTOS            │
│  (PDF, imágenes)                │
└──────────────┬──────────────────┘
               │
┌──────────────v──────────────────┐
│  3. BUSCAR SI ES SOCIO EN BD     │ ← TU ARCHIVO EXCEL
│  ExcelService.buscarPorDNI()    │
└──────────────┬──────────────────┘
               │
        ┌──────┴──────┐
        │             │
      SÍ ES        NO ES
        │             │
        │         ┌───v───┐
        │         │ RECHAZO
        │         │ "No es socio"
        │         └───────┘
        │
┌──────v─────────────────────────┐
│  4. VALIDAR CONDICIONES         │ ← TÚ LO PROGRAMAS
│  (sueldo mínimo, etc)           │
│  QuotaProcessor.validar()       │
└──────────────┬──────────────────┘
               │
        ┌──────┴──────┐
        │             │
      APROBADO    RECHAZADO
        │             │
        │         ┌───v───┐
        │         │ RESPUESTA
        │         │ "Condiciones no cumplidas"
        │         └───────┘
        │
┌──────v──────────────────────────┐
│  5. CALCULAR CUPO APROBADO      │ ← TÚ LO PROGRAMAS
│  QuotaProcessor.calcularCupo()  │
└──────────────┬──────────────────┘
               │
┌──────────────v──────────────────┐
│  6. ENVIAR RESPUESTA A GMAIL    │
│  "Tu cupo aprobado es: $XXX"    │
└──────────────┬──────────────────┘
               │
┌──────────────v──────────────────┐
│  7. MARCAR COMO LEÍDO           │
│  (para no reprocesar)           │
└──────────────┬──────────────────┘
               │
               ✅ LISTO
```

---

## 🔧 CÓMO INTEGRAR TU BASE DE DATOS EXCEL

### Tu archivo actual

Supongo que tienes un archivo `socios.xlsx` con columnas:
- DNI
- Nombre
- Estado (activo/nuevo/inactivo)
- Deuda

### Paso 1: Copiar a la carpeta correcta

```bash
mkdir -p datos
cp tu_archivo.xlsx datos/socios.xlsx
```

### Paso 2: Actualizar `ExcelService.ts`

Abre `src/services/ExcelService.ts`

**BUSCA:**
```typescript
// ← Aquí está el mock data (datos falsos)
private SOCIOS_DEMO = [
  { dni: '12345678', nombre: 'Juan', estado: 'activo', deuda: 0 },
  // ...
];
```

**REEMPLAZA con:**
```typescript
async cargar(): Promise<void> {
  try {
    // Lee tu archivo real
    const workbook = XLSX.readFile(CONFIG.excel.rutaArchivoSocios);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const datos = XLSX.utils.sheet_to_json(sheet);

    this.socios = datos.map((row: any) => ({
      dni: row.DNI?.toString(),
      nombre: row.Nombre,
      estado: row.Estado.toLowerCase(),
      deuda: row.Deuda || 0,
    }));

    console.log(`✅ Cargados ${this.socios.length} socios desde Excel`);
  } catch (err) {
    console.error('⚠️ Error cargando Excel, usando datos de demo');
  }
}
```

### Paso 3: Instalar librería XLSX

```bash
npm install xlsx
```

### Paso 4: Listo

Ahora el bot usará TU archivo real.

---

## 💰 PROGRAMAR LA LÓGICA DE CUPOS (TÚ)

**Archivo:** `src/services/QuotaProcessor.ts`

Aquí es donde TÚ programas las condiciones para APROBAR o RECHAZAR créditos.

### Estructura Actual

```typescript
export class QuotaProcessor {
  /**
   * AQUÍ DEBES PROGRAMAR TU LÓGICA
   */
  calcularCupo(dni: string, sueldo: number, organismo: string): CalculoCupo {
    // 1. ¿Es socio activo?
    const socio = this.excel.buscarPorDNI(dni);
    if (!socio) {
      return { 
        montoQupo: 0, 
        razon: 'No es socio registrado',
        esNuevoSocio: false,
        tieneDeuda: false,
      };
    }

    // 2. ¿Tiene sueldo mínimo?
    if (sueldo < CONFIG.cupos.minimoSueldo) {
      return { 
        montoQupo: 0, 
        razon: `Sueldo inferior a $${CONFIG.cupos.minimoSueldo}`,
        esNuevoSocio: false,
        tieneDeuda: false,
      };
    }

    // 3. Calcular base
    let cupo = sueldo * CONFIG.cupos.porcentajeDelSueldo;

    // 4. Ajustar por organismo
    const coef = CONFIG.organismos[organismo]?.coeficiente ?? 1.0;
    cupo *= coef;

    // 5. Aplicar límite según tipo de socio
    if (socio.estado === 'nuevo') {
      cupo = Math.min(cupo, CONFIG.cupos.cupoMaximoNuevoSocio);
    } else {
      cupo = Math.min(cupo, CONFIG.cupos.cupoMaximoSocioActivo);
    }

    // 6. Descuento si tiene deuda
    if (socio.deuda > 0) {
      cupo *= CONFIG.cupos.descuentoPorDeuda;
    }

    return {
      montoQupo: Math.round(cupo),
      razon: 'Cupo aprobado',
      esNuevoSocio: socio.estado === 'nuevo',
      tieneDeuda: socio.deuda > 0,
    };
  }
}
```

### ¿Qué TÚ PUEDES CAMBIAR?

1. **Sueldo mínimo**
   ```typescript
   if (sueldo < 50000) { /* rechazar */ }  // Cambia 50000
   ```

2. **Porcentaje de sueldo**
   ```typescript
   cupo = sueldo * 0.30;  // Cambia 0.30 a lo que quieras
   ```

3. **Máximos por tipo de socio**
   ```typescript
   cupoMaximoNuevoSocio: 150000,    // ← Cambia
   cupoMaximoSocioActivo: 500000,   // ← Cambia
   ```

4. **Agregar validaciones adicionales**
   ```typescript
   // Ejemplo: Si tiene deuda superior a X, rechazar
   if (socio.deuda > 1000000) {
     return { montoQupo: 0, razon: 'Deuda muy alta' };
   }

   // Ejemplo: Si es nuevo socio, requerir sueldo mínimo más alto
   if (socio.estado === 'nuevo' && sueldo < 100000) {
     return { montoQupo: 0, razon: 'Nuevo socio requiere sueldo >= $100k' };
   }

   // Ejemplo: Si organismo específico, regla especial
   if (organismo === 'ANDE') {
     cupo *= 1.5;  // ANDE recibe 50% más cupo
   }
   ```

---

## ⚠️ ERRORES COMUNES

### Error: "GEMINI_API_KEY no configurada"

**Solución:**
1. Abre `.env`
2. Busca la línea `GEMINI_API_KEY=`
3. Pega tu clave real: `GEMINI_API_KEY=AIzaSy...`
4. Guarda y reinicia

### Error: "No encuentra correos"

**Solución:**
1. Verifica que los correos tienen asunto "Solicitud"
2. Verifica que están sin leer
3. Ejecuta: `npx ts-node src/diagnose.ts` paso 5

### Error: "No encuentra la base de datos"

**Solución:**
1. Verifica que tu archivo esté en `datos/socios.xlsx`
2. O cambia la ruta en `.env`: `EXCEL_SOCIOS_PATH=./ruta/a/tu/archivo.xlsx`

---

## 🧪 TESTING

### Modo Simulacro (NO envía emails reales)

```bash
export DRY_RUN=true
npx ts-node src/app.ts --once --max=1
```

**Resultado:** Verás en consola qué respuesta enviaría, SIN enviar realmente.

### Con Email Real

1. Envía un email a tu cuenta Gmail con:
   - Asunto: "Solicitud de crédito"
   - Adjunto: PDF con datos de sueldo
   
2. Ejecuta: `npx ts-node src/app.ts --once`

3. Verifica respuesta en tu inbox

---

## 📞 ESTRUCTURA DE RESPUESTA

El bot responde con algo como esto:

```
Para: cliente@example.com
Asunto: Re: Solicitud de crédito

---

Estimado Juan,

Tu solicitud de crédito ha sido procesada.

RESULTADO: APROBADO

Cupo disponible: $250,000
Validez: 30 días

Si tienes preguntas, contáctanos.

---
```

---

## 🔒 SEGURIDAD: QUÉ NO COMITEAR

**Estos archivos NUNCA van a GitHub:**

```
credenciales.json   ← OAuth secrets
token.json          ← Auth tokens
.env                ← Claves y parámetros sensibles
node_modules/       ← Dependencias
```

**Verificar antes de push:**
```bash
git status
# No debería mostrar los archivos de arriba
```

---

## 📚 REFERENCIAS RÁPIDAS

| Necesito | Archivo | Qué cambiar |
|----------|---------|-----------|
| Cambiar claves | `.env` | GEMINI_API_KEY, GMAIL_CREDENTIALS_PATH |
| Agregar organismos | `src/config.ts` | CONFIG.organismos = { ... } |
| Cambiar cupo máximo | `src/config.ts` | CONFIG.cupos.cupoMaximoActivo |
| Programar validación | `src/services/QuotaProcessor.ts` | Método calcularCupo() |
| Leer base de datos | `src/services/ExcelService.ts` | Método cargar() |
| Cambiar búsqueda Gmail | `src/config.ts` | CONFIG.email.busquedaQuery |

---

## ✅ CHECKLIST INICIAL

- [ ] Instalé dependencias: `npm install`
- [ ] Copié `.env.example` a `.env`
- [ ] Configuré GEMINI_API_KEY en `.env`
- [ ] Tengo credenciales.json (OAuth de Gmail)
- [ ] Tengo archivo Excel con socios
- [ ] Ejecuté `npx ts-node src/diagnose.ts` (sin errores)
- [ ] Envié email de prueba
- [ ] Recibí respuesta del bot

---

## 🎯 PRÓXIMOS PASOS

1. **HOY:** Conectar tu Excel real (ExcelService.ts)
2. **HOY:** Programar lógica de cupos (QuotaProcessor.ts)
3. **MAÑANA:** Probar con emails reales
4. **DESPUÉS:** Agregar Gemini (si necesitas analizar PDFs)

---

## 💬 ¿PREGUNTAS?

**¿Cómo cambio el sueldo mínimo?**
→ En `.env` o `src/config.ts`: `CUPO_SUELDO_MINIMO=100000`

**¿Cómo agrego otra condición (ej: sin deuda)?**
→ En `src/services/QuotaProcessor.ts`, método `calcularCupo()`, agrega:
```typescript
if (socio.deuda > 0 && organismo === 'IPS') {
  return { montoQupo: 0, razon: 'No se otorga con deuda en IPS' };
}
```

**¿Cómo conecta con mi Excel?**
→ Ve a sección "CÓMO INTEGRAR TU BASE DE DATOS EXCEL" arriba.

---

**Versión:** 2.0.0 | **Última actualización:** Mayo 7, 2026 | **Estado:** ✅ Funcionando
