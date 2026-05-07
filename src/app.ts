import { GmailService } from './services/GmailService';

async function probarConexion() {
  const gmail = new GmailService();
  
  try {
    console.log('Iniciando conexión con el correo de pruebas...');
    
    // 1. Inicializar (esto abrirá el navegador si no hay token)
    await gmail.init(); 

    // 2. Obtener los últimos 10 correos que coincidan con la búsqueda
    const correos = await gmail.obtenerSolicitudes(10);

    if (correos.length === 0) {
      console.log('✅ Conexión exitosa, pero no se encontraron correos sin leer con los filtros actuales.');
      return;
    }

    console.log(`\n📬 Se encontraron ${correos.length} correos nuevos:`);
    correos.forEach((correo, index) => {
      console.log(`\n--- Correo #${index + 1} ---`);
      console.log(`De:      ${correo.de}`);
      console.log(`Asunto:  ${correo.asunto}`);
      console.log(`Fecha:   ${correo.fecha}`);
      console.log(`Adjuntos: ${correo.adjuntos?.length ?? 0}`);
    });

  } catch (error: any) {
    console.error('❌ Error en la prueba:', error.message);
  }
}

probarConexion();