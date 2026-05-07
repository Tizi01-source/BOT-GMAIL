/**
 * QuotaProcessor.ts
 * 
 * Procesador de lógica de cupos
 * Responsable de:
 *  - Calcular cupo disponible basado en datos del socio y recibo
 *  - Aplicar reglas de negocio
 *  - Considerar deuda, estado del socio, etc.
 * 
 * Uso:
 *  const procesador = new QuotaProcessor(excelService);
 *  const resultado = procesador.calcularCupo(dni, sueldoNeto, organismo);
 */

import { CONFIG } from '../config';
import { ExcelService } from './ExcelService';
import type { CalculoCupo, Socio } from '../types';

export class QuotaProcessor {
  constructor(private excel: ExcelService) {}

  /**
   * Calcula el cupo disponible para un DNI
   */
  calcularCupo(
    dni: string,
    sueldoNeto: number,
    organismo: string
  ): CalculoCupo {
    console.log(
      `💰 Calculando cupo para DNI ${dni}...`
    );

    const tiempoInicio = Date.now();

    // Paso 1: Buscar al socio
    const socio = this.excel.buscarPorDNI(dni);
    const esNuevo = socio === null;

    // Paso 2: Validar sueldo mínimo
    if (sueldoNeto < CONFIG.cupos.minimoSueldo) {
      console.log(
        `   ❌ Sueldo insuficiente: $${sueldoNeto} < $${CONFIG.cupos.minimoSueldo}`
      );
      return {
        dni,
        montoQupo: 0,
        razon: `Sueldo mínimo requerido: $${CONFIG.cupos.minimoSueldo}`,
        esNuevoSocio: esNuevo,
        tieneDeuda: socio?.tieneDeuda ?? false,
        organismo,
        sueldoNeto,
      };
    }

    console.log(
      `   ✅ Sueldo válido: $${sueldoNeto}`
    );

    // Paso 3: Calcular cupo base (porcentaje del sueldo)
    let cupoBase = sueldoNeto * CONFIG.cupos.porcentajeDelSueldo;

    console.log(
      `   📊 Cupo base (${(CONFIG.cupos.porcentajeDelSueldo * 100).toFixed(0)}% del sueldo): $${cupoBase.toFixed(0)}`
    );

    // Paso 4: Aplicar coeficiente del organismo
    const coefOrganismo =
      CONFIG.organismos[organismo]?.coeficiente ?? 1.0;
    cupoBase = cupoBase * coefOrganismo;

    console.log(
      `   🏢 Ajuste por organismo "${organismo}" (×${coefOrganismo}): $${cupoBase.toFixed(0)}`
    );

    // Paso 5: Aplicar límites según si es nuevo o activo
    let cupoFinal = cupoBase;
    let razon = '';

    if (esNuevo) {
      // Socio nuevo
      cupoFinal = Math.min(
        cupoBase,
        CONFIG.cupos.cupoMaximoNuevoSocio
      );
      razon = `Socio nuevo (máx: $${CONFIG.cupos.cupoMaximoNuevoSocio})`;
      console.log(`   👤 Nuevo socio`);
    } else {
      // Socio existente
      cupoFinal = Math.min(
        cupoBase,
        CONFIG.cupos.cupoMaximoSocioActivo
      );
      razon = `Socio activo (máx: $${CONFIG.cupos.cupoMaximoSocioActivo})`;
      console.log(`   👥 Socio existente`);
    }

    if (cupoFinal < cupoBase) {
      console.log(
        `   📈 Ajuste por límite máximo: $${cupoFinal.toFixed(0)}`
      );
    }

    // Paso 6: Aplicar descuento por deuda (si existe)
    let tieneDeuda = false;
    if (socio && socio.tieneDeuda && socio.montoDeuda) {
      tieneDeuda = true;
      const descuento =
        CONFIG.cupos.descuentoPorDeuda;
      const montoDescuento = cupoFinal * descuento;

      cupoFinal = cupoFinal * (1 - descuento);
      razon +=
        ` | Tiene deuda: $${socio.montoDeuda} (descuento ${(descuento * 100).toFixed(0)}%)`;

      console.log(
        `   💳 Descuento por deuda ($${montoDescuento.toFixed(0)}): $${cupoFinal.toFixed(0)}`
      );
    }

    // Redondear al peso más cercano
    cupoFinal = Math.round(cupoFinal);

    const tiempoMs = Date.now() - tiempoInicio;

    console.log(
      `\n   ✅ CUPO FINAL: $${cupoFinal.toLocaleString('es-AR')}`
    );
    console.log(`   Tiempo cálculo: ${tiempoMs}ms\n`);

    return {
      dni,
      montoQupo: cupoFinal,
      razon,
      esNuevoSocio: esNuevo,
      tieneDeuda,
      organismo,
      sueldoNeto,
    };
  }

  /**
   * Genera un mensaje de cupo para enviar por email
   */
  generarMensajeCupo(
    calculoCupo: CalculoCupo,
    nombreSocio?: string
  ): string {
    const divisa = 'Gs.';
    const cupoFormateado = calculoCupo.montoQupo.toLocaleString(
      'es-AR'
    );

    if (calculoCupo.montoQupo === 0) {
      return (
        `Estimado ${nombreSocio ?? 'Socio'},\n\n` +
        `Tras revisar su solicitud de crédito, lamentamos informarle que en este momento ` +
        `no calificas para un cupo disponible.\n\n` +
        `Razón: ${calculoCupo.razon}\n\n` +
        `Te recomendamos contactar a nuestro departamento de socios para más información.\n\n` +
        `Saludos cordiales,\nEquipo de Créditos`
      );
    }

    return (
      `Estimado ${nombreSocio ?? 'Socio'},\n\n` +
      `Nos complace informarle que su solicitud de crédito ha sido aprobada.\n\n` +
      `📊 DETALLES:\n` +
      `• Cupo Disponible: ${divisa} ${cupoFormateado}\n` +
      `• Organismo: ${calculoCupo.organismo}\n` +
      `• Estado: ${calculoCupo.esNuevoSocio ? 'Nuevo Socio' : 'Socio Activo'}\n` +
      (calculoCupo.tieneDeuda
        ? `• ⚠️ Tiene deuda activa (cupo reducido)\n`
        : '') +
      `\nEste cupo es válido por 30 días. Para tramitarlo, contáctese con ` +
      `nuestro departamento de créditos.\n\n` +
      `Saludos cordiales,\nEquipo de Créditos`
    );
  }

  /**
   * Imprime un resumen del cálculo
   */
  imprimirResumenCalculo(calculoCupo: CalculoCupo): void {
    console.log('\n📈 RESUMEN DEL CÁLCULO:');
    console.log('─'.repeat(50));
    console.log(`DNI:              ${calculoCupo.dni}`);
    console.log(
      `Tipo de Socio:    ${calculoCupo.esNuevoSocio ? 'Nuevo' : 'Activo'}`
    );
    console.log(
      `Sueldo Neto:      $${calculoCupo.sueldoNeto.toLocaleString('es-AR')}`
    );
    console.log(
      `Organismo:        ${calculoCupo.organismo}`
    );
    console.log(
      `Tiene Deuda:      ${calculoCupo.tieneDeuda ? 'Sí' : 'No'}`
    );
    console.log('─'.repeat(50));
    console.log(
      `💰 CUPO FINAL:     $${calculoCupo.montoQupo.toLocaleString('es-AR')}`
    );
    console.log('─'.repeat(50));
    console.log(`Razón:            ${calculoCupo.razon}`);
    console.log('─'.repeat(50) + '\n');
  }
}
