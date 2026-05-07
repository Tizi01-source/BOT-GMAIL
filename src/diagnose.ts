import { promises as fs } from 'fs';
import * as path from 'path'; // ✅ IMPORTANTE: Faltaba esta línea
import { CONFIG, validarConfiguracion } from './config';
import { GmailService } from './services/GmailService';

const CREDENTIALS_PATH = path.join(process.cwd(), 'credenciales.json');
const TOKEN_PATH = path.join(process.cwd(), 'token.json');

async function diagnosticar() {
  console.clear();
  console.log('\n' + '═'.repeat(70));
  console.log('🔍 DIAGNÓSTICO DEL BOT DE SOLICITUDES DE CRÉDITO');
  console.log('═'.repeat(70) + '\n');

  try {
    console.log('1️⃣  VALIDANDO CONFIGURACIÓN...');
    validarConfiguracion();
    console.log('   ✅ Configuración válida\n');

    console.log('2️⃣  Verificando credenciales.json...');
    const credsRaw = await fs.readFile(CREDENTIALS_PATH, 'utf-8');
    const creds = JSON.parse(credsRaw);
    const key = creds.installed ?? creds.web;
    if (!key) throw new Error('No encontré "installed" ni "web"');
    console.log('   ✅ credenciales.json válido\n');

    console.log('3️⃣  Verificando token.json...');
    try {
      await fs.readFile(TOKEN_PATH, 'utf-8');
      console.log('   ✅ Token encontrado\n');
    } catch (err: any) {
      console.log('   ℹ️  Token no existe (se requiere autenticación)\n');
    }

    console.log('4️⃣  Inicializando GmailService...');
    const gmail = new GmailService();
    await gmail.init();
    console.log('   ✅ GmailService inicializado correctamente\n');

    console.log('5️⃣  Realizando prueba de lectura de API...');
    // ✅ CORRECCIÓN: Copilot había puesto getCorreosSolicitud, pero la función correcta es obtenerSolicitudes
    const correos = await gmail.obtenerSolicitudes(5);
    console.log(`   ✅ Conexión exitosa. Correos no leídos: ${correos.length}\n`);

    console.log('✅ TODAS LAS PRUEBAS PASARON');
  } catch (err: any) {
    console.error('\n❌ DIAGNÓSTICO FALLIDO:', err.message);
  }
}

diagnosticar();