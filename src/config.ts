import * as path from 'path';
import * as dotenv from 'dotenv'; // ✅ IMPORTANTE: Faltaba importar esto
import type { ConfiguracionBot } from './types';

// ✅ IMPORTANTE: Activar la lectura del archivo .env
dotenv.config();

const projectRoot = process.cwd();

export const CONFIG: ConfiguracionBot = {
  gmail: {
    credencialesPath: path.join(projectRoot, 'credenciales.json'),
    tokenPath:        path.join(projectRoot, 'token.json'),
    redirectUri:      'http://localhost:3000',
    pollIntervalMs:   5 * 60 * 1000, 
  },
  gemini: {
    // Ahora sí leerá correctamente la clave del archivo .env
    apiKey:     process.env.GEMINI_API_KEY || '',
    modelName:  'gemini-2.0-flash',  
  },
  excel: {
    rutaArchivoSocios: path.join(projectRoot, 'datos', 'socios.xlsx'),
    rutaArchivoMovimientos: path.join(projectRoot, 'datos', 'movimientos.xlsx'),
  },
  cupos: {
    minimoSueldo:          50000,        
    porcentajeDelSueldo:   0.30,         
    cupoMaximoNuevoSocio:  150000,       
    cupoMaximoSocioActivo: 500000,       
    descuentoPorDeuda:     0.50,         
  },
  organismos: {
    'IPS': { coeficiente: 1.0 },
    'Cultura y Educación': { coeficiente: 0.95 },
    'ANDE': { coeficiente: 1.05 },
    'Itaipú': { coeficiente: 1.1 },
    'ANA': { coeficiente: 0.9 },
  },
  email: {
    filtroEtiqueta: 'INBOX',             
    busquedaQuery:  'is:unread subject:(cupo OR solicitud)',  
  },
};

export function validarConfiguracion(): void {
  const errores: string[] = [];
  if (!CONFIG.gemini.apiKey) {
    errores.push('❌ GEMINI_API_KEY no definida. Crea un archivo .env en la raíz con tu clave.');
  }
  if (errores.length > 0) {
    console.error('\n⚠️  PROBLEMAS DE CONFIGURACIÓN:\n');
    errores.forEach(e => console.error(e));
    process.exit(1);
  }
  console.log('✅ Configuración validada exitosamente');
}

export function imprimirConfiguracion(): void {
  console.log('\n📋 CONFIGURACIÓN ACTUAL:');
  console.log('─'.repeat(50));
  console.log(`Gmail Poll Interval:   ${CONFIG.gmail.pollIntervalMs / 1000}s`);
  console.log(`Gemini Model:          ${CONFIG.gemini.modelName}`);
  console.log(`Excel Socios:          ${CONFIG.excel.rutaArchivoSocios}`);
  console.log('─'.repeat(50) + '\n');
}