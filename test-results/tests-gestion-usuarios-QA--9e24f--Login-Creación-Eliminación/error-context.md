# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests\gestion-usuarios.spec.js >> QA Completo — Login + Creación + Eliminación
- Location: tests\gestion-usuarios.spec.js:484:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.goto: Test timeout of 30000ms exceeded.
Call log:
  - navigating to "https://demo1.codigoveloz.lol/login", waiting until "domcontentloaded"

```

# Test source

```ts
  60  |   loginInvalidos_passed: 0, loginInvalidos_failed: 0,
  61  |   // Creación
  62  |   creacionValidos_passed: 0, creacionValidos_failed: 0,
  63  |   creacionInvalidos_passed: 0, creacionInvalidos_failed: 0,
  64  |   // Eliminación
  65  |   eliminaciones_passed: 0, eliminaciones_failed: 0,
  66  |   // General
  67  |   total_passed: 0, total_failed: 0,
  68  |   durationSeconds: 0, successRate: 0, timestamp: 0,
  69  |   stepDurations: {},
  70  | };
  71  | 
  72  | const reporteEventos = [];
  73  | let tiempoInicio = Date.now();
  74  | 
  75  | function registrar(tipo, descripcion, detalle = '', exito = true) {
  76  |   const ts = new Date().toLocaleTimeString('es-BO', { hour12: false });
  77  |   reporteEventos.push({ timestamp: ts, tipo, descripcion, detalle, exito });
  78  |   console.log(`[${ts}] ${exito ? '✅' : '❌'} [${tipo}] ${descripcion}${detalle ? ' | ' + detalle : ''}`);
  79  | }
  80  | 
  81  | function contabilizar(exito) {
  82  |   if (exito) metricas.total_passed++; else metricas.total_failed++;
  83  | }
  84  | 
  85  | async function esperar(page, ms = 1500) {
  86  |   await page.waitForLoadState('networkidle').catch(() => {});
  87  |   await page.waitForTimeout(ms);
  88  | }
  89  | 
  90  | async function medirPaso(nombre, fn) {
  91  |   const t0 = Date.now();
  92  |   try { await fn(); }
  93  |   finally { metricas.stepDurations[nombre] = ((Date.now() - t0) / 1000).toFixed(2); }
  94  | }
  95  | 
  96  | // =============================================================================
  97  | // ── HELPERS ───────────────────────────────────────────────────────────────────
  98  | // =============================================================================
  99  | 
  100 | // Guardar métricas JSON para Prometheus
  101 | function guardarMetricas() {
  102 |   const dur = (Date.now() - tiempoInicio) / 1000;
  103 |   metricas.durationSeconds = parseFloat(dur.toFixed(2));
  104 |   const total = metricas.total_passed + metricas.total_failed;
  105 |   metricas.successRate = total > 0 ? parseFloat(((metricas.total_passed / total) * 100).toFixed(1)) : 0;
  106 |   metricas.timestamp   = Math.floor(Date.now() / 1000);
  107 | 
  108 |   const p = path.join(__dirname, '..', 'reports', 'playwright-metrics.json');
  109 |   fs.mkdirSync(path.dirname(p), { recursive: true });
  110 |   fs.writeFileSync(p, JSON.stringify(metricas, null, 2), 'utf-8');
  111 |   console.log(`\n  📊 Métricas guardadas → ${p}`);
  112 |   console.log(`     ✅ ${metricas.total_passed}  ❌ ${metricas.total_failed}  📈 ${metricas.successRate}%  ⏱ ${metricas.durationSeconds}s`);
  113 | }
  114 | 
  115 | // Navegar a /users con Livewire hidratado
  116 | async function irAUsers(page) {
  117 |   await page.goto('https://demo1.codigoveloz.lol/users', { waitUntil: 'domcontentloaded' });
  118 |   await page.waitForTimeout(2500);
  119 |   await page.locator('button[wire\\:click="openCreate"]').waitFor({ state: 'visible', timeout: 15000 });
  120 | }
  121 | 
  122 | // Login como admin para gestión de usuarios
  123 | async function loginAdmin(page) {
  124 |   await page.goto('https://demo1.codigoveloz.lol/login', { waitUntil: 'domcontentloaded' });
  125 |   await page.waitForTimeout(1500);
  126 |   await page.locator('input[wire\\:model="email"]').waitFor({ state: 'visible', timeout: 10000 });
  127 |   await page.locator('input[wire\\:model="email"]').fill(ADMIN.email);
  128 |   await page.locator('input[wire\\:model="password"]').fill(ADMIN.password);
  129 |   await page.locator('button[type="submit"]').click();
  130 |   await page.waitForURL('**/users', { timeout: 15000 });
  131 |   await page.waitForTimeout(2500);
  132 |   await page.locator('button[wire\\:click="openCreate"]').waitFor({ state: 'visible', timeout: 15000 });
  133 | }
  134 | 
  135 | // Logout
  136 | async function logout(page) {
  137 |   const btn = page.locator('button[type="submit"]:has-text("Cerrar sesión")');
  138 |   if (await btn.isVisible().catch(() => false)) {
  139 |     await btn.click();
  140 |     await page.waitForURL('**/login', { timeout: 10000 }).catch(() => {});
  141 |     await page.waitForTimeout(1500);
  142 |   }
  143 | }
  144 | 
  145 | // =============================================================================
  146 | // ── ESCENARIO 1: LOGINS ───────────────────────────────────────────────────────
  147 | // =============================================================================
  148 | 
  149 | async function escenarioLoginValidos(page) {
  150 |   console.log('\n' + '═'.repeat(55));
  151 |   console.log('  🔐 ESCENARIO 1A — 5 Logins Válidos');
  152 |   console.log('═'.repeat(55));
  153 | 
  154 |   for (let i = 0; i < LOGINS_VALIDOS.length; i++) {
  155 |     const cred = LOGINS_VALIDOS[i];
  156 |     registrar('LOGIN-V', `Intento válido #${i + 1}`, cred.email);
  157 | 
  158 |     // Asegurar página de login limpia
  159 |     await logout(page);
> 160 |     await page.goto('https://demo1.codigoveloz.lol/login', { waitUntil: 'domcontentloaded' });
      |                ^ Error: page.goto: Test timeout of 30000ms exceeded.
  161 |     await page.waitForTimeout(1500);
  162 | 
  163 |     await page.locator('input[wire\\:model="email"]').waitFor({ state: 'visible', timeout: 10000 });
  164 |     await page.locator('input[wire\\:model="email"]').fill(cred.email);
  165 |     await page.locator('input[wire\\:model="password"]').fill(cred.password);
  166 |     await page.locator('button[type="submit"]').click();
  167 | 
  168 |     // Esperar resultado
  169 |     await page.waitForTimeout(3000);
  170 |     const exito = page.url().includes('users');
  171 | 
  172 |     if (exito) { metricas.loginValidos_passed++; contabilizar(true); }
  173 |     else       { metricas.loginValidos_failed++;  contabilizar(false); }
  174 | 
  175 |     registrar('LOGIN-V', `Login válido #${i + 1}: ${exito ? 'PASÓ ✔' : 'FALLÓ ✖'}`, page.url(), exito);
  176 |   }
  177 | }
  178 | 
  179 | async function escenarioLoginInvalidos(page) {
  180 |   console.log('\n' + '═'.repeat(55));
  181 |   console.log('  🔐 ESCENARIO 1B — 5 Logins Inválidos');
  182 |   console.log('═'.repeat(55));
  183 | 
  184 |   for (let i = 0; i < LOGINS_INVALIDOS.length; i++) {
  185 |     const cred = LOGINS_INVALIDOS[i];
  186 |     registrar('LOGIN-I', `Intento inválido #${i + 1}`, cred.razon);
  187 | 
  188 |     await logout(page);
  189 |     await page.goto('https://demo1.codigoveloz.lol/login', { waitUntil: 'domcontentloaded' });
  190 |     await page.waitForTimeout(1500);
  191 | 
  192 |     await page.locator('input[wire\\:model="email"]').waitFor({ state: 'visible', timeout: 10000 });
  193 |     await page.locator('input[wire\\:model="email"]').fill(cred.email);
  194 |     await page.locator('input[wire\\:model="password"]').fill(cred.password);
  195 |     await page.locator('button[type="submit"]').click();
  196 | 
  197 |     await page.waitForTimeout(3000);
  198 | 
  199 |     // Para logins inválidos: esperamos QUEDARSE en /login (NO redirigir a /users)
  200 |     const seQueduEnLogin = !page.url().includes('users');
  201 |     const exito = seQueduEnLogin; // el test PASA si el sistema rechazó correctamente
  202 | 
  203 |     // Verificar mensaje de error
  204 |     const tieneError = await page.locator('text=credenciales, text=incorrectas, text=invalid, [class*="error"], [class*="danger"]')
  205 |       .isVisible().catch(() => false);
  206 | 
  207 |     if (exito) { metricas.loginInvalidos_passed++; contabilizar(true); }
  208 |     else       { metricas.loginInvalidos_failed++;  contabilizar(false); }
  209 | 
  210 |     registrar('LOGIN-I',
  211 |       `Inválido #${i + 1} rechazado: ${exito ? 'SÍ ✔ (correcto)' : 'NO ✖ (dejó entrar)'}`,
  212 |       `${cred.razon} | error_msg: ${tieneError}`, exito);
  213 |   }
  214 | }
  215 | 
  216 | // =============================================================================
  217 | // ── ESCENARIO 2: CREACIÓN DE USUARIOS ─────────────────────────────────────────
  218 | // =============================================================================
  219 | 
  220 | async function escenarioCreacionValida(page) {
  221 |   console.log('\n' + '═'.repeat(55));
  222 |   console.log('  👤 ESCENARIO 2A — 5 Creaciones Válidas');
  223 |   console.log('═'.repeat(55));
  224 | 
  225 |   for (let i = 0; i < USUARIOS_VALIDOS.length; i++) {
  226 |     const u = USUARIOS_VALIDOS[i];
  227 |     registrar('CREAR-V', `Usuario válido #${i + 1}`, u.nombre);
  228 | 
  229 |     const btnNuevo = page.locator('button[wire\\:click="openCreate"]');
  230 |     await btnNuevo.waitFor({ state: 'visible', timeout: 15000 });
  231 |     await btnNuevo.click();
  232 |     await page.waitForTimeout(2000);
  233 | 
  234 |     await page.locator('input[wire\\:model="name"]').waitFor({ state: 'visible', timeout: 10000 });
  235 |     await page.locator('input[wire\\:model="name"]').fill(u.nombre);
  236 |     await page.locator('input[wire\\:model="email"]').fill(u.email);
  237 |     await page.locator('input[wire\\:model="password"]').fill(u.password);
  238 | 
  239 |     await page.locator('button[wire\\:click="save"]').click();
  240 |     await page.waitForTimeout(3000);
  241 |     await page.waitForLoadState('networkidle').catch(() => {});
  242 |     await page.waitForTimeout(1000);
  243 | 
  244 |     const enLista = await page.locator(`text=${u.email}`).isVisible().catch(() => false);
  245 |     if (enLista) { metricas.creacionValidos_passed++; contabilizar(true); }
  246 |     else         { metricas.creacionValidos_failed++;  contabilizar(false); }
  247 | 
  248 |     registrar('CREAR-V', `#${i + 1} en lista: ${enLista ? 'SÍ ✔' : 'NO ✖'}`, u.email, enLista);
  249 |   }
  250 | }
  251 | 
  252 | async function escenarioCreacionInvalida(page) {
  253 |   console.log('\n' + '═'.repeat(55));
  254 |   console.log('  👤 ESCENARIO 2B — 5 Creaciones Inválidas');
  255 |   console.log('═'.repeat(55));
  256 | 
  257 |   for (let i = 0; i < USUARIOS_INVALIDOS.length; i++) {
  258 |     const u = USUARIOS_INVALIDOS[i];
  259 |     registrar('CREAR-I', `Usuario inválido #${i + 1}`, u.razon);
  260 | 
```