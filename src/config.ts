import * as path from 'path'; // Importamos path para manejar rutas de archivos.

// Current Working Directory, guarda la ruta raíz del proyecto para usarla al construir rutas de archivos.
const projectRoot = process.cwd();
// Estaria guardando la ruta absoluta del proyecto, algo como: C:\TrabajoMaycoopProgramacion\BOT-GMAIL-CUPOS.


// Exportamos un objeto de configuración con las rutas necesarias para Gmail y otros parámetros.
export const CONFIG = {
  gmail: {
    credencialesPath: path.join(projectRoot, 'credenciales.json'),
    // Une la constante projectRoot con 'credenciales.json' para obtener la ruta absoluta del archivo de credenciales.
    tokenPath:        path.join(projectRoot, 'token.json'),
    // Une la constante projectRoot con 'token.json' para obtener la ruta absoluta del archivo de token.
    redirectUri:      'http://localhost:3000',
    // URI de redirección para el proceso de autenticación OAuth2.
  },
  email: {
    busquedaQuery:  'is:unread subject:(cupo OR solicitud) -subjetct:re', 
    // Es para buscar correos no leídos con asunto que contenga "cupo" o "solicitud".
    // Si quisieras buscar solo "cupo", podrías usar: 'is:unread subject:cupo'
    // Si querés que el bot solo atienda a ciertos comercios y no a cualquier persona que mande un mail a la cooperativa, podés obligar a que el remitente sea uno de tu lista. Ej: from:(juan@gmail.com OR ariel@hotmail.com)
  },
  sheets: {
    // ID de la hoja de cálculo de Google Sheets donde se guardarán los datos.
    spreadsheetId: '1HPxRr8e4QF1EIzCbGiE8gH6t5AS5ps1rBMOCO-bDea8', 
    // Rango de celdas en la hoja "Consultas" donde se guardarán los datos (desde A1 hasta I).
    rangoConsultas: 'Consultas!A:I',
  }
};