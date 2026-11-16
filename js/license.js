// Licencia «Informe de liquidación»: el código de activación lo muestra Stripe tras el pago
// (mensaje de confirmación del Payment Link). La web solo contiene su huella SHA-256.
export const CONFIG = {
  // Payment Link de Stripe — VACÍO hasta que el Director lo cree (ver manual-actions.md).
  // Vacío => botón «Próximamente» desactivado, ningún enlace roto.
  checkoutUrl: 'https://buy.stripe.com/aFa14m7rJ31l6nmbDL4AU06',
  // SHA-256 del código de activación de producción (FINI-XXXX-XXXX, en mayúsculas, sin espacios).
  // El código en claro está en CODE-SECRET.txt (excluido por .gitignore). Los tests usan una copia con el hash de prueba.
  codeHashes: ['da040a2636570ce860e174f57598c14a7b86b0779f63a17b7cf03c5e9ac8b7d9'],
  price: '9 €',
};

const KEY = 'finiquito.license';

export async function sha256Hex(text) {
  const data = new TextEncoder().encode(text.trim().toUpperCase());
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function isValidCode(code) {
  if (!code || !code.trim()) return false;
  try { return CONFIG.codeHashes.includes(await sha256Hex(code)); } catch { return false; }
}

let sessionCode = ''; // si localStorage no está disponible, la licencia vale para la sesión

export function loadLicense() {
  try { return localStorage.getItem(KEY) || sessionCode; } catch { return sessionCode; }
}

export async function hasLicense() {
  return isValidCode(loadLicense());
}

export async function activate(code) {
  if (!(await isValidCode(code))) return false;
  sessionCode = code.trim().toUpperCase();
  try { localStorage.setItem(KEY, sessionCode); } catch { /* almacenamiento no disponible */ }
  return true;
}
