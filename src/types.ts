// Molde para archivos adjuntos de un correo.
export interface AdjuntoCorreo {
  id: string; // Id interno único del adjunto dentro del correo.
  nombre: string; // Nombre del archivo, ej: "recibo.pdf".
  tipo: string; // Tipo de Archivo, ej: "pdf" o "jpeg".
  datos: Buffer; // El contenido del archivo en formato Buffer.
}

// Molde para los correos que cumplen la búsqueda.
export interface CorreoSolicitud {
  id: string; // Id del correo en Gmail.
  threadId: string; // Id del hilo de conversación en Gmail.
  fecha: string; // Fecha del correo.
  de: string; // Dirección de correo del remitente.
  asunto: string; // Asunto del correo.
  cuerpo: string; // Texto plano del cuerpo del correo.
  labelIds: string[]; // IDs de las etiquetas asignadas al correo.
  adjuntos: AdjuntoCorreo[]; // Lista de archivos adjuntos encontrados en el correo.
}

// Molde para el resultado del análisis de los legajos por parte de Gemini. Este es el formato que esperamos recibir de Gemini después de enviarle los documentos para su análisis.
export interface ResultadoAuditoria {
  nombreCompleto: string; // Nombre completo del cliente, extraído de los documentos.
  dni: string; // Número de DNI del cliente, sin puntos ni espacios, extraído de los documentos.
  organismo: string; // Organismo del cliente, extraído de los documentos (ej: SPB, Educación, etc).
  sueldoNetoRecibo: number; // El sueldo neto que figura en el recibo de sueldo, extraído del documento.
  fechaCobro: string; // La fecha en que se le depositó el sueldo al cliente, extraída de los movimientos bancarios.
  sueldoDepositado: number; // El monto del sueldo en los movimientos bancarios, extraído de los documentos.
  coincideSueldo: boolean; // Indica si el sueldo depositado coincide o es casi igual al sueldo del recibo.
  totalDescuentosDelDia: number; // El total de descuentos que se le hicieron al cliente en el día del cobro.
  saldoSobranteDelDia: number; // El sobrante que quedó en la cuenta después de recibir el sueldo y los descuentos.
  montoCuotaMaximo: number; // El monto máximo de cuota que el cliente podría pagar según su capacidad de pago.
  contieneReversiones: boolean; // Indica si en los movimientos bancarios hay reversiones.
  aptoParaEvaluar: boolean; // Indica si el legajo es apto para evaluar la solicitud de cupo.
  esSocio: boolean | null; // Indica si el cliente es socio de la cooperativa, o no.
}