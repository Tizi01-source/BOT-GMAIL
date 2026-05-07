/**
 * app.ts
 * 
 * Aplicación principal del Bot de Solicitudes de Crédito
 * 
 * CARACTERÍSTICAS:
 * ✅ Lee correos de solicitud de crédito
 * ✅ Extrae datos de recibos (PDF/imágenes)
 * ✅ Usa Gemini AI para analizar documentos
 * ✅ Busca datos del socio en Excel
 * ✅ Calcula cupo automáticamente
 * ✅ Envía respuestas personalizadas
 * ✅ Procesa múltiples solicitudes en lote
 * 
 * USO:
 * npx ts-node src/app.ts [opciones]
 * 
 * OPCIONES:
 * --once         Procesa una sola vez y sale
 * --max=N        Máximo N correos a procesar
 * --diagnose     Ejecuta diagnóstico primero
 */

import { GmailService } from './services/GmailService';
import { GeminiService } from './services/GeminiService';
import { ExcelService } from './services/ExcelService';
import { QuotaProcessor } from './services/QuotaProcessor';
import { EmailProcessor } from './services/EmailProcessor';
import { CONFIG, validarConfiguracion, imprimirConfiguracion } from './config';

// ──────────────────────────────────────────────
// FUNCIÓN PRINCIPAL
// ──────────────────────────────────────────────

async function main() {
  console.clear();
  console.log('\n' + '╔' + '═'.repeat(58) + '╗');
  console.log('║' + ' BOT DE SOLICITUDES DE CRÉDITO '.padEnd(58) + '║');
  console.log('╚' + '═'.repeat(58) + '╝\n');

  // Validar configuración
  try {
    validarConfiguracion();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }

  // Imprimir configuración
  imprimirConfiguracion();

  // Parsear argumentos de línea de comandos
  const args = process.argv.slice(2);
  const opciones = {
    once: args.includes('--once'),
    diagnose: args.includes('--diagnose'),
    dryRun: args.includes('--dry-run') || process.env.DRY_RUN === 'true',
    max: parseInt(args.find(a => a.startsWith('--max='))?.split('=')[1] ?? '20'),
  };

  console.log('⚙️  OPCIONES:');
  console.log(`   --once:     ${opciones.once ? '✅ Sí' : '❌ No (ejecutar continuamente)'}`);
  console.log(`   --diagnose: ${opciones.diagnose ? '✅ Sí' : '❌ No'}`);
  console.log(`   --dry-run:  ${opciones.dryRun ? '✅ MODO SIMULACRO (no envía emails)' : '❌ No (envía emails reales)'}`);
  console.log(`   --max:      ${opciones.max} correos\n`);

  try {
    // ──────────────────────────────────────────────
    // INICIALIZAR SERVICIOS
    // ──────────────────────────────────────────────

    console.log('🚀 Inicializando servicios...\n');

    // Gmail
    const gmail = new GmailService();
    await gmail.init();

    // Gemini
    const gemini = new GeminiService();
    console.log('🤖 Gemini Service listo\n');

    // Excel
    const excel = new ExcelService();
    await excel.cargar();

    // Mostrar estadísticas
    const stats = excel.obtenerEstadisticas();
    console.log('📊 Estadísticas de socios:');
    console.log(`   Total:          ${stats.totalSocios}`);
    console.log(`   Activos:        ${stats.sociosActivos}`);
    console.log(`   Con deuda:      ${stats.sociosConDeuda}`);
    console.log(`   Nuevos:         ${stats.sociosNuevos}`);
    console.log(`   Deuda total:    $${stats.deudaTotal.toLocaleString('es-AR')}\n`);

    // Quota Processor
    const quota = new QuotaProcessor(excel);

    // Email Processor
    const procesador = new EmailProcessor(gmail, gemini, excel, quota, opciones.dryRun);

    // ──────────────────────────────────────────────
    // PROCESAMIENTO
    // ──────────────────────────────────────────────

    if (opciones.once) {
      // Modo una sola vez
      console.log('📋 Modo: Procesar UNA SOLA VEZ\n');

      const correos = await gmail.obtenerSolicitudes(opciones.max);

      if (correos.length === 0) {
        console.log('✅ No hay solicitudes pendientes.\n');
      } else {
        await procesador.procesarMultiples(correos);
      }
    } else {
      // Modo continuo (polling)
      console.log('📋 Modo: PROCESAMIENTO CONTINUO\n');
      console.log(
        `⏰ Chequeando cada ${CONFIG.gmail.pollIntervalMs / 1000} segundos...\n`
      );

      let iteracion = 0;

      const ejecutarCiclo = async () => {
        iteracion++;

        console.log(
          `\n[${new Date().toLocaleTimeString('es-AR')}] Ciclo #${iteracion}`
        );
        console.log('─'.repeat(60));

        try {
          const correos = await gmail.obtenerSolicitudes(opciones.max);

          if (correos.length === 0) {
            console.log('   ✅ No hay nuevas solicitudes');
          } else {
            console.log(
              `   📧 Encontrados ${correos.length} correo(s) - procesando...`
            );
            await procesador.procesarMultiples(correos);
          }
        } catch (err) {
          console.error(
            '❌ Error en ciclo:',
            err instanceof Error ? err.message : err
          );
        }

        // Programar siguiente ciclo
        setTimeout(ejecutarCiclo, CONFIG.gmail.pollIntervalMs);
      };

      // Ejecutar primer ciclo inmediatamente
      await ejecutarCiclo();
    }
  } catch (err: any) {
    console.error('\n❌ ERROR CRÍTICO:', err.message);
    console.error('\nStack:', err.stack);
    process.exit(1);
  }
}

// ──────────────────────────────────────────────
// EJECUTAR
// ──────────────────────────────────────────────

main().catch(err => {
  console.error('❌ Error no capturado:', err);
  process.exit(1);
});
