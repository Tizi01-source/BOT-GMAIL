import { GmailService } from './services/GmailService';
import { GeminiService } from './services/GeminiService';
import * as dotenv from 'dotenv';

dotenv.config();

// 👇 Función mágica para hacer que el bot "respire"
const esperar = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function arrancarBot() {
  const gmail = new GmailService();
  const gemini = new GeminiService();
  
  try {
    console.log('🚀 Iniciando Bot...');
    await gmail.init(); 

    const correos = await gmail.obtenerSolicitudes(5);

    if (correos.length === 0) {
      console.log('✅ No hay correos nuevos.');
      return;
    }

    console.log(`\n📬 Se encontraron ${correos.length} correos nuevos.\n`);

    for (const correo of correos) {
      console.log(`--- Procesando correo de: ${correo.de} ---`);
      
      // 🛑 TRUCO TEMPORAL: Le mandamos SOLO el primer archivo (el recibo) para no saturar los tokens gratis
      if (correo.adjuntos.length > 0) {
        const primerAdjunto = correo.adjuntos[0];
        const datosExtraidos = await gemini.extraerDatos(primerAdjunto);
        
        if (datosExtraidos) {
          console.log('\n📊 DATOS EXTRAÍDOS POR LA IA:');
          console.dir(datosExtraidos, { colors: true });
          console.log('-----------------------------------\n');
        }
      } else {
        console.log('No hay archivos adjuntos en este correo.');
      }
    }

  } catch (error: any) {
    console.error('❌ Error general:', error.message);
  }
}

arrancarBot();