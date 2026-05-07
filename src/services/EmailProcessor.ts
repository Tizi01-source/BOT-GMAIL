/**
 * EmailProcessor.ts
 * 
 * Procesador principal de emails de solicitud
 * Orquesta todo el flujo:
 *  - Lee correo
 *  - Extrae adjuntos
 *  - Analiza recibos con Gemini
 *  - Busca socio en Excel
 *  - Calcula cupo
 *  - Genera y envía respuesta
 * 
 * Uso:
 *  const procesador = new EmailProcessor(gmail, gemini, excel, quota);
 *  const resultado = await procesador.procesarSolicitud(correo);
 */

import { GmailService } from './GmailService';
import { GeminiService } from './GeminiService';
import { ExcelService } from './ExcelService';
import { QuotaProcessor } from './QuotaProcessor';
import type { CorreoSolicitud, ResultadoProcesoEmail } from '../types';

export class EmailProcessor {
  private dryRun: boolean;

  constructor(
    private gmail: GmailService,
    private gemini: GeminiService,
    private excel: ExcelService,
    private quota: QuotaProcessor,
    dryRun: boolean = false
  ) {
    this.dryRun = dryRun;
  }

  /**
   * Procesa una solicitud de crédito completa
   */
  async procesarSolicitud(
    correo: CorreoSolicitud
  ): Promise<ResultadoProcesoEmail> {
    const tiempoInicio = Date.now();

    console.log('\n' + '═'.repeat(60));
    console.log(`📧 PROCESANDO SOLICITUD`);
    console.log('═'.repeat(60));
    console.log(`De:      ${correo.de}`);
    console.log(`Asunto:  ${correo.asunto}`);
    console.log(`Adjuntos: ${correo.adjuntos?.length ?? 0}`);
    console.log('─'.repeat(60));

    try {
      // Paso 1: Validar que hay adjuntos
      if (!correo.adjuntos || correo.adjuntos.length === 0) {
        const resultado: ResultadoProcesoEmail = {
          correoId: correo.id,
          exitoso: false,
          paso: 'extraccion_adjuntos',
          error: 'No hay adjuntos en el correo',
          tiempoMs: Date.now() - tiempoInicio,
        };

        console.log(
          `\n❌ ${resultado.error}\n`
        );
        return resultado;
      }

      // Paso 2: Analizar recibos
      console.log(
        `\n🔍 PASO 2: Analizando ${correo.adjuntos.length} adjunto(s)...`
      );

      let datosRecibo = null;
      let adjuntosProcesados = 0;

      for (const adjunto of correo.adjuntos) {
        // Solo procesar imágenes y PDFs
        if (
          !adjunto.tipo.startsWith('image/') &&
          adjunto.tipo !== 'application/pdf'
        ) {
          console.log(
            `   ⏭️  Saltando ${adjunto.nombre} (tipo: ${adjunto.tipo})`
          );
          continue;
        }

        adjuntosProcesados++;

        console.log(`\n   Procesando: ${adjunto.nombre}`);

        const analisis = await this.gemini.analizarRecibo(
          adjunto.datos,
          adjunto.nombre,
          adjunto.tipo
        );

        if (analisis.exitoso && analisis.datos) {
          datosRecibo = analisis.datos;
          break; // Usar el primer recibo válido encontrado
        }
      }

      if (!datosRecibo) {
        const resultado: ResultadoProcesoEmail = {
          correoId: correo.id,
          exitoso: false,
          paso: 'analisis_recibo',
          error: `No se pudo extraer datos válidos de los ${adjuntosProcesados} adjunto(s) procesados`,
          tiempoMs: Date.now() - tiempoInicio,
        };

        console.log(`\n❌ ${resultado.error}\n`);
        return resultado;
      }

      // Paso 3: Buscar socio
      console.log(`\n🔍 PASO 3: Buscando socio en base de datos...`);

      const socio = this.excel.buscarPorDNI(datosRecibo.dni);

      if (socio) {
        this.excel.imprimirResumenSocio(socio);
      }

      // Paso 4: Calcular cupo
      console.log(`🔍 PASO 4: Calculando cupo...`);

      const calculoCupo = this.quota.calcularCupo(
        datosRecibo.dni,
        datosRecibo.sueldoNeto,
        datosRecibo.organismo
      );

      this.quota.imprimirResumenCalculo(calculoCupo);

      // Paso 5: Generar respuesta
      console.log(`🔍 PASO 5: Generando respuesta...`);

      const nombreSocio = socio?.nombre ?? 'Estimado Comercial';
      const mensajeCupo = this.quota.generarMensajeCupo(
        calculoCupo,
        nombreSocio
      );

      // Paso 6: Enviar respuesta
      console.log(`🔍 PASO 6: Enviando respuesta...`);

      const emailPara = correo.de.match(/<(.+?)>/)?.[1] ?? correo.de;
      const asuntoRespuesta = `Re: ${correo.asunto}`;

      if (this.dryRun) {
        console.log(`\n   🎪 MODO DRY-RUN - Simulacro (NO enviará email real)`);
        console.log(`   ✅ Para: ${emailPara}`);
        console.log(`   ✅ Asunto: ${asuntoRespuesta}`);
        console.log(`   ✅ Mensaje preview:\n`);
        console.log(`   ${mensajeCupo.substring(0, 200)}...`);
        console.log(`\n   ⚠️  Correo NO será enviado ni marcado como leído en DRY-RUN\n`);
      } else {
        await this.gmail.responder(
          correo.threadId,
          emailPara,
          asuntoRespuesta,
          mensajeCupo
        );

        // Marcar como leído
        await this.gmail.marcarLeido(correo.id);
      }

      const tiempoMs = Date.now() - tiempoInicio;

      console.log('\n' + '═'.repeat(60));
      console.log(`✅ SOLICITUD PROCESADA EXITOSAMENTE`);
      console.log(`   Tiempo total: ${tiempoMs}ms`);
      console.log('═'.repeat(60) + '\n');

      return {
        correoId: correo.id,
        exitoso: true,
        paso: 'respuesta',
        respuesta: {
          para: correo.de,
          asunto: asuntoRespuesta,
          cuerpo: mensajeCupo,
          threadId: correo.threadId,
          templateUsada: 'cupo_personalizado',
        },
        tiempoMs,
        detalles: {
          dni: datosRecibo.dni,
          organismo: datosRecibo.organismo,
          sueldoNeto: datosRecibo.sueldoNeto,
          montoQupo: calculoCupo.montoQupo,
          esNuevoSocio: calculoCupo.esNuevoSocio,
          tieneDeuda: calculoCupo.tieneDeuda,
        },
      };
    } catch (err: any) {
      const tiempoMs = Date.now() - tiempoInicio;

      const mensajeError =
        err instanceof Error ? err.message : String(err);

      console.error(`\n❌ Error procesando solicitud: ${mensajeError}`);
      console.error(`   Tiempo antes de error: ${tiempoMs}ms`);

      // 🔴 CRÍTICO: Marcar como leído para evitar bucle infinito de "poison emails"
      // EXCEPTO en dry-run, donde queremos que permanezca sin leer para debugging
      if (!this.dryRun) {
        try {
          await this.gmail.marcarLeido(correo.id);
          console.error(`   ✅ Correo marcado como leído (evita reprocesamiento)`);
        } catch (markErr) {
          console.error(`   ⚠️  No se pudo marcar como leído:`, markErr);
        }
      } else {
        console.error(`   🎪 DRY-RUN: Correo NO marcado como leído (permanece disponible para debugging)`);
      }

      console.error();

      return {
        correoId: correo.id,
        exitoso: false,
        paso: 'respuesta', // Último paso intentado
        error: mensajeError,
        tiempoMs,
      };
    }
  }

  /**
   * Procesa múltiples solicitudes
   */
  async procesarMultiples(
    correos: CorreoSolicitud[]
  ): Promise<ResultadoProcesoEmail[]> {
    const resultados: ResultadoProcesoEmail[] = [];

    console.log(`\n${'🤖 INICIANDO LOTE DE PROCESAMIENTO'.padEnd(60)}`);
    console.log(`📧 Total de correos: ${correos.length}`);
    console.log('─'.repeat(60) + '\n');

    for (let i = 0; i < correos.length; i++) {
      console.log(
        `[${i + 1}/${correos.length}] Procesando correo ${i + 1}...`
      );

      const resultado = await this.procesarSolicitud(correos[i]);
      resultados.push(resultado);

      // Pequeña pausa entre emails para no saturar APIs
      if (i < correos.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Resumen final
    const exitosos = resultados.filter(r => r.exitoso).length;
    const fallidos = resultados.length - exitosos;

    console.log('\n' + '═'.repeat(60));
    console.log(`📊 RESUMEN DEL LOTE`);
    console.log('═'.repeat(60));
    console.log(`✅ Procesados exitosamente: ${exitosos}/${correos.length}`);
    console.log(`❌ Errores: ${fallidos}/${correos.length}`);
    console.log('─'.repeat(60));

    // Mostrar errores
    const errores = resultados.filter(r => !r.exitoso);
    if (errores.length > 0) {
      console.log(`\n⚠️  ERRORES ENCONTRADOS:`);
      errores.forEach((error, idx) => {
        console.log(`   ${idx + 1}. [${error.paso}] ${error.error}`);
      });
    }

    console.log('═'.repeat(60) + '\n');

    return resultados;
  }
}
