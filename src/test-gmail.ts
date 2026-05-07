import { promises as fs } from 'fs';
import * as path from 'path';
import * as http from 'http';
import { URL } from 'url';

// ✅ CORRECCIÓN CLAVE: importar Auth y tipos SOLO desde 'googleapis'
// Nunca importar OAuth2Client directamente de 'google-auth-library'
// porque crea conflicto con la copia interna que usa googleapis-common
import { google, Auth, gmail_v1 } from 'googleapis';
import type { GaxiosResponse } from 'gaxios';

// ──────────────────────────────────────────────
// TIPOS
// ──────────────────────────────────────────────
export interface CorreoSolicitud {
  id:       string;
  threadId: string;
  fecha:    string;
  de:       string;
  asunto:   string;
  cuerpo:   string;
  labelIds: string[];
}

// ──────────────────────────────────────────────
// CONFIGURACIÓN
// ──────────────────────────────────────────────
const CREDENTIALS_PATH = path.join(process.cwd(), 'credenciales.json');
const TOKEN_PATH        = path.join(process.cwd(), 'token.json');
const REDIRECT_URI      = 'http://localhost:3000';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  // Descomentá cuando necesites enviar respuestas:
  // 'https://www.googleapis.com/auth/gmail.send',
  // 'https://www.googleapis.com/auth/gmail.modify',
];

// ──────────────────────────────────────────────
// CLASE PRINCIPAL
// ──────────────────────────────────────────────
export class GmailService {
  // ✅ Auth.OAuth2Client viene del namespace de googleapis → sin conflicto
  private client!: Auth.OAuth2Client;
  private gmail!:  gmail_v1.Gmail;

  // ── Inicialización ──────────────────────────
  async init(): Promise<void> {
    this.client = await this.buildOAuth2Client();
    console.log('✅ OAuth2 cliente creado');
    
    const loaded = await this.tryLoadToken();
    console.log(`📋 Token previo ${loaded ? 'cargado' : 'no encontrado'}`);
    
    if (!loaded) {
      await this.runAuthFlow();
    }

    // ✅ VERIFICACIÓN CRÍTICA: validar que el cliente tiene credenciales
    const creds = this.client.credentials;
    if (!creds || !creds.access_token) {
      throw new Error(
        '❌ CRÍTICO: Cliente OAuth2 sin access_token después de autenticación. ' +
        'Las credenciales no se configuraron correctamente.'
      );
    }
    console.log('✅ Access token presente en el cliente');
    console.log(`   Token tipo: ${creds.token_type || 'desconocido'}`);
    console.log(`   Expira en: ${creds.expiry_date ? new Date(creds.expiry_date).toISOString() : 'desconocido'}`);

    // ✅ CORRECCIÓN: Pasar el cliente directamente, sin 'as any'
    // El cliente OAuth2 implementa correctamente la interfaz de autenticación
    this.gmail = google.gmail({ 
      version: 'v1', 
      auth: this.client,
    });
    
    console.log('✅ GmailService inicializado correctamente.');
  }

  // ── Leer correos no leídos ───────────────────
  async getCorreosSolicitud(
    label: string = 'INBOX',
    maxResults: number = 20
  ): Promise<CorreoSolicitud[]> {
    try {
      // ✅ DEBUG: Verificar credenciales antes de la solicitud
      const creds = this.client.credentials;
      console.log('🔍 Estado del cliente antes de list():');
      console.log(`   - access_token: ${creds.access_token ? '✅ presente' : '❌ ausente'}`);
      console.log(`   - token_type: ${creds.token_type || '❌ ausente'}`);
      console.log(`   - expiry: ${creds.expiry_date || '❌ ausente'}`);

      const list = await this.gmail.users.messages.list({
        userId:     'me',
        labelIds:   [label],
        q:          'is:unread',
        maxResults,
      });

      console.log(`✅ Lista de correos obtenida: ${list.data.messages?.length ?? 0} mensajes`);

      const messages = list.data.messages ?? [];
      const correos: CorreoSolicitud[] = [];

      for (const msg of messages) {
        if (!msg.id || !msg.threadId) continue;
        const correo = await this.parseCorreo(msg.id, msg.threadId);
        if (correo) correos.push(correo);
      }

      return correos;
    } catch (err: any) {
      console.error('❌ Error en getCorreosSolicitud():', err.message);
      if (err.response?.status === 401) {
        console.error(
          '   → Error 401: El token probablemente está inválido o expirado.\n' +
          '   → SOLUCIÓN: Elimina token.json y reinicia la autenticación.\n' +
          '   → Headers recibidos:', err.response?.headers
        );
      }
      throw err;
    }
  }

  // ── Marcar correo como leído ─────────────────
  async marcarLeido(messageId: string): Promise<void> {
    await this.gmail.users.messages.modify({
      userId:      'me',
      id:          messageId,
      requestBody: { removeLabelIds: ['UNREAD'] },
    });
  }

  // ── Enviar respuesta ─────────────────────────
  async responder(
    threadId: string,
    para:     string,
    asunto:   string,
    cuerpo:   string
  ): Promise<void> {
    const raw = this.buildRawEmail(para, asunto, cuerpo);
    await this.gmail.users.messages.send({
      userId:      'me',
      requestBody: { raw, threadId },
    });
  }

  // ── Parsear correo completo ──────────────────
  private async parseCorreo(
    id:       string,
    threadId: string
  ): Promise<CorreoSolicitud | null> {
    try {
      const res     = await this.gmail.users.messages.get({ userId: 'me', id, format: 'full' });
      const headers = res.data.payload?.headers ?? [];
      const get     = (name: string) => headers.find(h => h.name === name)?.value ?? '';

      return {
        id,
        threadId,
        fecha:    get('Date'),
        de:       get('From'),
        asunto:   get('Subject'),
        cuerpo:   this.extractBody(res.data.payload),
        labelIds: res.data.labelIds ?? [],
      };
    } catch (err) {
      console.error(`Error parseando correo ${id}:`, err);
      return null;
    }
  }

  // ── Extraer texto plano del body ─────────────
  private extractBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
    if (!payload) return '';

    if (payload.mimeType === 'text/plain' && payload.body?.data) {
      return Buffer.from(payload.body.data, 'base64').toString('utf-8');
    }

    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          return Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
      }
      for (const part of payload.parts) {
        const found = this.extractBody(part);
        if (found) return found;
      }
    }
    return '';
  }

  // ── Construir email RFC 2822 en base64url ────
  private buildRawEmail(para: string, asunto: string, cuerpo: string): string {
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

  // ── OAuth2: construir cliente ────────────────
  private async buildOAuth2Client(): Promise<Auth.OAuth2Client> {
    const raw  = await fs.readFile(CREDENTIALS_PATH, 'utf-8');
    const json = JSON.parse(raw) as {
      installed?: { client_id: string; client_secret: string };
      web?:       { client_id: string; client_secret: string };
    };
    const key = json.installed ?? json.web;
    if (!key) throw new Error('credenciales.json no tiene "installed" ni "web"');

    // ✅ google.auth.OAuth2 usa la misma copia interna que googleapis → sin conflicto
    return new google.auth.OAuth2(key.client_id, key.client_secret, REDIRECT_URI);
  }

  // ── OAuth2: cargar token guardado ────────────
  private async tryLoadToken(): Promise<boolean> {
    try {
      const raw    = await fs.readFile(TOKEN_PATH, 'utf-8');
      const tokens = JSON.parse(raw) as Auth.Credentials;
      
      console.log(`📂 Token encontrado en ${TOKEN_PATH}`);
      console.log(`   - access_token: ${tokens.access_token ? '✅ presente' : '❌ ausente'}`);
      console.log(`   - refresh_token: ${tokens.refresh_token ? '✅ presente' : '❌ ausente'}`);
      console.log(`   - expiry_date: ${tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : 'no especificada'}`);

      // ✅ CORRECCIÓN: Configurar el token EN EL CLIENTE
      this.client.setCredentials(tokens);
      console.log('✅ Token configurado en el cliente OAuth2');

      // ✅ VERIFICACIÓN: Validar que el token se configuró
      const configured = this.client.credentials;
      if (!configured.access_token) {
        throw new Error('❌ Token no se configuró correctamente en el cliente');
      }

      // ✅ Manejar expiración y refresh
      const expiry = tokens.expiry_date ?? 0;
      const now = Date.now();
      const isExpired = now > expiry;
      
      if (isExpired && tokens.refresh_token) {
        console.log('⏰ Token expirado, intentando renovación...');
        try {
          const { credentials } = await this.client.refreshAccessToken();
          this.client.setCredentials(credentials);
          
          // ✅ Guardar el token renovado
          await fs.writeFile(TOKEN_PATH, JSON.stringify(credentials, null, 2));
          console.log('✅ Token renovado y guardado exitosamente');
          return true;
        } catch (refreshErr) {
          console.error('❌ Error renovando token:', refreshErr);
          console.log('   → El refresh_token probablemente expiró. Requiere autenticación nueva.');
          return false;
        }
      }

      if (isExpired) {
        console.warn('⚠️  Token expirado y no hay refresh_token disponible');
        return false;
      }

      console.log('✅ Token válido y cargado correctamente');
      return true;
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        console.log('📭 Archivo token.json no existe (primera ejecución)');
      } else {
        console.error('❌ Error cargando token:', err.message);
      }
      return false;
    }
  }

  // ── OAuth2: flujo completo de autenticación ──
  private async runAuthFlow(): Promise<void> {
    console.log('\n🔐 Iniciando flujo de autenticación OAuth2...');
    console.log(`   Scopes solicitados: ${SCOPES.length} permisos`);
    
    const authUrl = this.client.generateAuthUrl({
      access_type: 'offline',
      prompt:      'consent',
      scope:       SCOPES,
    });

    console.log('\n🌐 Abrí esta URL en el navegador:\n');
    console.log('   ' + authUrl, '\n');

    try {
      const { default: open } = await import('open');
      await open(authUrl);
      console.log('✅ Navegador abierto automáticamente');
    } catch { 
      console.log('ℹ️  Si el navegador no se abrió, copie la URL anterior');
    }

    const code = await new Promise<string>((resolve, reject) => {
      const server = http.createServer((req, res) => {
        if (!req.url) return;
        const params = new URL(req.url, REDIRECT_URI).searchParams;
        const code   = params.get('code');
        const error  = params.get('error');

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(
          code
            ? '<h2>✅ ¡Autenticación exitosa! Podés cerrar esta pestaña.</h2>'
            : `<h2>❌ Error: ${error ?? 'desconocido'}</h2>`
        );
        server.close();
        
        if (code) {
          console.log('✅ Código de autorización recibido del navegador');
          resolve(code);
        } else {
          console.error(`❌ Error en el navegador: ${error}`);
          reject(new Error(`OAuth error: ${error}`));
        }
      });

      server.listen(3000, () =>
        console.log('⏳ Esperando respuesta en http://localhost:3000 ...\n')
      );
      server.on('error', (err) => {
        console.error(`❌ Error del servidor local: ${err.message}`);
        reject(err);
      });
    });

    console.log('🔄 Intercambiando código por token...');
    try {
      const { tokens } = await this.client.getToken(code);
      
      console.log('✅ Token recibido de Google:');
      console.log(`   - access_token: ${tokens.access_token ? '✅ presente' : '❌ ausente'}`);
      console.log(`   - refresh_token: ${tokens.refresh_token ? '✅ presente' : '❌ ausente'}`);
      console.log(`   - token_type: ${tokens.token_type || 'desconocido'}`);
      console.log(`   - expiry_date: ${tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : 'no especificada'}`);
      
      // ✅ Configurar el token en el cliente
      this.client.setCredentials(tokens);
      console.log('✅ Token configurado en el cliente OAuth2');

      // ✅ Guardar el token
      await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens, null, 2));
      console.log(`💾 Token guardado en ${TOKEN_PATH}`);

      // ✅ VERIFICACIÓN: Validar que el token se guardó y se puede leer
      const saved = JSON.parse(await fs.readFile(TOKEN_PATH, 'utf-8')) as Auth.Credentials;
      if (!saved.access_token) {
        throw new Error('❌ Token guardado pero sin access_token');
      }
      console.log('✅ Token verificado en disco\n');
    } catch (err) {
      console.error('❌ Error obteniendo o guardando token:', err);
      throw err;
    }
  }
}