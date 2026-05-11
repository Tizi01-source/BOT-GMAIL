// Libreria oficial de Google para acceder a Gemini.
import { GoogleGenerativeAI } from '@google/generative-ai';
// Interfaz creado en types.ts para manejar los adjuntos de los correos.
import type { AdjuntoCorreo } from '../types';

// Servicio encargado de interactuar con Gemini, enviarle los archivos adjuntos y recibir el análisis.
export class GeminiService {
  private ai: GoogleGenerativeAI; // Instancia de la librería de Google para Gemini.
  private modelo: any; // Aquí guardamos el modelo de Gemini que vamos a usar (ej: 'gemini-3-flash-preview').

  // Constructor que inicializa la conexión con Gemini usando la clave API del archivo .env
  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || ''; // Aseguramos que la clave API esté presente.
    if (!apiKey) {
      throw new Error('❌ Falta la clave GEMINI_API_KEY en el archivo .env');
    }
    
    // Inicializamos la conexión con Gemini y seleccionamos el modelo que vamos a usar.
    this.ai = new GoogleGenerativeAI(apiKey);
    this.modelo = this.ai.getGenerativeModel({ model: 'gemini-3-flash-preview' });
  }

  // Recibe todos los adjuntos de un correo juntos, los cruza y extrae el análisis completo.
  async analizarLegajoCompleto(adjuntos: AdjuntoCorreo[]) {
    try {
      console.log(`🧠 Gemini analizando los ${adjuntos.length} documentos en conjunto...`);

      // Filtramos y preparamos TODOS los archivos para mandarlos juntos.
      const archivosParaIA = adjuntos
      // Filtra solo los archivos que son PDF o imágenes, y los convierte al formato que Gemini acepta (base64 + mimeType).
        .filter(a => a.tipo.includes('pdf') || a.tipo.includes('image')) 
        // .map Esto es un traductor. 
        .map(a => ({
          inlineData: {
            // Agarra esos Bytes crudos (a.datos) y los convierte a base64, que es el formato que Gemini entiende para archivos.
            data: a.datos.toString('base64'), 
            // Tambien le dice a Gemini qué tipo de archivo es (pdf, jpeg, etc) para que lo procese correctamente.
            mimeType: a.tipo, 
          },
        }));

        // Si después de filtrar no quedó ningún PDF o imagen, el código hace un return null y no hace la consulta para no gastar tokens.
      if (archivosParaIA.length === 0) return null;

      // Instrucciones exactas de auditoría
      const prompt = `
        Sos un analista de riesgo crediticio experto de Argentina.
        Te adjunto el legajo de un cliente que incluye Recibo de Sueldo y Extractos Bancarios (Movimientos).
        
        Tu trabajo es cruzar la información de todos los documentos y devolver ÚNICAMENTE un JSON válido con esta estructura:
        {
          "nombreCompleto": "Nombre y Apellido",
          "dni": "Número sin puntos",
          "organismo": "Empresa o entidad donde trabaja (ej: SPB, Educacion, etc)",
          "sueldoNetoRecibo": Número (el sueldo de bolsillo según el recibo),
          "fechaCobro": "Día que se le depositó el sueldo en el banco (ej: 01/04)",
          "sueldoDepositado": Número (el ingreso en los movimientos que corresponde al sueldo),
          "coincideSueldo": Booleano (true si el sueldoDepositado es igual o casi igual al recibo),
          "totalDescuentosDelDia": Número,
          "saldoSobranteDelDia": Número,
          "montoCuotaMaximo": Número,
          "contieneReversiones": Booleano,
          "aptoParaEvaluar": Booleano,
          "esSocio": null
        }

        REGLAS PARA CALCULAR LOS DESCUENTOS Y EL SALDO SOBRANTE:
        1. Buscá en los movimientos el día exacto en que ingresó el sueldo.
        2. Fijate el saldo que tenía la cuenta inmediatamente DESPUÉS de que entró el sueldo.
        3. Buscá el ÚLTIMO débito/descuento que se hizo ESE MISMO DÍA.
        4. El "saldoSobranteDelDia" es el saldo que le quedó después de ese último débito del día de cobro.
        5. El "totalDescuentosDelDia" es la diferencia entre el saldo post-sueldo y el saldoSobranteDelDia.
        6. "montoCuotaMaximo": Es el (saldoSobranteDelDia - 100000). Este es el margen real.
        7. "contieneReversiones": Marcá true si encontrás palabras como "REVERSION", "DEVOLUCION" o "ANULACION" en los movimientos del mes.
        8. "aptoParaEvaluar": Solo es true SI ("montoCuotaMaximo" > 200000) Y ("contieneReversiones" es false).
        9. "esSocio": Dejalo como null por ahora.

        Devolvé el resultado ÚNICAMENTE en formato JSON, sin markdown ni comillas triples. Si un dato no existe, poné null.
      `;

      // Mandamos la orden con todos los archivos al mismo tiempo.
      // Los tres puntitos (...) hacen que el array de archivos se "desarme" y cada archivo se mande como un argumento separado junto con el prompt.
      const resultado = await this.modelo.generateContent([prompt, ...archivosParaIA]);
      const respuestaTexto = resultado.response.text();

      // Limpiamos la respuesta de la IA y convertimos a JSON.
      const textoLimpio = respuestaTexto.replace(/```json/g, '').replace(/```/g, '').trim();
      const datosExtraidos = JSON.parse(textoLimpio);

      console.log('✅ ¡Auditoría de Gemini completada!');
      return datosExtraidos;

    } catch (error: any) {
      console.error(`❌ Error al analizar legajo con Gemini:`, error.message);
      return null;
    }
  }
}