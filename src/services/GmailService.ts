/**
 * GmailService.ts
 * 
 * Servicio de integración con Gmail API
 * Responsable de:
 *  - Autenticación OAuth2
 *  - Lectura de correos
 *  - Gestión de etiquetas
 *  - Envío de respuestas
 *  - Descarga de adjuntos
 * 
 * Uso:
 *  const gmail = new GmailService();
 *  await gmail.init();
 *  const correos = await gmail.obtenerSolicitudes();
 *  await gmail.marcarLeido(id);
 *  await gmail.responder(threadId, para, asunto, cuerpo);
 */

import { promises as fs } from 'fs';
import * as http from 'http';
import { URL } from 'url';

import { google, Auth, gmail_v1 } from 'googleapis';
import { CONFIG } from '../config';
import type { CorreoSolicitud, AdjuntoCorreo } from '../types';

// ──────────────────────────────────────────────
// SCOPES (Permisos solicitados)
// ──────────────────────────────────────────────
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',      // Leer correos
  'https://www.googleapis.com/auth/gmail.modify',        // Modificar etiquetas, marcar como leído
  'https://www.googleapis.com/auth/gmail.send',          // Enviar respuestas
];

// ──────────────────────────────────────────────
// CLASE PRINCIPAL
// ──────────────────────────────────────────────

export class GmailService {
  private client!: Auth.OAuth2Client;
  private gmail!: gmail_v1.Gmail;
  private inicializado = false;

  /**
   * Inicializa el servicio de Gmail
   * - Crea cliente OAuth2
   * - Carga o renueva token
   * - Configura cliente de Gmail API
   */
  async init(): Promise<void> {
    console.log('📧 Inicializando GmailService...');

    this.client = await this.construirOAuth2Client();
    console.log('✅ Cliente OAuth2 creado');

    const tokenCargado = await this.intentarCargarToken();
    console.log(`📋 Token previo ${tokenCargado ? 'cargado' : 'no encontrado'}`);

    if (!tokenCargado) {
      await this.ejecutarFlujoAutenticacion();
    }

    // Validación crítica
    const creds = this.client.credentials;
    if (!creds || !creds.access_token) {
      throw new Error(
        '❌ CRÍTICO: Cliente OAuth2 sin access_token después de autenticación.\n' +
        'Las credenciales no se configuraron correctamente.'
      );
    }

    console.log('✅ Access token presente en el cliente');
    console.log(`   Token tipo: ${creds.token_type || 'desconocido'}`);
    console.log(
      `   Expira en: ${
        creds.expiry_date
          ? new Date(creds.expiry_date).toLocaleString('es-AR')
          : 'desconocido'
      }`
    );

    // Crear cliente de Gmail API
    this.gmail = google.gmail({
      version: 'v1',
      auth: this.client,
    });

    this.inicializado = true;
    console.log('✅ GmailService inicializado correctamente.\n');
  }

  /**
   * Obtiene correos de solicitud (sin leer, con adjuntos)
   */
  async obtenerSolicitudes(
    maxResultados: number = 20
  ): Promise<CorreoSolicitud[]> {
    this.validarInicializacion();

    try {
      console.log(`🔍 Buscando solicitudes (máx ${maxResultados})...`);

      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: CONFIG.email.busquedaQuery,
        maxResults: maxResultados,
      });

      const mensajes = response.data.messages ?? [];
      console.log(`   Encontrados: ${mensajes.length} correos`);

      const correos: CorreoSolicitud[] = [];

      for (const msg of mensajes) {
        if (!msg.id || !msg.threadId) continue;

        const correo = await this.parsearCorreo(msg.id, msg.threadId);
        if (correo) {
          correos.push(correo);
        }
      }

      console.log(`✅ Procesados: ${correos.length} correos válidos\n`);
      return correos;
    } catch (err: any) {
      this.diagnosticarError(err, 'obtenerSolicitudes');
      throw err;
    }
  }

  /**
   * Marca un correo como leído
   */
  async marcarLeido(messageId: string): Promise<void> {
    this.validarInicializacion();

    try {
      await this.gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: { removeLabelIds: ['UNREAD'] },
      });
      console.log(`✅ Correo ${messageId.substring(0, 8)}... marcado como leído`);
    } catch (err) {
      console.error(`❌ Error marcando correo como leído:`, err);
      throw err;
    }
  }

  /**
   * Envía respuesta a un correo (reply)
   */
  async responder(
    threadId: string,
    para: string,
    asunto: string,
    cuerpo: string
  ): Promise<string> {
    this.validarInicializacion();

    try {
      const raw = this.construirEmailRFC2822(para, asunto, cuerpo);

      const response = await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw, threadId },
      });

      console.log(`✅ Respuesta enviada a ${para}`);
      return response.data.id ?? '';
    } catch (err) {
      console.error(`❌ Error enviando respuesta:`, err);
      throw err;
    }
  }

  /**
   * Obtiene los detalles completos de un correo (incluyendo adjuntos)
   */
  private async parsearCorreo(
    id: string,
    threadId: string
  ): Promise<CorreoSolicitud | null> {
    try {
      const response = await this.gmail.users.messages.get({
        userId: 'me',
        id,
        format: 'full',
      });

      const headers = response.data.payload?.headers ?? [];
      const obtenerHeader = (nombre: string) =>
        headers.find(h => h.name === nombre)?.value ?? '';

      // Descargar adjuntos
      const adjuntos = await this.descargarAdjuntos(
        id,
        response.data.payload?.parts ?? []
      );

      return {
        id,
        threadId,
        fecha: obtenerHeader('Date'),
        de: obtenerHeader('From'),
        asunto: obtenerHeader('Subject'),
        cuerpo: this.extraerCuerpoTexto(response.data.payload),
        labelIds: response.data.labelIds ?? [],
        adjuntos,
      };
    } catch (err) {
      console.error(`❌ Error parseando correo ${id}:`, err);
      return null;
    }
  }

  /**
   * Extrae adjuntos de un correo
   */
  private async descargarAdjuntos(
    messageId: string,
    parts: gmail_v1.Schema$MessagePart[]
  ): Promise<AdjuntoCorreo[]> {
    const adjuntos: AdjuntoCorreo[] = [];

    for (const part of parts) {
      // ✅ CORRECCIÓN: Usamos filename y attachmentId directamente para saber si es un adjunto
      const fileName = part.filename;
      const attachmentId = part.body?.attachmentId;

      // Si no tiene nombre de archivo o no tiene token de adjunto, lo ignoramos
      if (!fileName || !attachmentId) continue;

      try {
        const response = await this.gmail.users.messages.attachments.get({
          userId: 'me',
          messageId,
          id: attachmentId, // Usamos el token real
        });

        const datosBase64Url = response.data.data ?? '';
        const datos = Buffer.from(datosBase64Url, 'base64url');

        adjuntos.push({
          id: attachmentId,
          nombre: fileName,
          tipo: part.mimeType ?? 'application/octet-stream',
          datos,
        });

        console.log(
          `   ✓ Adjunto: ${fileName} (${datos.length} bytes descargados)`
        );
      } catch (err) {
        console.warn(`   ⚠️  No se pudo descargar adjunto ${fileName}:`, err);
      }
    }

    return adjuntos;
  }










  /**
   * Extrae el cuerpo en texto plano del correo
   */
  private extraerCuerpoTexto(
    payload: gmail_v1.Schema$MessagePart | undefined
  ): string {
    if (!payload) return '';

    // Caso 1: El cuerpo está directamente en la parte (simple)
    if (payload.mimeType === 'text/plain' && payload.body?.data) {
      return Buffer.from(payload.body.data, 'base64').toString('utf-8');
    }

    // Caso 2: Hay partes (multipart - complejo)
    if (payload.parts) {
      // Buscar primero un text/plain
      for (const parte of payload.parts) {
        if (parte.mimeType === 'text/plain' && parte.body?.data) {
          return Buffer.from(parte.body.data, 'base64').toString('utf-8');
        }
      }

      // Si no hay text/plain, buscar recursivamente en subpartes
      for (const parte of payload.parts) {
        const encontrado = this.extraerCuerpoTexto(parte);
        if (encontrado) return encontrado;
      }
    }

    return '';
  }

  /**
   * Construye un email en formato RFC 2822 codificado en base64url
   */
  private construirEmailRFC2822(
    para: string,
    asunto: string,
    cuerpo: string
  ): string {
    const email = [
      `To: ${para}`,
      'Content-Type: text/plain; charset=utf-8',
      'MIME-Version: 1.0',
      `Subject: ${asunto}`,
      '',
      cuerpo,
    ].join('\n');

    return Buffer.from(email).toString('base64url');
  }

  /**
   * Construye cliente OAuth2 desde credenciales
   */
  private async construirOAuth2Client(): Promise<Auth.OAuth2Client> {
    const raw = await fs.readFile(CONFIG.gmail.credencialesPath, 'utf-8');
    const json = JSON.parse(raw) as {
      installed?: { client_id: string; client_secret: string };
      web?: { client_id: string; client_secret: string };
    };

    const key = json.installed ?? json.web;
    if (!key) {
      throw new Error(
        '❌ credenciales.json no tiene "installed" ni "web"'
      );
    }

    return new google.auth.OAuth2(
      key.client_id,
      key.client_secret,
      CONFIG.gmail.redirectUri
    );
  }

  /**
   * Intenta cargar token guardado previamente
   */
  private async intentarCargarToken(): Promise<boolean> {
    try {
      const raw = await fs.readFile(CONFIG.gmail.tokenPath, 'utf-8');
      const tokens = JSON.parse(raw) as Auth.Credentials;

      console.log(`📂 Token encontrado en ${CONFIG.gmail.tokenPath}`);
      console.log(
        `   - access_token: ${tokens.access_token ? '✅' : '❌'}`
      );
      console.log(
        `   - refresh_token: ${tokens.refresh_token ? '✅' : '❌'}`
      );

      this.client.setCredentials(tokens);
      console.log('✅ Token configurado en el cliente OAuth2');

      // Validar que se configuró
      const configurado = this.client.credentials;
      if (!configurado.access_token) {
        throw new Error('Token no se configuró correctamente');
      }

      // Manejar expiración
      const ahora = Date.now();
      const expira = tokens.expiry_date ?? 0;
      const estaExpirado = ahora > expira;

      if (estaExpirado && tokens.refresh_token) {
        console.log('⏰ Token expirado, renovando...');
        try {
          const { credentials } = await this.client.refreshAccessToken();
          this.client.setCredentials(credentials);
          await fs.writeFile(
            CONFIG.gmail.tokenPath,
            JSON.stringify(credentials, null, 2)
          );
          console.log('✅ Token renovado exitosamente');
          return true;
        } catch (err) {
          console.error('❌ Error renovando token:', err);
          console.log(
            '   → Probablemente expiró el refresh_token. Se requiere autenticación nueva.'
          );
          return false;
        }
      }

      if (estaExpirado) {
        console.warn('⚠️  Token expirado sin refresh_token');
        return false;
      }

      console.log('✅ Token válido');
      return true;
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        console.log(
          '📭 Archivo token.json no existe (primera ejecución)'
        );
      } else {
        console.error('❌ Error cargando token:', err.message);
      }
      return false;
    }
  }

  /**
   * Ejecuta el flujo completo de autenticación OAuth2
   */
  private async ejecutarFlujoAutenticacion(): Promise<void> {
    console.log('\n🔐 Iniciando flujo de autenticación OAuth2...');
    console.log(`   Scopes solicitados: ${SCOPES.length} permisos`);

    const authUrl = this.client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: SCOPES,
    });

    console.log('\n🌐 Abre esta URL en el navegador:\n');
    console.log('   ' + authUrl + '\n');

    try {
      const { default: open } = await import('open');
      await open(authUrl);
      console.log('✅ Navegador abierto automáticamente');
    } catch {
      console.log('ℹ️  Abre manualmente la URL anterior');
    }

    // Esperar respuesta del navegador
    const code = await new Promise<string>((resolve, reject) => {
      const servidor = http.createServer((req, res) => {
        if (!req.url) return;

        const params = new URL(req.url, CONFIG.gmail.redirectUri)
          .searchParams;
        const codigo = params.get('code');
        const error = params.get('error');

        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
        });
        res.end(
          codigo
            ? '<h2>✅ ¡Autenticación exitosa! Podés cerrar esta pestaña.</h2>'
            : `<h2>❌ Error: ${error ?? 'desconocido'}</h2>`
        );

        servidor.close();

        if (codigo) {
          console.log('✅ Código de autorización recibido');
          resolve(codigo);
        } else {
          console.error(`❌ Error en el navegador: ${error}`);
          reject(new Error(`OAuth error: ${error}`));
        }
      });

      servidor.listen(3000, () => {
        console.log('⏳ Esperando respuesta en http://localhost:3000 ...\n');
      });

      servidor.on('error', reject);
    });

    // Intercambiar código por token
    console.log('🔄 Intercambiando código por token...');
    try {
      const { tokens } = await this.client.getToken(code);

      console.log('✅ Token recibido:');
      console.log(
        `   - access_token: ${tokens.access_token ? '✅' : '❌'}`
      );
      console.log(
        `   - refresh_token: ${tokens.refresh_token ? '✅' : '❌'}`
      );
      console.log(`   - token_type: ${tokens.token_type || 'desconocido'}`);
      if (tokens.expiry_date) {
        console.log(
          `   - expira: ${new Date(tokens.expiry_date).toLocaleString(
            'es-AR'
          )}`
        );
      }

      this.client.setCredentials(tokens);
      console.log('✅ Token configurado');

      await fs.writeFile(
        CONFIG.gmail.tokenPath,
        JSON.stringify(tokens, null, 2)
      );
      console.log(`💾 Token guardado en ${CONFIG.gmail.tokenPath}\n`);
    } catch (err) {
      console.error('❌ Error obteniendo token:', err);
      throw err;
    }
  }

  /**
   * Valida que el servicio esté inicializado
   */
  private validarInicializacion(): void {
    if (!this.inicializado) {
      throw new Error(
        'GmailService no inicializado. Ejecuta await gmail.init() primero.'
      );
    }
  }

  /**
   * Diagnostica errores específicos de Gmail
   */
  private diagnosticarError(err: any, contexto: string): void {
    console.error(`\n❌ Error en ${contexto}():`, err.message);

    if (err.response?.status === 401) {
      console.error(
        '\n   → Error 401: El token está inválido o expirado.\n' +
        '   → SOLUCIÓN: Elimina token.json y reinicia.\n'
      );
    } else if (err.response?.status === 403) {
      console.error(
        '\n   → Error 403: No tienes permisos para esta acción.\n' +
        '   → Verifica que los SCOPES sean correctos.\n'
      );
    } else if (err.response?.status === 404) {
      console.error('\n   → Error 404: Recurso no encontrado.\n');
    }
  }
}
