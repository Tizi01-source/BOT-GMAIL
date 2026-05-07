/**
 * types.ts
 * 
 * Tipos compartidos en toda la aplicación
 * Centraliza las interfaces para mantener consistencia
 */

// ────────────────────────────────────────────
// GMAIL
// ────────────────────────────────────────────

export interface CorreoSolicitud {
  id:       string;
  threadId: string;
  fecha:    string;
  de:       string;
  asunto:   string;
  cuerpo:   string;
  labelIds: string[];
  adjuntos?: AdjuntoCorreo[];
}

export interface AdjuntoCorreo {
  id:           string;
  nombre:       string;
  tipo:         string;  // 'image/png', 'application/pdf', etc
  datos:        Buffer;
}

// ────────────────────────────────────────────
// SOCIOS
// ────────────────────────────────────────────

export interface Socio {
  id:              string;
  nombre:          string;
  dni:             string;
  correo:          string;
  estado:          'activo' | 'inactivo' | 'suspendido';
  esNuevo:         boolean;
  tieneDeuda:      boolean;
  montoDeuda?:     number;
  estadoCredito:   'activo' | 'en_refinanciacion' | 'pagado' | 'ninguno';
  deudaRefinanciacion?: number;
  fechaRegistro?:  string;
}

// ────────────────────────────────────────────
// RECIBOS
// ────────────────────────────────────────────

export interface DatosRecibo {
  dni:           string;
  organismo:     string;      // 'IPS', 'Cultura y Educación', etc
  sueldoNeto:    number;
  periodo?:      string;       // 'Marzo 2024', etc
  confianza?:    number;       // 0-100, qué tan seguro está la IA
}

export interface AnalisisReciboPDF {
  exitoso:       boolean;
  datos?:        DatosRecibo;
  error?:        string;
  tiempoMs?:     number;
}

// ────────────────────────────────────────────
// CUPOS
// ────────────────────────────────────────────

export interface CalculoCupo {
  dni:           string;
  montoQupo:     number;
  razon:         string;            // Por qué ese monto
  esNuevoSocio:  boolean;
  tieneDeuda:    boolean;
  organismo:     string;
  sueldoNeto:    number;
}

// ────────────────────────────────────────────
// RESPUESTAS
// ────────────────────────────────────────────

export interface RespuestaAutomatica {
  para:          string;
  asunto:        string;
  cuerpo:        string;
  threadId:      string;
  templateUsada: string;
}

// ────────────────────────────────────────────
// PROCESAMIENTO
// ────────────────────────────────────────────

export interface ResultadoProcesoEmail {
  correoId:      string;
  exitoso:       boolean;
  paso:          'lectura' | 'extraccion_adjuntos' | 'analisis_recibo' | 'busqueda_socio' | 'calculo_cupo' | 'respuesta';
  error?:        string;
  respuesta?:    RespuestaAutomatica;
  tiempoMs?:     number;
  detalles?:     Record<string, any>;
}

// ────────────────────────────────────────────
// CONFIGURACIÓN
// ────────────────────────────────────────────

export interface ConfiguracionBot {
  gmail: {
    credencialesPath: string;
    tokenPath:        string;
    redirectUri:      string;
    pollIntervalMs:   number;    // Cada cuántos ms chequea nuevos emails
  };
  gemini: {
    apiKey:          string;
    modelName:       string;
  };
  excel: {
    rutaArchivoSocios: string;
    rutaArchivoMovimientos?: string;
  };
  cupos: {
    minimoSueldo:           number;   // Sueldo mínimo para tener cupo
    porcentajeDelSueldo:    number;   // 30%, 40%, etc
    cupoMaximoNuevoSocio:   number;
    cupoMaximoSocioActivo:  number;
    descuentoPorDeuda:      number;   // Porcentaje de descuento
  };
  organismos: {
    // Ponderación por organismo (ej: IPS es más confiable)
    [key: string]: { coeficiente: number };
  };
  email: {
    filtroEtiqueta:   string;     // 'Solicitudes', 'No leídos', etc
    busquedaQuery:    string;     // Ej: 'from:comercial@...'
  };
}
