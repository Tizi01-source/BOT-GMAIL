import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AdjuntoCorreo } from '../types';

export class GeminiService {
  private ai: GoogleGenerativeAI;
  private modelo: any;

  constructor() {
    // Inicializamos Gemini usando la clave secreta de tu archivo .env
    const apiKey = process.env.GEMINI_API_KEY || '';
    if (!apiKey) {
      throw new Error('❌ Falta la clave GEMINI_API_KEY en el archivo .env');
    }
    
    this.ai = new GoogleGenerativeAI(apiKey);
    // Usamos el modelo flash que es rapidísimo y lee PDFs/imágenes
    this.modelo = this.ai.getGenerativeModel({ model: 'gemini-3-flash-preview' });
  }

  /**
   * Recibe un adjunto (PDF o Imagen), lo lee y extrae los datos clave.
   */
  async extraerDatos(adjunto: AdjuntoCorreo) {
    try {
      console.log(`🧠 Gemini analizando el archivo: ${adjunto.nombre}...`);

      // 1. Convertimos el archivo al formato que entiende Gemini (Base64)
      const archivoParaIA = {
        inlineData: {
          data: adjunto.datos.toString('base64'),
          mimeType: adjunto.tipo,
        },
      };

      // 2. Le damos las instrucciones claras de qué buscar
      const prompt = `
        Sos un asistente financiero experto. Analizá este documento (puede ser un recibo de sueldo o un DNI).
        Extraé la siguiente información y devolvela ÚNICAMENTE en formato JSON válido, sin usar markdown (sin las comillas triples de json).
        Si no encontrás un dato, poné null.
        
        Estructura requerida:
        {
          "nombreCompleto": "Nombre y Apellido",
          "dni": "Número sin puntos",
          "sueldoNeto": Número (solo el valor numérico, sin signos ni puntos de miles)
        }
      `;

      // 3. Mandamos la orden a Google
      const resultado = await this.modelo.generateContent([prompt, archivoParaIA]);
      const respuestaTexto = resultado.response.text();

      // 4. Limpiamos la respuesta y la convertimos a un objeto de JavaScript
      const textoLimpio = respuestaTexto.replace(/```json/g, '').replace(/```/g, '').trim();
      const datosExtraidos = JSON.parse(textoLimpio);

      console.log('✅ ¡Gemini terminó de leer!');
      return datosExtraidos;

    } catch (error: any) {
      console.error(`❌ Error al analizar con Gemini el archivo ${adjunto.nombre}:`, error.message);
      return null;
    }
  }
}