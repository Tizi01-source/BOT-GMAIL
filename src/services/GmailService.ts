import { promises as fs } from 'fs'; // Para leer y escribir archivos de forma asíncrona
import * as http from 'http'; // Para crear un servidor temporal que reciba la respuesta de autenticación OAuth2
import { URL } from 'url'; // Para parsear URLs y extraer parámetros (como el código de autorización)

// Librería oficial de Google para Node.js, que incluye soporte para Gmail API y OAuth2.
import { google, Auth, gmail_v1 } from 'googleapis'; 
// Importamos la configuración desde config.ts, que incluye rutas de archivos, queries de búsqueda, etc.
import { CONFIG } from '../config'; 
// Importamos tipos personalizados para tipar mejor nuestro código (definidos en type.ts).
import type { CorreoSolicitud, AdjuntoCorreo } from '../types'; 

// Permisos necesarios para la aplicación (SCOPES)
// Por ahora, tiene permiso para leer, sacarle la etiqueta de "no leído" y contestar.
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',      // Leer correos
  'https://www.googleapis.com/auth/gmail.modify',        // Modificar etiquetas, marcar como leído
  'https://www.googleapis.com/auth/gmail.send',          // Enviar respuestas
];


// GmailService: Clase principal para interactuar con Gmail API.
export class GmailService {
  private client!: Auth.OAuth2Client; // Cliente OAuth2 para autenticación
  private gmail!: gmail_v1.Gmail; // Cliente de Gmail API para llamadas a la API
  private inicializado = false; // Flag para asegurar que init() se ejecutó antes de usar otros métodos

  // El método init() es crítico para asegurar que el servicio esté listo antes de usarlo.
  async init(): Promise<void> {
    console.log('📧 Inicializando GmailService...');

    // Construir cliente OAuth2
    this.client = await this.construirOAuth2Client();
    console.log('✅ Cliente OAuth2 creado');

    // Intentar cargar token guardado previamente
    const tokenCargado = await this.intentarCargarToken();
    console.log(`📋 Token previo ${tokenCargado ? 'cargado' : 'no encontrado'}`);

    // Si no se pudo cargar un token válido, ejecutar el flujo de autenticación
    if (!tokenCargado) {
      await this.ejecutarFlujoAutenticacion();
    }

    // Validar que el cliente OAuth2 tiene un access_token después de la autenticación.
    const creds = this.client.credentials;
    if (!creds || !creds.access_token) {
      throw new Error(
        '❌ CRÍTICO: Cliente OAuth2 sin access_token después de autenticación.\n' +
        'Las credenciales no se configuraron correctamente.'
      );
    }

    // Mostrar información del token para diagnóstico
    console.log('✅ Access token presente en el cliente');
    console.log(`   Token tipo: ${creds.token_type || 'desconocido'}`);
    console.log(
      `   Expira en: ${
        creds.expiry_date
          ? new Date(creds.expiry_date).toLocaleString('es-AR')
          : 'desconocido'
      }`
    );

    // Configurar cliente de Gmail API con el cliente OAuth2 autenticado
    this.gmail = google.gmail({
      version: 'v1',
      auth: this.client,
    });

    this.inicializado = true;
    console.log('✅ GmailService inicializado correctamente.\n');
  }

  // Busca mensajes que coincidan con la query definida en CONFIG, los procesa y devuelve un array de objetos tipó CorreoSolicitud (creado en type.ts).
  async obtenerSolicitudes(
    maxResultados: number = 20
  ): Promise<CorreoSolicitud[]> {
    // Validar que init() se ejecutó antes de usar este método
    this.validarInicializacion();

    try {
      console.log(`🔍 Buscando solicitudes (máx ${maxResultados})...`);

      // Listar mensajes que coincidan con la query de búsqueda (ej: "is:unread has:attachment")
      // Esto devuelve solo los IDs de los mensajes, no el contenido completo.
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: CONFIG.email.busquedaQuery,
        maxResults: maxResultados,
      });

      // Si no hay mensajes, response.data.messages será undefined, por eso usamos ?? [] para asegurar que sea un array.
      const mensajes = response.data.messages ?? [];
      console.log(`   Encontrados: ${mensajes.length} correos`);

      const correos: CorreoSolicitud[] = []; // Array para almacenar los correos procesados

      // Google devuelve solo los IDs, no el contenido. Por eso, hace un bucle, por cada ID usa parsearCorreo().
      for (const msg of mensajes) {
        if (!msg.id || !msg.threadId) continue;

        // Por cada mensaje, obtenemos su contenido completo (incluyendo adjuntos) usando parsearCorreo().
        const correo = await this.parsearCorreo(msg.id, msg.threadId);
        // Si el correo se parseó correctamente (no es null), lo agregamos al array de correos válidos.
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

  // Marca un correo como leído (remueve la etiqueta "UNREAD")
  // Todavía no estamos usando esta función en app.ts, pero sera vital para mas tarde.
  async marcarLeido(messageId: string): Promise<void> {
    // Validar que init() se ejecutó antes de usar este método.
    this.validarInicializacion();

    try {
      // Para marcar un correo como leído, usamos el método "modify" de Gmail API para remover la etiqueta "UNREAD".
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

  // Envía una respuesta a un correo específico, dentro del mismo hilo de conversación (threadId).
  // Todavía no estamos usando esta función en app.ts, pero sera vital para mas tarde. 
  // Acá vamos a mandarle el cupo disponible al comercial.
  async responder(
    threadId: string,
    para: string,
    asunto: string,
    cuerpo: string
  ): Promise<string> {
    // Validar que init() se ejecutó antes de usar este método.
    this.validarInicializacion();

    try {
      // Para enviar una respuesta, construimos un email en formato RFC 2822 (con headers como "To", "Subject", etc.) y lo codificamos en base64url.
      const raw = this.construirEmailRFC2822(para, asunto, cuerpo);

      // Luego, usamos el método "send" de Gmail API para enviar el correo. Es importante incluir el threadId para que la respuesta quede dentro del mismo hilo de conversación.
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

  // Método privado para obtener el contenido completo de un correo, incluyendo sus adjuntos. Devuelve un objeto CorreoSolicitud o null si hubo un error.
  private async parsearCorreo(
    id: string,
    threadId: string
  ): Promise<CorreoSolicitud | null> {
    try {
      // Para obtener el contenido completo de un correo, usamos el método "get" de Gmail API con el formato "full". Esto nos devuelve toda la información del correo, incluyendo headers, cuerpo y partes (que pueden contener adjuntos).
      const response = await this.gmail.users.messages.get({
        userId: 'me',
        id,
        format: 'full',
      });

      // Extraer headers importantes (Date, From, Subject) para mostrar en la consola y usar en la lógica de negocio.
      const headers = response.data.payload?.headers ?? [];
      const obtenerHeader = (nombre: string) =>
        headers.find(h => h.name === nombre)?.value ?? '';

      // Descargar adjuntos del correo (si los tiene) usando el método descargarAdjuntos(), que se encarga de iterar por las partes del correo y obtener los datos de los adjuntos.
      const adjuntos = await this.descargarAdjuntos(
        id,
        response.data.payload?.parts ?? []
      );

      // Finalmente, construimos y devolvemos un objeto CorreoSolicitud con toda la información relevante del correo (id, threadId, fecha, remitente, asunto, cuerpo en texto plano, etiquetas y adjuntos).
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

  // Método privado para descargar los adjuntos de un correo. Itera por las partes del correo, identifica cuáles son adjuntos (basado en la presencia de filename y attachmentId) y descarga sus datos usando Gmail API. Devuelve un array de objetos AdjuntoCorreo con la información de cada adjunto (id, nombre, tipo MIME y datos en formato Buffer).
  private async descargarAdjuntos(
    messageId: string,
    parts: gmail_v1.Schema$MessagePart[]
  ): Promise<AdjuntoCorreo[]> {
    // Array para almacenar los adjuntos descargados.
    const adjuntos: AdjuntoCorreo[] = [];

    // Iteramos por cada parte del correo para identificar cuáles son adjuntos. Un adjunto se identifica porque tiene un "filename" (nombre de archivo) y un "attachmentId" en su cuerpo.
    for (const part of parts) {
      // Usamos filename y attachmentId directamente para saber si es un adjunto
      const fileName = part.filename;
      const attachmentId = part.body?.attachmentId;

      // Si no tiene nombre de archivo o no tiene token de adjunto, lo ignoramos
      if (!fileName || !attachmentId) continue;

      // Si es un adjunto, intentamos descargarlo usando Gmail API. El método "get" de Gmail API nos devuelve los datos del adjunto en formato base64url, que luego convertimos a un Buffer para manejarlo como datos binarios.
      try {
        const response = await this.gmail.users.messages.attachments.get({
          userId: 'me',
          messageId,
          id: attachmentId, 
        });

        // El campo "data" del adjunto viene codificado en base64url, así que lo convertimos a un Buffer para poder manejarlo como datos binarios (por ejemplo, para guardarlo en disco o procesarlo).
        const datosBase64Url = response.data.data ?? '';
        const datos = Buffer.from(datosBase64Url, 'base64url');

        // Agregamos el adjunto al array de adjuntos con su id, nombre, tipo MIME (si no está definido, usamos "application/octet-stream" como fallback) y los datos en formato Buffer.
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

  // Método privado para extraer el cuerpo del correo en texto plano. Gmail API puede devolver el cuerpo del correo de diferentes formas dependiendo de su estructura (simple o multipart). Este método maneja ambos casos: si el cuerpo está directamente en la parte principal (mimeType "text/plain"), lo extrae; si el correo es multipart, busca recursivamente en las partes hasta encontrar un "text/plain" y lo extrae. Si no encuentra un cuerpo en texto plano, devuelve una cadena vacía.
  private extraerCuerpoTexto(
    payload: gmail_v1.Schema$MessagePart | undefined
  ): string {
    // Si no hay payload, no hay cuerpo, devolvemos cadena vacía.
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

  // Método privado para construir un email en formato RFC 2822, que es el formato que Gmail API espera para enviar correos. Este método recibe el destinatario, asunto y cuerpo del correo, y construye un string con los headers necesarios (To, Subject, Content-Type, MIME-Version) seguido del cuerpo del mensaje. Luego, codifica todo el email en base64url para que pueda ser enviado a través de Gmail API.
  private construirEmailRFC2822(
    para: string,
    asunto: string,
    cuerpo: string
  ): string {
    // Construimos el email como un string con los headers y el cuerpo. Es importante que los headers estén separados por saltos de línea y que haya una línea en blanco entre los headers y el cuerpo.
    const email = [
      `To: ${para}`,
      'Content-Type: text/plain; charset=utf-8',
      'MIME-Version: 1.0',
      `Subject: ${asunto}`,
      '',
      cuerpo,
    ].join('\n');

    // Codificamos el email completo en base64url, que es el formato que Gmail API espera para el campo "raw" al enviar correos.
    return Buffer.from(email).toString('base64url');
  }

  // METODOS DE AUTENTICACION =========================================================================================

  // Método privado para construir el cliente OAuth2 a partir de las credenciales almacenadas en un archivo JSON. Este método lee el archivo de credenciales, extrae el client_id y client_secret (ya sea del bloque "installed" o "web", dependiendo del formato del archivo), y luego crea una instancia de google.auth.OAuth2 con esos datos y la redirectUri definida en la configuración.
  private async construirOAuth2Client(): Promise<Auth.OAuth2Client> {
    const raw = await fs.readFile(CONFIG.gmail.credencialesPath, 'utf-8');
    const json = JSON.parse(raw) as {
      installed?: { client_id: string; client_secret: string };
      web?: { client_id: string; client_secret: string };
    };

    // El archivo de credenciales puede tener la información en un bloque "installed" o "web", dependiendo de cómo se haya descargado desde Google Cloud Console. Intentamos obtener el bloque correcto y extraer client_id y client_secret.
    const key = json.installed ?? json.web;
    if (!key) {
      throw new Error(
        '❌ credenciales.json no tiene "installed" ni "web"'
      );
    }

    // Creamos y devolvemos una instancia de google.auth.OAuth2 con el client_id, client_secret y redirectUri. Esta instancia se usará para manejar todo el flujo de autenticación OAuth2.
    return new google.auth.OAuth2(
      key.client_id,
      key.client_secret,
      CONFIG.gmail.redirectUri
    );
  }

  // Método privado para intentar cargar un token previamente guardado en disco. Este método lee el archivo de token, lo parsea y configura el cliente OAuth2 con las credenciales. También maneja la expiración del token: si el token está expirado pero tiene un refresh_token, intenta renovarlo automáticamente. Devuelve true si se cargó un token válido (ya sea el original o uno renovado), o false si no se pudo cargar un token válido.
  private async intentarCargarToken(): Promise<boolean> {
    try {
      // Leer el archivo de token guardado previamente. Si el archivo no existe, se lanzará un error que capturamos para manejar el caso de primera ejecución.
      const raw = await fs.readFile(CONFIG.gmail.tokenPath, 'utf-8');
      const tokens = JSON.parse(raw) as Auth.Credentials;

      console.log(`📂 Token encontrado en ${CONFIG.gmail.tokenPath}`);
      console.log(
        `   - access_token: ${tokens.access_token ? '✅' : '❌'}`
      );
      console.log(
        `   - refresh_token: ${tokens.refresh_token ? '✅' : '❌'}`
      );

      // Configurar el cliente OAuth2 con las credenciales cargadas del archivo.
      this.client.setCredentials(tokens);
      console.log('✅ Token configurado en el cliente OAuth2');

      // Validar que el token tenga un access_token. Es posible que el archivo exista pero no tenga un token válido, por eso verificamos esto antes de continuar.
      const configurado = this.client.credentials;
      if (!configurado.access_token) {
        throw new Error('Token no se configuró correctamente');
      }

      // Verificar si el token está expirado. Si el token tiene una fecha de expiración y ya pasó esa fecha, entonces el token está expirado. Si el token está expirado pero tiene un refresh_token, intentamos renovarlo automáticamente usando el método refreshAccessToken() del cliente OAuth2. Si la renovación es exitosa, guardamos el nuevo token en disco. Si no se puede renovar (por ejemplo, si el refresh_token también expiró), entonces se requiere una nueva autenticación.
      const ahora = Date.now();
      const expira = tokens.expiry_date ?? 0;
      const estaExpirado = ahora > expira;

      // Si el token está expirado pero tiene un refresh_token, intentamos renovarlo automáticamente.
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

      // Si el token está expirado y no tiene refresh_token, no se puede renovar automáticamente, por lo que se requiere una nueva autenticación.
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

  // Método privado para ejecutar el flujo completo de autenticación OAuth2. Este método genera la URL de autenticación, la muestra en la consola e intenta abrirla automáticamente en el navegador. Luego, crea un servidor HTTP temporal para recibir la respuesta de autenticación (el código de autorización) que Google redirige después de que el usuario concede permisos. Una vez que recibe el código, lo intercambia por un token de acceso usando Gmail API, configura el cliente OAuth2 con el nuevo token y lo guarda en disco para futuras ejecuciones.
  private async ejecutarFlujoAutenticacion(): Promise<void> {
    console.log('\n🔐 Iniciando flujo de autenticación OAuth2...');
    console.log(`   Scopes solicitados: ${SCOPES.length} permisos`);

    // Generar la URL de autenticación con los scopes necesarios. Esta URL es la que el usuario debe abrir en su navegador para conceder permisos a la aplicación.
    const authUrl = this.client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: SCOPES,
    });

    console.log('\n🌐 Abre esta URL en el navegador:\n');
    console.log('   ' + authUrl + '\n');

    // Intentar abrir la URL automáticamente en el navegador predeterminado del usuario usando la librería "open". Si no se puede abrir automáticamente (por ejemplo, si la librería no está instalada o hay un error), se muestra un mensaje indicando que el usuario debe abrir la URL manualmente.
    try {
      const { default: open } = await import('open');
      await open(authUrl);
      console.log('✅ Navegador abierto automáticamente');
    } catch {
      console.log('ℹ️  Abre manualmente la URL anterior');
    }

    // Crear un servidor HTTP temporal para recibir la respuesta de autenticación. Google redirige a la URL definida en redirectUri (http://localhost:3000) después de que el usuario concede permisos, incluyendo el código de autorización como parámetro en la URL. Este servidor escucha esa redirección, extrae el código de autorización y luego se cierra automáticamente.
    const code = await new Promise<string>((resolve, reject) => {
      const servidor = http.createServer((req, res) => {
        if (!req.url) return;

        // Extraer el código de autorización o el error de los parámetros de la URL. La URL tendrá la forma http://localhost:3000/?code=... o http://localhost:3000/?error=... dependiendo de si el usuario concedió permisos o no.
        const params = new URL(req.url, CONFIG.gmail.redirectUri)
          .searchParams;
        const codigo = params.get('code');
        const error = params.get('error');

        // Responder al navegador con un mensaje indicando si la autenticación fue exitosa o si hubo un error. Luego, cerrar el servidor para liberar el puerto.
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
        });
        res.end(
          codigo
            ? '<h2>✅ ¡Autenticación exitosa! Podés cerrar esta pestaña.</h2>'
            : `<h2>❌ Error: ${error ?? 'desconocido'}</h2>`
        );

        // Cerrar el servidor después de manejar la solicitud, ya que solo necesitamos recibir una respuesta de autenticación.
        servidor.close();

        // Si recibimos un código de autorización, resolvemos la promesa con ese código. Si recibimos un error, rechazamos la promesa con un error descriptivo.
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

    // Intercambiar el código de autorización por un token de acceso usando Gmail API. Si el intercambio es exitoso, configuramos el cliente OAuth2 con las nuevas credenciales y guardamos el token en disco para futuras ejecuciones. Si hay un error durante este proceso, lo capturamos y mostramos un mensaje descriptivo.
    console.log('🔄 Intercambiando código por token...');
    try {
      // El método getToken() del cliente OAuth2 intercambia el código de autorización por un token de acceso (y opcionalmente un refresh_token). Si el intercambio es exitoso, obtenemos las credenciales en el campo "tokens".
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

      // Configurar el cliente OAuth2 con las nuevas credenciales obtenidas del intercambio.
      this.client.setCredentials(tokens);
      console.log('✅ Token configurado');

      // Guardar el token en disco para futuras ejecuciones. Esto permite que la próxima vez que se ejecute la aplicación, pueda cargar el token guardado y evitar tener que pasar por el proceso de autenticación nuevamente (a menos que el token haya expirado).
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

  // Método privado para validar que el servicio esté inicializado antes de ejecutar cualquier operación que requiera autenticación. Si el servicio no está inicializado (es decir, si init() no se ejecutó o no se completó correctamente), lanza un error indicando que se debe ejecutar init() primero. Esto ayuda a prevenir errores de autenticación y asegura que el cliente OAuth2 y el cliente de Gmail API estén configurados antes de usarlos.
  private validarInicializacion(): void {
    if (!this.inicializado) {
      throw new Error(
        'GmailService no inicializado. Ejecuta await gmail.init() primero.'
      );
    }
  }

  // Método privado para diagnosticar errores de forma más detallada. Este método recibe un error y el contexto (nombre del método donde ocurrió el error) y muestra información relevante en la consola para ayudar a identificar la causa del error. Por ejemplo, si el error tiene un código de estado HTTP 401, se indica que el token es inválido o expirado y se sugiere eliminar token.json y reiniciar. Si el error es un 403, se indica que no se tienen permisos para esa acción y se sugiere verificar los scopes. Si es un 404, se indica que el recurso no fue encontrado.
  private diagnosticarError(err: any, contexto: string): void {
    console.error(`\n❌ Error en ${contexto}():`, err.message);

    // Diagnosticar errores comunes basados en el código de estado HTTP (si el error tiene una respuesta con un status). Esto ayuda a proporcionar mensajes de error más claros y sugerencias de solución específicas para problemas comunes de autenticación y permisos.
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
