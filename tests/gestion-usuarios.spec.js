// =============================================================================
// SCRIPT DE AUTOMATIZACIÓN QA - ESCENARIOS COMPLETOS
// URL: https://demo1.codigoveloz.lol/
// Playwright v7.0 — Login / Creación / Eliminación + Prometheus/Grafana
// =============================================================================

const { test, expect } = require('@playwright/test');
const fs   = require('fs');
const path = require('path');

// =============================================================================
// ── DATOS DE PRUEBA ───────────────────────────────────────────────────────────
// =============================================================================

// 5 logins válidos
const LOGINS_VALIDOS = [
  { email: 'asd@gmail.com',   password: '123123' },
  { email: 'asd@gmail.com',   password: '123123' },
  { email: 'asd@gmail.com',   password: '123123' },
  { email: 'asd@gmail.com',   password: '123123' },
  { email: 'asd@gmail.com',   password: '123123' },
];

// 5 logins inválidos
const LOGINS_INVALIDOS = [
  { email: 'invalido@gmail.com',  password: 'wrongpass',   razon: 'Email inexistente' },
  { email: 'asd@gmail.com',       password: 'wrongpass',   razon: 'Password incorrecto' },
  { email: '',                    password: '123123',       razon: 'Email vacío' },
  { email: 'asd@gmail.com',       password: '',             razon: 'Password vacío' },
  { email: 'noexiste@test.com',   password: '000000',       razon: 'Usuario no registrado' },
];

// 5 usuarios válidos a crear (el tuyo + 4 similares)
const USUARIOS_VALIDOS = [
  { nombre: 'Ausberto Andres Vargas Silva', email: 'andsorepopcorns@gmail.com',  password: 'P4ssw0rd2026' },
  { nombre: 'Maria Fernanda Lopez',         email: 'mfernanda.qa@gmail.com',      password: 'Secure2026!' },
  { nombre: 'Carlos Eduardo Mendoza',       email: 'cemendoza.qa@gmail.com',      password: 'Test2026!!' },
  { nombre: 'Lucia Patricia Suarez',        email: 'lpsuarez.qa@gmail.com',       password: 'Pass2026!!' },
  { nombre: 'Roberto Javier Rios',          email: 'rjrios.qa@gmail.com',         password: 'Qa2026Pass!' },
];

// 5 usuarios inválidos (datos que deben fallar validación)
const USUARIOS_INVALIDOS = [
  { nombre: 'A',   email: 'invalido_corto@gmail.com',   password: '123',       razon: 'Nombre < 2 chars, password < 6 chars' },
  { nombre: '',    email: 'invalido_sin_nombre@gmail.com', password: 'pass123', razon: 'Nombre vacío' },
  { nombre: 'Test invalido email', email: 'correo-sin-arroba', password: 'pass123', razon: 'Email inválido' },
  { nombre: 'Test sin password',   email: 'sinpass.qa@gmail.com', password: '', razon: 'Password vacío' },
  { nombre: 'B',   email: 'b.qa@gmail.com',             password: '12345',     razon: 'Nombre y password cortos' },
];

// Credencial admin para operaciones post-login
const ADMIN = { email: 'asd@gmail.com', password: '123123' };

// =============================================================================
// ── MÉTRICAS ──────────────────────────────────────────────────────────────────
// =============================================================================
const metricas = {
  // Login
  loginValidos_passed: 0, loginValidos_failed: 0,
  loginInvalidos_passed: 0, loginInvalidos_failed: 0,
  // Creación
  creacionValidos_passed: 0, creacionValidos_failed: 0,
  creacionInvalidos_passed: 0, creacionInvalidos_failed: 0,
  // Eliminación
  eliminaciones_passed: 0, eliminaciones_failed: 0,
  // General
  total_passed: 0, total_failed: 0,
  durationSeconds: 0, successRate: 0, timestamp: 0,
  stepDurations: {},
};

const reporteEventos = [];
let tiempoInicio = Date.now();

function registrar(tipo, descripcion, detalle = '', exito = true) {
  const ts = new Date().toLocaleTimeString('es-BO', { hour12: false });
  reporteEventos.push({ timestamp: ts, tipo, descripcion, detalle, exito });
  console.log(`[${ts}] ${exito ? '✅' : '❌'} [${tipo}] ${descripcion}${detalle ? ' | ' + detalle : ''}`);
}

function contabilizar(exito) {
  if (exito) metricas.total_passed++; else metricas.total_failed++;
}

async function esperar(page, ms = 1500) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(ms);
}

async function medirPaso(nombre, fn) {
  const t0 = Date.now();
  try { await fn(); }
  finally { metricas.stepDurations[nombre] = ((Date.now() - t0) / 1000).toFixed(2); }
}

// =============================================================================
// ── HELPERS ───────────────────────────────────────────────────────────────────
// =============================================================================

// Guardar métricas JSON para Prometheus
function guardarMetricas() {
  const dur = (Date.now() - tiempoInicio) / 1000;
  metricas.durationSeconds = parseFloat(dur.toFixed(2));
  const total = metricas.total_passed + metricas.total_failed;
  metricas.successRate = total > 0 ? parseFloat(((metricas.total_passed / total) * 100).toFixed(1)) : 0;
  metricas.timestamp   = Math.floor(Date.now() / 1000);

  const p = path.join(__dirname, '..', 'reports', 'playwright-metrics.json');
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(metricas, null, 2), 'utf-8');
  console.log(`\n  📊 Métricas guardadas → ${p}`);
  console.log(`     ✅ ${metricas.total_passed}  ❌ ${metricas.total_failed}  📈 ${metricas.successRate}%  ⏱ ${metricas.durationSeconds}s`);
}

// Navegar a /users con Livewire hidratado
async function irAUsers(page) {
  await page.goto('https://demo1.codigoveloz.lol/users', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await page.locator('button[wire\\:click="openCreate"]').waitFor({ state: 'visible', timeout: 15000 });
}

// Login como admin para gestión de usuarios
async function loginAdmin(page) {
  await page.goto('https://demo1.codigoveloz.lol/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.locator('input[wire\\:model="email"]').waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('input[wire\\:model="email"]').fill(ADMIN.email);
  await page.locator('input[wire\\:model="password"]').fill(ADMIN.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/users', { timeout: 15000 });
  await page.waitForTimeout(2500);
  await page.locator('button[wire\\:click="openCreate"]').waitFor({ state: 'visible', timeout: 15000 });
}

// Logout
async function logout(page) {
  const btn = page.locator('button[type="submit"]:has-text("Cerrar sesión")');
  if (await btn.isVisible().catch(() => false)) {
    await btn.click();
    await page.waitForURL('**/login', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1500);
  }
}

// =============================================================================
// ── ESCENARIO 1: LOGINS ───────────────────────────────────────────────────────
// =============================================================================

async function escenarioLoginValidos(page) {
  console.log('\n' + '═'.repeat(55));
  console.log('  🔐 ESCENARIO 1A — 5 Logins Válidos');
  console.log('═'.repeat(55));

  for (let i = 0; i < LOGINS_VALIDOS.length; i++) {
    const cred = LOGINS_VALIDOS[i];
    registrar('LOGIN-V', `Intento válido #${i + 1}`, cred.email);

    // Asegurar página de login limpia
    await logout(page);
    await page.goto('https://demo1.codigoveloz.lol/login', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    await page.locator('input[wire\\:model="email"]').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('input[wire\\:model="email"]').fill(cred.email);
    await page.locator('input[wire\\:model="password"]').fill(cred.password);
    await page.locator('button[type="submit"]').click();

    // Esperar resultado
    await page.waitForTimeout(3000);
    const exito = page.url().includes('users');

    if (exito) { metricas.loginValidos_passed++; contabilizar(true); }
    else       { metricas.loginValidos_failed++;  contabilizar(false); }

    registrar('LOGIN-V', `Login válido #${i + 1}: ${exito ? 'PASÓ ✔' : 'FALLÓ ✖'}`, page.url(), exito);
  }
}

async function escenarioLoginInvalidos(page) {
  console.log('\n' + '═'.repeat(55));
  console.log('  🔐 ESCENARIO 1B — 5 Logins Inválidos');
  console.log('═'.repeat(55));

  for (let i = 0; i < LOGINS_INVALIDOS.length; i++) {
    const cred = LOGINS_INVALIDOS[i];
    registrar('LOGIN-I', `Intento inválido #${i + 1}`, cred.razon);

    await logout(page);
    await page.goto('https://demo1.codigoveloz.lol/login', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    await page.locator('input[wire\\:model="email"]').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('input[wire\\:model="email"]').fill(cred.email);
    await page.locator('input[wire\\:model="password"]').fill(cred.password);
    await page.locator('button[type="submit"]').click();

    await page.waitForTimeout(3000);

    // Para logins inválidos: esperamos QUEDARSE en /login (NO redirigir a /users)
    const seQueduEnLogin = !page.url().includes('users');
    const exito = seQueduEnLogin; // el test PASA si el sistema rechazó correctamente

    // Verificar mensaje de error
    const tieneError = await page.locator('text=credenciales, text=incorrectas, text=invalid, [class*="error"], [class*="danger"]')
      .isVisible().catch(() => false);

    if (exito) { metricas.loginInvalidos_passed++; contabilizar(true); }
    else       { metricas.loginInvalidos_failed++;  contabilizar(false); }

    registrar('LOGIN-I',
      `Inválido #${i + 1} rechazado: ${exito ? 'SÍ ✔ (correcto)' : 'NO ✖ (dejó entrar)'}`,
      `${cred.razon} | error_msg: ${tieneError}`, exito);
  }
}

// =============================================================================
// ── ESCENARIO 2: CREACIÓN DE USUARIOS ─────────────────────────────────────────
// =============================================================================

async function escenarioCreacionValida(page) {
  console.log('\n' + '═'.repeat(55));
  console.log('  👤 ESCENARIO 2A — 5 Creaciones Válidas');
  console.log('═'.repeat(55));

  for (let i = 0; i < USUARIOS_VALIDOS.length; i++) {
    const u = USUARIOS_VALIDOS[i];
    registrar('CREAR-V', `Usuario válido #${i + 1}`, u.nombre);

    const btnNuevo = page.locator('button[wire\\:click="openCreate"]');
    await btnNuevo.waitFor({ state: 'visible', timeout: 15000 });
    await btnNuevo.click();
    await page.waitForTimeout(2000);

    await page.locator('input[wire\\:model="name"]').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('input[wire\\:model="name"]').fill(u.nombre);
    await page.locator('input[wire\\:model="email"]').fill(u.email);
    await page.locator('input[wire\\:model="password"]').fill(u.password);

    await page.locator('button[wire\\:click="save"]').click();
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1000);

    const enLista = await page.locator(`text=${u.email}`).isVisible().catch(() => false);
    if (enLista) { metricas.creacionValidos_passed++; contabilizar(true); }
    else         { metricas.creacionValidos_failed++;  contabilizar(false); }

    registrar('CREAR-V', `#${i + 1} en lista: ${enLista ? 'SÍ ✔' : 'NO ✖'}`, u.email, enLista);
  }
}

async function escenarioCreacionInvalida(page) {
  console.log('\n' + '═'.repeat(55));
  console.log('  👤 ESCENARIO 2B — 5 Creaciones Inválidas');
  console.log('═'.repeat(55));

  for (let i = 0; i < USUARIOS_INVALIDOS.length; i++) {
    const u = USUARIOS_INVALIDOS[i];
    registrar('CREAR-I', `Usuario inválido #${i + 1}`, u.razon);

    const btnNuevo = page.locator('button[wire\\:click="openCreate"]');
    await btnNuevo.waitFor({ state: 'visible', timeout: 15000 });
    await btnNuevo.click();
    await page.waitForTimeout(2000);

    await page.locator('input[wire\\:model="name"]').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('input[wire\\:model="name"]').fill(u.nombre);
    await page.locator('input[wire\\:model="email"]').fill(u.email);
    await page.locator('input[wire\\:model="password"]').fill(u.password);

    await page.locator('button[wire\\:click="save"]').click();
    await page.waitForTimeout(2500);

    // El test PASA si el sistema muestra error de validación (no creó el usuario)
    const hayErrorValidacion = await page.locator('p.text-red-500, .text-red-500, [class*="error"]')
      .first().isVisible().catch(() => false);

    // También verificar que el modal sigue abierto (no cerró = validación fallida)
    const modalSigueAbierto = await page.locator('input[wire\\:model="name"]').isVisible().catch(() => false);

    const exito = hayErrorValidacion || modalSigueAbierto;

    if (exito) { metricas.creacionInvalidos_passed++; contabilizar(true); }
    else       { metricas.creacionInvalidos_failed++;  contabilizar(false); }

    registrar('CREAR-I',
      `#${i + 1} rechazado: ${exito ? 'SÍ ✔ (validación ok)' : 'NO ✖ (debería rechazar)'}`,
      u.razon, exito);

    // Cerrar modal si sigue abierto
    const btnCancelar = page.locator('button[wire\\:click="closeModal"]');
    if (await btnCancelar.isVisible().catch(() => false)) {
      await btnCancelar.click();
      await page.waitForTimeout(1500);
    }
  }
}

// =============================================================================
// ── ESCENARIO 3: ELIMINACIÓN ──────────────────────────────────────────────────
// =============================================================================

async function escenarioEliminacion(page) {
  console.log('\n' + '═'.repeat(55));
  console.log('  🗑️  ESCENARIO 3 — 5 Eliminaciones');
  console.log('═'.repeat(55));

  // Eliminar los primeros 5 usuarios válidos creados en el escenario 2
  const usuariosAEliminar = USUARIOS_VALIDOS.slice(0, 5);

  for (let i = 0; i < usuariosAEliminar.length; i++) {
    const u = usuariosAEliminar[i];
    registrar('ELIMINAR', `Eliminando #${i + 1}`, u.email);

    // Buscar la fila en la tabla (puede estar en página 2 si hay paginación)
    let fila = page.locator(`tr:has-text("${u.email}")`).first();
    let filaVisible = await fila.isVisible().catch(() => false);

    // Si no está en página actual, buscar en página 2
    if (!filaVisible) {
      const btnNext = page.locator('button[wire\\:click*="nextPage"], button:has-text("Next")').first();
      if (await btnNext.isVisible().catch(() => false)) {
        await btnNext.click();
        await page.waitForTimeout(2000);
        fila = page.locator(`tr:has-text("${u.email}")`).first();
        filaVisible = await fila.isVisible().catch(() => false);
      }
    }

    if (!filaVisible) {
      registrar('ELIMINAR', `#${i + 1} no encontrado en lista`, u.email, false);
      metricas.eliminaciones_failed++;
      contabilizar(false);
      continue;
    }

    // Clic en botón eliminar (ícono papelera, title="Eliminar")
    const btnEliminar = fila.locator('button[title="Eliminar"]');
    await btnEliminar.waitFor({ state: 'visible', timeout: 8000 });
    await btnEliminar.click();
    registrar('ELIMINAR', 'Modal de confirmación abierto');
    await page.waitForTimeout(2000);

    // Botón de confirmación — confirmado: wire:click="delete"
    const btnConfirmar = page.locator('button[wire\\:click="delete"]');
    await btnConfirmar.waitFor({ state: 'visible', timeout: 8000 });
    await btnConfirmar.click();
    registrar('ELIMINAR', 'Confirmación clickeada');

    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1000);

    // Verificar que ya NO aparece en la lista
    const sigueEnLista = await page.locator(`text=${u.email}`).isVisible().catch(() => false);
    const exito = !sigueEnLista;

    if (exito) { metricas.eliminaciones_passed++; contabilizar(true); }
    else       { metricas.eliminaciones_failed++;  contabilizar(false); }

    registrar('ELIMINAR', `#${i + 1} eliminado: ${exito ? 'SÍ ✔' : 'NO ✖'}`, u.email, exito);
  }
}

// =============================================================================
// ── REPORTE HTML ──────────────────────────────────────────────────────────────
// =============================================================================
function generarReporteHTML() {
  const ahora    = new Date().toLocaleString('es-BO');
  const exitosos = reporteEventos.filter(e => e.exito).length;
  const fallidos = reporteEventos.filter(e => !e.exito).length;

  const filas = reporteEventos.map(e => `
    <tr class="${e.exito ? 'ok' : 'fail'}">
      <td>${e.timestamp}</td>
      <td><span class="badge badge-${e.tipo.toLowerCase()}">${e.tipo}</span></td>
      <td>${e.descripcion}</td><td>${e.detalle || '—'}</td>
      <td>${e.exito ? '✅ OK' : '❌ FAIL'}</td>
    </tr>`).join('');

  const escenarios = [
    { label: 'Login Válidos ✔',     passed: metricas.loginValidos_passed,      failed: metricas.loginValidos_failed },
    { label: 'Login Inválidos ✔',   passed: metricas.loginInvalidos_passed,    failed: metricas.loginInvalidos_failed },
    { label: 'Creación Válida ✔',   passed: metricas.creacionValidos_passed,   failed: metricas.creacionValidos_failed },
    { label: 'Creación Inválida ✔', passed: metricas.creacionInvalidos_passed, failed: metricas.creacionInvalidos_failed },
    { label: 'Eliminaciones ✔',     passed: metricas.eliminaciones_passed,     failed: metricas.eliminaciones_failed },
  ];

  const escRows = escenarios.map(s => `
    <tr>
      <td>${s.label}</td>
      <td class="green">${s.passed}</td>
      <td class="${s.failed > 0 ? 'red' : 'green'}">${s.failed}</td>
      <td>${s.passed + s.failed}</td>
      <td>${s.passed + s.failed > 0 ? ((s.passed/(s.passed+s.failed))*100).toFixed(0) + '%' : '—'}</td>
    </tr>`).join('');

  const stepRows = Object.entries(metricas.stepDurations).map(([k, v]) => `
    <tr><td>${k}</td><td>${v}s</td>
    <td><div style="background:#334155;border-radius:4px;height:8px">
      <div style="background:#6366f1;border-radius:4px;height:8px;width:${Math.min(parseFloat(v)*5,100)}%"></div>
    </div></td></tr>`).join('');

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
  <title>Reporte QA v7 — Escenarios Completos</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;padding:2rem}
    header{display:flex;align-items:center;gap:1rem;margin-bottom:2rem;padding-bottom:1.5rem;border-bottom:1px solid #1e293b}
    .logo{width:52px;height:52px;background:linear-gradient(135deg,#6366f1,#a855f7);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.6rem}
    h1{font-size:1.5rem;font-weight:700;color:#f8fafc}h1 span{font-size:.82rem;color:#94a3b8;display:block;margin-top:2px}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:1rem;margin-bottom:2rem}
    .card{background:#1e293b;border-radius:12px;padding:1.1rem 1.3rem;border:1px solid #334155}
    .card-label{font-size:.7rem;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em}
    .card-value{font-size:1.9rem;font-weight:700;margin-top:.3rem}
    .green{color:#4ade80}.red{color:#f87171}.blue{color:#60a5fa}.purple{color:#c084fc}.yellow{color:#fbbf24}
    h2{font-size:.95rem;font-weight:600;color:#cbd5e1;margin-bottom:.8rem;margin-top:.5rem}
    .section{margin-bottom:1.8rem}.tw{background:#1e293b;border-radius:12px;overflow:hidden;border:1px solid #334155}
    table{width:100%;border-collapse:collapse;font-size:.82rem}
    thead tr{background:#0f172a}thead th{text-align:left;padding:.6rem .9rem;color:#64748b;font-weight:600;text-transform:uppercase;font-size:.68rem;border-bottom:1px solid #334155}
    tbody tr{border-bottom:1px solid #1e293b}tbody tr:hover{background:#1e293b88}tbody td{padding:.6rem .9rem;vertical-align:middle}
    tbody tr.fail{background:rgba(239,68,68,.06)}tbody tr.fail td{color:#fca5a5}
    .badge{display:inline-block;padding:.15rem .5rem;border-radius:999px;font-size:.65rem;font-weight:700;text-transform:uppercase;white-space:nowrap}
    .badge-login-v{background:#1e3a8a33;color:#93c5fd}.badge-login-i{background:#44403c33;color:#d1d5db}
    .badge-crear-v{background:#14532d33;color:#86efac}.badge-crear-i{background:#78350f33;color:#fcd34d}
    .badge-eliminar{background:#7f1d1d33;color:#fca5a5}.badge-logout{background:#1f293744;color:#94a3b8}
    .badge-error{background:#991b1b33;color:#f87171}
    td:first-child{color:#64748b;font-size:.75rem;font-family:monospace}
    .prom{background:#1e293b;border:1px solid #334155;border-radius:12px;padding:1.2rem;margin-bottom:1.8rem}
    .prom pre{background:#0f172a;border-radius:8px;padding:.9rem;font-size:.76rem;color:#86efac;margin-top:.5rem;overflow-x:auto}
    footer{margin-top:3rem;text-align:center;color:#475569;font-size:.76rem;border-top:1px solid #1e293b;padding-top:1.5rem}
  </style></head><body>
  <header><div class="logo">🧪</div>
    <div><h1>Reporte QA — Escenarios Completos
      <span>demo1.codigoveloz.lol &nbsp;|&nbsp; ${ahora} &nbsp;|&nbsp; v7.0</span></h1></div></header>

  <div class="grid">
    <div class="card"><div class="card-label">Duración</div><div class="card-value blue">${metricas.durationSeconds}s</div></div>
    <div class="card"><div class="card-label">Tasa éxito</div><div class="card-value ${metricas.successRate===100?'green':'yellow'}">${metricas.successRate}%</div></div>
    <div class="card"><div class="card-label">Total ✅</div><div class="card-value green">${metricas.total_passed}</div></div>
    <div class="card"><div class="card-label">Total ❌</div><div class="card-value ${metricas.total_failed>0?'red':'green'}">${metricas.total_failed}</div></div>
    <div class="card"><div class="card-label">Login OK</div><div class="card-value blue">${metricas.loginValidos_passed}/5</div></div>
    <div class="card"><div class="card-label">Rechazo OK</div><div class="card-value blue">${metricas.loginInvalidos_passed}/5</div></div>
    <div class="card"><div class="card-label">Creados</div><div class="card-value purple">${metricas.creacionValidos_passed}/5</div></div>
    <div class="card"><div class="card-label">Eliminados</div><div class="card-value purple">${metricas.eliminaciones_passed}/5</div></div>
  </div>

  <div class="section"><h2>📊 Resumen por Escenario</h2>
    <div class="tw"><table>
      <thead><tr><th>Escenario</th><th>Pasaron</th><th>Fallaron</th><th>Total</th><th>%</th></tr></thead>
      <tbody>${escRows}</tbody>
    </table></div></div>

  <div class="prom"><h2>📡 Métricas → Prometheus → Grafana</h2>
    <pre>playwright_login_validos_passed      ${metricas.loginValidos_passed}
playwright_login_invalidos_passed    ${metricas.loginInvalidos_passed}
playwright_creacion_validos_passed   ${metricas.creacionValidos_passed}
playwright_creacion_invalidos_passed ${metricas.creacionInvalidos_passed}
playwright_eliminaciones_passed      ${metricas.eliminaciones_passed}
playwright_total_passed              ${metricas.total_passed}
playwright_total_failed              ${metricas.total_failed}
playwright_success_rate              ${metricas.successRate}
playwright_duration_seconds          ${metricas.durationSeconds}</pre></div>

  <div class="section"><h2>⏱️ Duración por Escenario</h2>
    <div class="tw"><table>
      <thead><tr><th>Paso</th><th>Tiempo</th><th>Barra</th></tr></thead>
      <tbody>${stepRows || '<tr><td colspan="3">Sin datos</td></tr>'}</tbody>
    </table></div></div>

  <div class="section"><h2>📋 Log completo de ejecución</h2>
    <div class="tw"><table>
      <thead><tr><th>Hora</th><th>Tipo</th><th>Descripción</th><th>Detalle</th><th>Estado</th></tr></thead>
      <tbody>${filas}</tbody>
    </table></div></div>

  <footer>Playwright QA v7.0 · Prometheus: <strong>localhost:9091/metrics</strong> · Grafana: <strong>localhost:3000</strong></footer>
</body></html>`;
}

// =============================================================================
// ── TEST PRINCIPAL ────────────────────────────────────────────────────────────
// =============================================================================
test('QA Completo — Login + Creación + Eliminación', async ({ page }) => {
  tiempoInicio = Date.now();
  console.log('\n' + '═'.repeat(55));
  console.log('  🧪 PLAYWRIGHT QA v7.0 — ESCENARIOS COMPLETOS');
  console.log('  Prometheus → Grafana integrado');
  console.log('═'.repeat(55));

  try {
    // ── ESCENARIO 1: LOGINS ─────────────────────────────────────────────────
    await medirPaso('1a_login_validos',   () => escenarioLoginValidos(page));
    await medirPaso('1b_login_invalidos', () => escenarioLoginInvalidos(page));

    // ── Login admin para escenarios 2 y 3 ──────────────────────────────────
    await loginAdmin(page);

    // ── ESCENARIO 2: CREACIÓN ───────────────────────────────────────────────
    await medirPaso('2a_creacion_valida',   () => escenarioCreacionValida(page));
    await medirPaso('2b_creacion_invalida', () => escenarioCreacionInvalida(page));

    // ── Recargar /users para tener lista actualizada ────────────────────────
    await irAUsers(page);

    // ── ESCENARIO 3: ELIMINACIÓN ────────────────────────────────────────────
    await medirPaso('3_eliminacion', () => escenarioEliminacion(page));

    registrar('RESUMEN', `✔ Todos los escenarios completados`,
      `✅${metricas.total_passed} ❌${metricas.total_failed} 📈${metricas.successRate}%`);

  } catch (error) {
    metricas.total_failed++;
    registrar('ERROR', 'Error crítico', error.message, false);
    throw error;

  } finally {
    guardarMetricas();

    const reportePath = path.join(__dirname, '..', 'reports', 'reporte-qa.html');
    fs.mkdirSync(path.dirname(reportePath), { recursive: true });
    fs.writeFileSync(reportePath, generarReporteHTML(), 'utf-8');

    console.log('\n' + '═'.repeat(55));
    console.log(`  📄 HTML:       reports/reporte-qa.html`);
    console.log(`  📊 MÉTRICAS:   reports/playwright-metrics.json`);
    console.log(`  📡 PROMETHEUS: http://localhost:9091/metrics`);
    console.log(`  📈 GRAFANA:    http://localhost:3000`);
    console.log('═'.repeat(55) + '\n');
  }
});
