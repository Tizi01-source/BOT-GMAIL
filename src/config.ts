import * as path from 'path';

const projectRoot = process.cwd();

export const CONFIG = {
  gmail: {
    credencialesPath: path.join(projectRoot, 'credenciales.json'),
    tokenPath:        path.join(projectRoot, 'token.json'),
    redirectUri:      'http://localhost:3000',
  },
  email: {
    busquedaQuery:  'is:unread subject:(cupo OR solicitud)',  
  },
};