import { GmailService } from './services/GmailService'; // Servicio para interactuar con Gmail
import { GeminiService } from './services/GeminiService'; // Servicio para interactuar con Gemini.
import * as dotenv from 'dotenv'; // Para cargar las variables de entorno desde el archivo .env

dotenv.config(); // Carga las variables de entorno. (Clave de API, etc)

// Función de utilidad para esperar cierta cantidad de milisegundos (usada para pausar entre correos).
const esperar = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Función principal que arranca el bot, obtiene los correos, procesa los adjuntos con Gemini y muestra los resultados.
async function arrancarBot() {
  const gmail = new GmailService(); // Instancia del servicio de Gmail para interactuar con la API de Gmail.
  const gemini = new GeminiService(); // Instancia del servicio de Gemini para interactuar con la API de Gemini.
  
  try {
    console.log('🚀 Iniciando Bot...');

    // Inicializamos la conexión con Gmail (credenciales.json y token.json).
    await gmail.init(); 

    // Obtenemos los últimos 5 correos que cumplen con los criterios.
    const correos = await gmail.obtenerSolicitudes(5);

    // Si no hay correos nuevos, terminamos la ejecución.
    if (correos.length === 0) {
      console.log('✅ No hay correos nuevos.');
      return;
    }

    console.log(`\n📬 Se encontraron ${correos.length} correos nuevos.\n`);

    // Procesamos cada correo uno por uno.
    for (const correo of correos) {
      console.log(`\n--- Procesando correo de: ${correo.de} ---`);
      console.log(`Asunto: ${correo.asunto}`);
      
      // Verificamos si el correo tiene adjuntos. Si los tiene, los enviamos a Gemini para su análisis.
      // Si no tiene nada, no llamamos a la IA para no gastar tokens.
      if (correo.adjuntos.length > 0) {

        // Le pasamos todos los archivos juntos para que los analice en conjunto y cruce la información entre ellos.
        const auditoria = await gemini.analizarLegajoCompleto(correo.adjuntos);
        
        if (auditoria) {
          console.log('\n📊 AUDITORÍA DEL CLIENTE:');
          console.dir(auditoria, { colors: true }); // Imprime el resultado de la auditoría en consola de forma legible.
          console.log('-----------------------------------\n');
        }
      } else {
        console.log('No hay archivos adjuntos en este correo.');
      }

      // Pausa de 10 segundos entre cada correo para evitar saturar la API de Gemini.
      await esperar(10000);
    }

  } catch (error: any) {
    console.error('❌ Error general:', error.message);
  }
}

arrancarBot();