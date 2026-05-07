/**
 * ExcelService.ts
 * 
 * Servicio para leer/buscar datos de socios en Excel
 * Responsable de:
 *  - Cargar archivo Excel de socios
 *  - Buscar socio por DNI
 *  - Obtener historial de créditos
 *  - Validar estado del socio
 * 
 * Uso:
 *  const excel = new ExcelService();
 *  await excel.cargar();
 *  const socio = excel.buscarPorDNI('12345678');
 */

import { CONFIG } from '../config';
import type { Socio } from '../types';

/**
 * Mock de datos para demostración
 * En producción, usarías una librería como 'xlsx' o 'exceljs'
 * para leer archivos Excel reales
 */
const SOCIOS_DEMO: Socio[] = [
  {
    id: '1',
    nombre: 'Juan Pérez',
    dni: '12345678',
    correo: 'juan@ejemplo.com',
    estado: 'activo',
    esNuevo: false,
    tieneDeuda: false,
    montoDeuda: 0,
    estadoCredito: 'activo',
    fechaRegistro: '2020-01-15',
  },
  {
    id: '2',
    nombre: 'María García',
    dni: '87654321',
    correo: 'maria@ejemplo.com',
    estado: 'activo',
    esNuevo: true,
    tieneDeuda: false,
    montoDeuda: 0,
    estadoCredito: 'ninguno',
    fechaRegistro: '2024-02-01',
  },
  {
    id: '3',
    nombre: 'Carlos López',
    dni: '11111111',
    correo: 'carlos@ejemplo.com',
    estado: 'activo',
    esNuevo: false,
    tieneDeuda: true,
    montoDeuda: 500000,
    estadoCredito: 'en_refinanciacion',
    deudaRefinanciacion: 500000,
    fechaRegistro: '2019-05-20',
  },
];

export class ExcelService {
  private socios: Socio[] = [];
  private cargado = false;

  /**
   * Carga los datos de socios desde Excel
   * Por ahora usa datos de demostración
   * TODO: Implementar lectura real de Excel
   */
  async cargar(): Promise<void> {
    console.log('📊 Cargando datos de socios...');

    try {
      // TODO: Aquí irá la lectura real de Excel
      // const workbook = XLSX.readFile(CONFIG.excel.rutaArchivoSocios);
      // const sheet = workbook.Sheets[workbook.SheetNames[0]];
      // this.socios = XLSX.utils.sheet_to_json(sheet);

      // Por ahora, usar datos de demostración
      this.socios = [...SOCIOS_DEMO];

      console.log(`✅ Socios cargados: ${this.socios.length} registros`);
      console.log(`   Archivo: ${CONFIG.excel.rutaArchivoSocios}`);

      this.cargado = true;
    } catch (err) {
      console.error('❌ Error cargando socios:', err);
      throw err;
    }
  }

  /**
   * Busca un socio por su DNI
   */
  buscarPorDNI(dni: string): Socio | null {
    this.validarCargado();

    const dniLimpio = dni.replace(/[.\s-]/g, '').trim();

    const socio = this.socios.find(s => {
      const suDniLimpio = s.dni.replace(/[.\s-]/g, '').trim();
      return suDniLimpio === dniLimpio;
    });

    if (socio) {
      console.log(
        `✅ Socio encontrado: ${socio.nombre} (DNI: ${socio.dni})`
      );
    } else {
      console.log(`ℹ️  Socio NO encontrado para DNI: ${dni}`);
    }

    return socio ?? null;
  }

  /**
   * Busca un socio por nombre (búsqueda parcial)
   */
  buscarPorNombre(nombre: string): Socio[] {
    this.validarCargado();

    const nombreLower = nombre.toLowerCase();
    const resultados = this.socios.filter(s =>
      s.nombre.toLowerCase().includes(nombreLower)
    );

    return resultados;
  }

  /**
   * Obtiene todos los socios activos
   */
  obtenerSociosActivos(): Socio[] {
    this.validarCargado();

    return this.socios.filter(s => s.estado === 'activo');
  }

  /**
   * Obtiene socios con deuda
   */
  obtenerSociosConDeuda(): Socio[] {
    this.validarCargado();

    return this.socios.filter(s => s.tieneDeuda);
  }

  /**
   * Obtiene socios nuevos (sin historial de crédito)
   */
  obtenerSociosNuevos(): Socio[] {
    this.validarCargado();

    return this.socios.filter(s => s.esNuevo);
  }

  /**
   * Obtiene el estado del crédito de un socio
   */
  obtenerEstadoCredito(dni: string): string {
    const socio = this.buscarPorDNI(dni);
    if (!socio) return 'no_registrado';

    return socio.estadoCredito;
  }

  /**
   * Verifica si un socio tiene deuda
   */
  tieneDeuda(dni: string): boolean {
    const socio = this.buscarPorDNI(dni);
    if (!socio) return false;

    return socio.tieneDeuda;
  }

  /**
   * Obtiene el monto de deuda de un socio
   */
  obtenerMontoDeuda(dni: string): number {
    const socio = this.buscarPorDNI(dni);
    if (!socio) return 0;

    return socio.montoDeuda ?? 0;
  }

  /**
   * Obtiene estadísticas generales
   */
  obtenerEstadisticas(): {
    totalSocios: number;
    sociosActivos: number;
    sociosConDeuda: number;
    sociosNuevos: number;
    deudaTotal: number;
  } {
    this.validarCargado();

    const sociosActivos = this.obtenerSociosActivos();
    const sociosConDeuda = this.obtenerSociosConDeuda();
    const sociosNuevos = this.obtenerSociosNuevos();

    const deudaTotal = this.socios.reduce(
      (sum, s) => sum + (s.montoDeuda ?? 0),
      0
    );

    return {
      totalSocios: this.socios.length,
      sociosActivos: sociosActivos.length,
      sociosConDeuda: sociosConDeuda.length,
      sociosNuevos: sociosNuevos.length,
      deudaTotal,
    };
  }

  /**
   * Imprime un resumen de un socio
   */
  imprimirResumenSocio(socio: Socio): void {
    console.log('\n📋 RESUMEN DEL SOCIO:');
    console.log('─'.repeat(40));
    console.log(`Nombre:            ${socio.nombre}`);
    console.log(`DNI:               ${socio.dni}`);
    console.log(`Estado:            ${socio.estado}`);
    console.log(
      `Es Nuevo:          ${socio.esNuevo ? 'Sí' : 'No'}`
    );
    console.log(
      `Tiene Deuda:       ${socio.tieneDeuda ? `Sí ($${socio.montoDeuda})` : 'No'}`
    );
    console.log(`Estado Crédito:    ${socio.estadoCredito}`);
    if (socio.deudaRefinanciacion) {
      console.log(
        `Deuda Refinanciación: $${socio.deudaRefinanciacion}`
      );
    }
    console.log(`Registro:          ${socio.fechaRegistro}`);
    console.log('─'.repeat(40) + '\n');
  }

  /**
   * Valida que los datos estén cargados
   */
  private validarCargado(): void {
    if (!this.cargado) {
      throw new Error(
        'ExcelService no cargado. Ejecuta await excel.cargar() primero.'
      );
    }
  }
}
