/**
 * GeminiService.ts
 * 
 * Servicio de análisis de PDFs y imágenes con Gemini AI
 * Responsable de:
 *  - Enviar recibos/imágenes a Gemini
 *  - Extraer datos estructurados (DNI, organismo, sueldo)
 *  - Validar calidad de extracción
 * 
 * Uso:
 *  const gemini = new GeminiService();
 *  const datos = await gemini.analizarRecibo(bufferPDF);
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { CONFIG } from '../config';
import type { DatosRecibo, AnalisisReciboPDF } from '../types';

export class GeminiService {
  private cliente: GoogleGenerativeAI;
  private modelo: string;

  constructor() {
    if (!CONFIG.gemini.apiKey) {
      throw new Error(
        '❌ GEMINI_API_KEY no configurada.\n' +
        'Establece: export GEMINI_API_KEY=tu_clave_api'
      );
    }

    this.cliente = new GoogleGenerativeAI(CONFIG.gemini.apiKey);
    this.modelo = CONFIG.gemini.modelName;
  }

  /**
   * Analiza un recibo (PDF o imagen) y extrae datos estructurados
   * 
   * @param buffer - Contenido del archivo (PDF o imagen)
   * @param nombreArchivo - Nombre del archivo (para diagnosticar tipo MIME)
   * @param tipoMime - Tipo MIME explicit (ej: 'image/png', 'application/pdf')
   * @returns Datos extraídos o error
   */
  async analizarRecibo(
    buffer: Buffer,
    nombreArchivo: string,
    tipoMime: string
  ): Promise<AnalisisReciboPDF> {
    const tiempoInicio = Date.now();

    try {
      console.log(
        `🤖 Analizando recibo: ${nombreArchivo} (${buffer.length} bytes)`
      );

      // Validar tipo MIME
      const tipoValido = this.validarTipoMime(tipoMime);
      if (!tipoValido) {
        return {
          exitoso: false,
          error: `Tipo de archivo no soportado: ${tipoMime}`,
        };
      }

      // Enviar a Gemini
      const datos = await this.extraerDatos(buffer, tipoMime);

      // Validar que extrajimos los datos correctamente
      if (!this.validarDatos(datos)) {
        return {
          exitoso: false,
          error: 'Los datos extraídos están incompletos o inválidos',
        };
      }

      const tiempoMs = Date.now() - tiempoInicio;

      console.log(`✅ Recibo analizado exitosamente:`);
      console.log(`   DNI:       ${datos.dni}`);
      console.log(`   Organismo: ${datos.organismo}`);
      console.log(`   Sueldo:    $${datos.sueldoNeto}`);
      console.log(`   Tiempo:    ${tiempoMs}ms`);

      return {
        exitoso: true,
        datos,
        tiempoMs,
      };
    } catch (err: any) {
      const tiempoMs = Date.now() - tiempoInicio;
      const mensaje =
        err instanceof Error ? err.message : String(err);

      console.error(`❌ Error analizando recibo:`, mensaje);

      return {
        exitoso: false,
        error: mensaje,
        tiempoMs,
      };
    }
  }

  /**
   * Extrae datos estructurados del recibo usando Gemini
   */
  private async extraerDatos(
    buffer: Buffer,
    tipoMime: string
  ): Promise<DatosRecibo> {
    // Convertir buffer a base64
    const base64 = buffer.toString('base64');

    // Prompt específico para extraer datos de recibos
    const prompt = `
Analiza este recibo de sueldo o comprobante de pago.

IMPORTANTE: Debes responder ÚNICAMENTE en JSON, sin explicaciones adicionales.

Extrae EXACTAMENTE estos campos:
{
  "dni": "número sin puntos, ej: 12345678",
  "organismo": "nombre del organismo, ej: IPS, Cultura y Educación, ANDE, Itaipú, ANA",
  "sueldoNeto": número sin símbolos, ej: 2500000,
  "periodo": "período del recibo, ej: Marzo 2024",
  "confianza": número entre 0 y 100 indicando qué tan seguro estás
}

Si no puedes encontrar un campo, usa null.
RESPONDE SOLO CON EL JSON, sin markdown ni explicaciones.
    `;

    const modeloGen = this.cliente.getGenerativeModel({
      model: this.modelo,
    });

    // Preparar contenido con imagen/PDF
    const contenido = [
      {
        inlineData: {
          data: base64,
          mimeType: tipoMime,
        },
      },
      {
        text: prompt,
      },
    ];

    // Llamar a Gemini
    const resultado = await modeloGen.generateContent(contenido);
    const respuesta = resultado.response.text();

    // Parsear respuesta JSON
    const jsonLimpio = respuesta
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const datos = JSON.parse(jsonLimpio) as DatosRecibo;

    // Normalizar DNI (remover puntos, espacios)
    if (datos.dni) {
      datos.dni = datos.dni
        .replace(/[.\s-]/g, '')
        .trim();
    }

    // Normalizar organismo (capitalización)
    if (datos.organismo) {
      datos.organismo = datos.organismo.trim();
    }

    return datos;
  }

  /**
   * Valida que el tipo MIME sea soportado
   */
  private validarTipoMime(tipoMime: string): boolean {
    const tiposSoportados = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'application/pdf',
    ];

    return tiposSoportados.includes(tipoMime);
  }

  /**
   * Valida que los datos extraídos sean completos
   */
  private validarDatos(datos: DatosRecibo): boolean {
    // Validar que al menos DNI, organismo y sueldo estén presentes
    const tieneValores =
      datos.dni &&
      datos.organismo &&
      datos.sueldoNeto !== null &&
      datos.sueldoNeto !== undefined;

    if (!tieneValores) {
      return false;
    }

    // Validar formato del DNI (números únicamente)
    if (!/^\d+$/.test(datos.dni)) {
      return false;
    }

    // Validar que el sueldo sea un número positivo
    if (typeof datos.sueldoNeto !== 'number' || datos.sueldoNeto <= 0) {
      return false;
    }

    return true;
  }
}
