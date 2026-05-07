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