export interface AdjuntoCorreo {
  id: string;
  nombre: string;
  tipo: string;
  datos: Buffer; // Acá vive el PDF/Imagen descargado
}

export interface CorreoSolicitud {
  id: string;
  threadId: string;
  fecha: string;
  de: string;
  asunto: string;
  cuerpo: string;
  labelIds: string[];
  adjuntos: AdjuntoCorreo[];
}