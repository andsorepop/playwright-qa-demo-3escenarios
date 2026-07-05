// =============================================================================
// SCRIPT QA — ESCENARIOS COMPLETOS v8.0
// Fix: timeout navegación + logout simplificado + reintentos en goto
// =============================================================================

const { test } = require('@playwright/test');
const fs   = require('fs');
const path = require('path');

// =============================================================================
// DATOS DE PRUEBA
// =============================================================================
const LOGINS_VALIDOS = Array(5).fill({ email: 'asd@gmail.com', password: '123123' });

const LOGINS_INVALIDOS = [
  { email: 'invalido@gmail.com', password: 'wrongpass',  razon: 'Email inexistente' },
  { email: 'asd@gmail.com',      password: 'wrongpass',  razon: 'Password incorrecto' },
  { email: '',                   password: '123123',      razon: 'Email vacío' },
  { email: 'asd@gmail.com',      password: '',            razon: 'Password vacío' },
  { email: 'noexiste@test.com',  password: '000000',      razon: 'Usuario no registrado' },
];

const USUARIOS_VALIDOS = [
  { nombre: 'Ausberto Andres Vargas Silva', email: 'andsorepopcorns@gmail.com', password: 'P4ssw0rd2026' },
  { nombre: 'Maria Fernanda Lopez',         email: 'mfernanda.qa@gmail.com',     password: 'Secure2026!' },
  { nombre: 'Carlos Eduardo Mendoza',       email: 'cemendoza.qa@gmail.com',     password: 'Test2026!!' },
  { nombre: 'Lucia Patricia Suarez',        email: 'lpsuarez.qa@gmail.com',      password: 'Pass2026!!' },
  { nombre: 'Roberto Javier Rios',          email: 'rjrios.qa@gmail.com',        password: 'Qa2026Pass!' },
];

const USUARIOS_INVALIDOS = [
  { nombre: 'A',  email: 'invalido_corto@gmail.com',    password: '123',     razon: 'Nombre y pass muy cortos' },
  { nombre: '',   email: 'invalido_vacio@gmail.com',     password: 'pass123', razon: 'Nombre vacío' },
  { nombre: 'Test email mal', email: 'sin-arroba',       password: 'pass123', razon: 'Email sin @' },
  { nombre: 'Test sin pass',  email: 'sinpass@gmail.com',password: '',        razon: 'Password vacío' },
  { nombre: 'B',  email: 'b.qa@gmail.com',              password: '12345',   razon: 'Nombre y pass cortos' },
];

const ADMIN = { email: 'asd@gmail.com', password: '123123' };
const BASE_URL = 'https://demo1.codigoveloz.lol';

// =============================================================================
// MÉTRICAS
// =============================================================================
const M = {
  loginValidos_passed: 0, loginValidos_failed: 0,
  loginInvalidos_passed: 0, loginInvalidos_failed: 0,
  creacionValidos_passed: 0, creacionValidos_failed: 0,
  creacionInvalidos_passed: 0, creacionInvalidos_failed: 0,
  eliminaciones_passed: 0, eliminaciones_failed: 0,
  total_passed: 0, total_failed: 0,
  durationSeconds: 0, successRate: 0, timestamp: 0,
  stepDurations: {},
};
const LOG = [];
let t0 = Date.now();

function reg(tipo, desc, detalle = '', ok = true) {
  const ts = new Date().toLocaleTimeString('es-BO', { hour12: false });
  LOG.push({ timestamp: ts, tipo, descripcion: desc, detalle, exito: ok });
  console.log(`[${ts}] ${ok ? '✅' : '❌'} [${tipo}] ${desc}${detalle ? ' | ' + detalle : ''}`);
}

function cnt(ok) { if (ok) M.total_passed++; else M.total_failed++; }

// ── GOTO con reintento ────────────────────────────────────────────────────────
async function irA(page, url, espera = 2000) {
  for (let i = 0; i < 3; i++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 40000 });
      await page.waitForTimeout(espera);
      return;
    } catch (e) {
      if (i === 2) throw e;
      console.log(`  ⚠️ Reintento ${i + 1} navegando a ${url}`);
      await page.waitForTimeout(3000);
    }
  }
}

async function medirPaso(nombre, fn) {
  const t = Date.now();
  try { await fn(); }
  finally { M.stepDurations[nombre] = ((Date.now() - t) / 1000).toFixed(2); }
}

// =============================================================================
// HELPERS
// =============================================================================

// Logout: múltiples estrategias para cerrar sesión de forma confiable
async function forzarLoginPage(page) {
  await irA(page, `${BASE_URL}/login`, 1500);

  // Si redirigió al dashboard → hay sesión activa, hay que cerrarla
  if (!page.url().includes('login')) {

    let logoutOk = false;

    // Estrategia 1: click normal con scroll previo
    try {
      const btnOut = page.locator('button[type="submit"]:has-text("Cerrar sesión")');
      if (await btnOut.isVisible({ timeout: 3000 }).catch(() => false)) {
        await btnOut.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        await btnOut.click({ force: true, timeout: 5000 });
        await page.waitForTimeout(2000);
        logoutOk = page.url().includes('login');
      }
    } catch (_) {}

    // Estrategia 2: click via JavaScript si el click normal falla
    if (!logoutOk) {
      try {
        await page.evaluate(() => {
          const btns = [...document.querySelectorAll('button[type="submit"]')];
          const btn  = btns.find(b => b.textContent.includes('Cerrar'));
          if (btn) btn.click();
        });
        await page.waitForTimeout(2500);
        logoutOk = page.url().includes('login');
      } catch (_) {}
    }

    // Estrategia 3: llamar al endpoint de logout directamente
    if (!logoutOk) {
      try {
        await page.goto(`${BASE_URL}/logout`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(2000);
        logoutOk = page.url().includes('login');
      } catch (_) {}
    }

    // Estrategia 4: limpiar cookies y storage (fuerza sesión limpia)
    if (!logoutOk) {
      await page.context().clearCookies();
      await page.evaluate(() => {
        try { localStorage.clear(); sessionStorage.clear(); } catch(_) {}
      });
      await page.waitForTimeout(500);
    }

    // Volver a /login con sesión limpia
    await irA(page, `${BASE_URL}/login`, 1500);
  }
}

async function loginAdmin(page) {
  await forzarLoginPage(page);
  await page.locator('input[wire\\:model="email"]').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('input[wire\\:model="email"]').fill(ADMIN.email);
  await page.locator('input[wire\\:model="password"]').fill(ADMIN.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(`${BASE_URL}/users`, { timeout: 20000 });
  await page.waitForTimeout(2500);
  await page.locator('button[wire\\:click="openCreate"]').waitFor({ state: 'visible', timeout: 15000 });
}

async function irAUsers(page) {
  if (!page.url().includes('users')) {
    await irA(page, `${BASE_URL}/users`, 2500);
  } else {
    await page.waitForTimeout(1500);
  }
  await page.locator('button[wire\\:click="openCreate"]').waitFor({ state: 'visible', timeout: 15000 });
}

function guardarMetricas() {
  const dur = (Date.now() - t0) / 1000;
  M.durationSeconds = parseFloat(dur.toFixed(2));
  const total = M.total_passed + M.total_failed;
  M.successRate = total > 0 ? parseFloat(((M.total_passed / total) * 100).toFixed(1)) : 0;
  M.timestamp   = Math.floor(Date.now() / 1000);
  const p = path.join(__dirname, '..', 'reports', 'playwright-metrics.json');
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(M, null, 2), 'utf-8');
  console.log(`\n  📊 ✅${M.total_passed} ❌${M.total_failed} 📈${M.successRate}% ⏱${M.durationSeconds}s`);
}

// =============================================================================
// ESCENARIO 1A — 5 LOGINS VÁLIDOS
// =============================================================================
async function escenarioLoginValidos(page) {
  console.log('\n' + '═'.repeat(55));
  console.log('  🔐 ESCENARIO 1A — 5 Logins Válidos');
  console.log('═'.repeat(55));

  for (let i = 0; i < LOGINS_VALIDOS.length; i++) {
    const c = LOGINS_VALIDOS[i];
    reg('LOGIN-V', `Válido #${i + 1}`, c.email);

    await forzarLoginPage(page);

    await page.locator('input[wire\\:model="email"]').waitFor({ state: 'visible', timeout: 12000 });
    await page.locator('input[wire\\:model="email"]').fill(c.email);
    await page.locator('input[wire\\:model="password"]').fill(c.password);
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(4000);

    const ok = page.url().includes('users');
    if (ok) M.loginValidos_passed++; else M.loginValidos_failed++;
    cnt(ok);
    reg('LOGIN-V', `#${i + 1}: ${ok ? 'PASÓ ✔' : 'FALLÓ ✖'}`, page.url(), ok);
  }
}

// =============================================================================
// ESCENARIO 1B — 5 LOGINS INVÁLIDOS
// =============================================================================
async function escenarioLoginInvalidos(page) {
  console.log('\n' + '═'.repeat(55));
  console.log('  🔐 ESCENARIO 1B — 5 Logins Inválidos');
  console.log('═'.repeat(55));

  for (let i = 0; i < LOGINS_INVALIDOS.length; i++) {
    const c = LOGINS_INVALIDOS[i];
    reg('LOGIN-I', `Inválido #${i + 1}`, c.razon);

    await forzarLoginPage(page);

    await page.locator('input[wire\\:model="email"]').waitFor({ state: 'visible', timeout: 12000 });
    await page.locator('input[wire\\:model="email"]').fill(c.email);
    await page.locator('input[wire\\:model="password"]').fill(c.password);
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(4000);

    const rechazado = !page.url().includes('users');
    if (rechazado) M.loginInvalidos_passed++; else M.loginInvalidos_failed++;
    cnt(rechazado);
    reg('LOGIN-I', `#${i + 1} rechazado: ${rechazado ? 'SÍ ✔' : 'NO ✖ (dejó entrar)'}`, c.razon, rechazado);
  }
}

// =============================================================================
// ESCENARIO 2A — 5 CREACIONES VÁLIDAS
// =============================================================================
async function escenarioCreacionValida(page) {
  console.log('\n' + '═'.repeat(55));
  console.log('  👤 ESCENARIO 2A — 5 Creaciones Válidas');
  console.log('═'.repeat(55));

  for (let i = 0; i < USUARIOS_VALIDOS.length; i++) {
    const u = USUARIOS_VALIDOS[i];
    reg('CREAR-V', `Válido #${i + 1}`, u.nombre);

    await irAUsers(page);

    await page.locator('button[wire\\:click="openCreate"]').click();
    await page.waitForTimeout(2000);

    await page.locator('input[wire\\:model="name"]').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('input[wire\\:model="name"]').fill(u.nombre);
    await page.locator('input[wire\\:model="email"]').fill(u.email);
    await page.locator('input[wire\\:model="password"]').fill(u.password);
    await page.locator('button[wire\\:click="save"]').click();

    await page.waitForTimeout(3500);
    await page.waitForLoadState('networkidle').catch(() => {});

    const ok = await page.locator(`text=${u.email}`).isVisible().catch(() => false);
    if (ok) M.creacionValidos_passed++; else M.creacionValidos_failed++;
    cnt(ok);
    reg('CREAR-V', `#${i + 1} en lista: ${ok ? 'SÍ ✔' : 'NO ✖'}`, u.email, ok);
  }
}

// =============================================================================
// ESCENARIO 2B — 5 CREACIONES INVÁLIDAS
// =============================================================================
async function escenarioCreacionInvalida(page) {
  console.log('\n' + '═'.repeat(55));
  console.log('  👤 ESCENARIO 2B — 5 Creaciones Inválidas');
  console.log('═'.repeat(55));

  for (let i = 0; i < USUARIOS_INVALIDOS.length; i++) {
    const u = USUARIOS_INVALIDOS[i];
    reg('CREAR-I', `Inválido #${i + 1}`, u.razon);

    await irAUsers(page);

    await page.locator('button[wire\\:click="openCreate"]').click();
    await page.waitForTimeout(2000);

    await page.locator('input[wire\\:model="name"]').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('input[wire\\:model="name"]').fill(u.nombre);
    await page.locator('input[wire\\:model="email"]').fill(u.email);
    await page.locator('input[wire\\:model="password"]').fill(u.password);
    await page.locator('button[wire\\:click="save"]').click();
    await page.waitForTimeout(2500);

    const hayError = await page.locator('p.text-red-500').first().isVisible().catch(() => false);
    const modalAbierto = await page.locator('input[wire\\:model="name"]').isVisible().catch(() => false);
    const ok = hayError || modalAbierto;

    if (ok) M.creacionInvalidos_passed++; else M.creacionInvalidos_failed++;
    cnt(ok);
    reg('CREAR-I', `#${i + 1} rechazado: ${ok ? 'SÍ ✔' : 'NO ✖'}`, u.razon, ok);

    // Cerrar modal si sigue abierto (con reintentos + fallback JS)
    let modalCerrado = !(await page.locator('input[wire\\:model="name"]').isVisible({ timeout: 2000 }).catch(() => false));

    for (let intento = 0; intento < 3 && !modalCerrado; intento++) {
      const btnClose = page.locator('button[wire\\:click="closeModal"]').first();

      try {
        await btnClose.waitFor({ state: 'visible', timeout: 4000 });
        await btnClose.scrollIntoViewIfNeeded();
        await btnClose.click({ force: true, timeout: 5000 });
      } catch (_) {
        // Fallback: click vía JavaScript si el click normal falla
        await page.evaluate(() => {
          const btn = [...document.querySelectorAll('button')]
            .find(b => b.getAttribute('wire:click') === 'closeModal');
          if (btn) btn.click();
        }).catch(() => {});
      }

      await page.waitForTimeout(1500);
      modalCerrado = !(await page.locator('input[wire\\:model="name"]').isVisible({ timeout: 1500 }).catch(() => false));

      if (!modalCerrado) {
        console.log(`  ⚠️ Reintento ${intento + 1} cerrando modal (Cancelar)`);
      }
    }

    if (!modalCerrado) {
      reg('CREAR-I', `#${i + 1} advertencia`, 'No se pudo cerrar el modal con Cancelar', false);
    }
  }
}

// =============================================================================
// ESCENARIO 3 — 5 ELIMINACIONES
// =============================================================================
async function escenarioEliminacion(page) {
  console.log('\n' + '═'.repeat(55));
  console.log('  🗑️  ESCENARIO 3 — 5 Eliminaciones');
  console.log('═'.repeat(55));

  for (let i = 0; i < USUARIOS_VALIDOS.length; i++) {
    const u = USUARIOS_VALIDOS[i];
    reg('ELIMINAR', `#${i + 1}`, u.email);

    await irAUsers(page);

    // Buscar fila — si no está en página 1, ir a página 2
    let fila = page.locator(`tr:has-text("${u.email}")`).first();
    if (!await fila.isVisible({ timeout: 3000 }).catch(() => false)) {
      const btnNext = page.locator('button[wire\\:click*="nextPage"]').first();
      if (await btnNext.isVisible().catch(() => false)) {
        await btnNext.click();
        await page.waitForTimeout(2000);
        fila = page.locator(`tr:has-text("${u.email}")`).first();
      }
    }

    if (!await fila.isVisible({ timeout: 5000 }).catch(() => false)) {
      reg('ELIMINAR', `#${i + 1} no encontrado`, u.email, false);
      M.eliminaciones_failed++; cnt(false); continue;
    }

    await fila.locator('button[title="Eliminar"]').click();
    await page.waitForTimeout(2000);

    const btnConfirm = page.locator('button[wire\\:click="delete"]');
    await btnConfirm.waitFor({ state: 'visible', timeout: 8000 });
    await btnConfirm.click();
    await page.waitForTimeout(3500);
    await page.waitForLoadState('networkidle').catch(() => {});

    const aun = await page.locator(`text=${u.email}`).isVisible().catch(() => false);
    const ok  = !aun;
    if (ok) M.eliminaciones_passed++; else M.eliminaciones_failed++;
    cnt(ok);
    reg('ELIMINAR', `#${i + 1} eliminado: ${ok ? 'SÍ ✔' : 'NO ✖'}`, u.email, ok);
  }
}

// =============================================================================
// REPORTE HTML
// =============================================================================
function generarHTML() {
  const ahora = new Date().toLocaleString('es-BO');
  const filas = LOG.map(e => `
    <tr class="${e.exito ? 'ok' : 'fail'}">
      <td>${e.timestamp}</td>
      <td><span class="badge b-${e.tipo.toLowerCase().replace(/[^a-z]/g,'-')}">${e.tipo}</span></td>
      <td>${e.descripcion}</td><td>${e.detalle||'—'}</td>
      <td>${e.exito?'✅':'❌'}</td></tr>`).join('');

  const esc = [
    ['1A — Login Válidos',          M.loginValidos_passed,      M.loginValidos_failed],
    ['1B — Login Inválidos Rech.',  M.loginInvalidos_passed,    M.loginInvalidos_failed],
    ['2A — Creación Válida',        M.creacionValidos_passed,   M.creacionValidos_failed],
    ['2B — Creación Inválida Rech.',M.creacionInvalidos_passed, M.creacionInvalidos_failed],
    ['3  — Eliminación',            M.eliminaciones_passed,     M.eliminaciones_failed],
  ].map(([l,p,f]) => `<tr><td>${l}</td><td style="color:#4ade80">${p}</td><td style="color:${f>0?'#f87171':'#4ade80'}">${f}</td><td>${p+f}</td><td>${p+f>0?((p/(p+f))*100).toFixed(0)+'%':'—'}</td></tr>`).join('');

  const steps = Object.entries(M.stepDurations).map(([k,v])=>`
    <tr><td>${k}</td><td>${v}s</td><td>
      <div style="background:#334155;border-radius:4px;height:8px;width:100%">
        <div style="background:#6366f1;border-radius:4px;height:8px;width:${Math.min(parseFloat(v)*3,100)}%"></div>
      </div></td></tr>`).join('');

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
  <title>Reporte QA v8</title><style>
    *{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;padding:2rem}
    header{display:flex;align-items:center;gap:1rem;margin-bottom:2rem;padding-bottom:1.5rem;border-bottom:1px solid #1e293b}
    .logo{width:50px;height:50px;background:linear-gradient(135deg,#6366f1,#a855f7);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.5rem}
    h1{font-size:1.4rem;font-weight:700;color:#f8fafc}h1 span{font-size:.8rem;color:#94a3b8;display:block;margin-top:2px}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:.8rem;margin-bottom:2rem}
    .card{background:#1e293b;border-radius:10px;padding:1rem 1.2rem;border:1px solid #334155}
    .lbl{font-size:.68rem;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em}
    .val{font-size:1.8rem;font-weight:700;margin-top:.2rem}
    .g{color:#4ade80}.r{color:#f87171}.b{color:#60a5fa}.p{color:#c084fc}.y{color:#fbbf24}
    h2{font-size:.9rem;font-weight:600;color:#cbd5e1;margin-bottom:.7rem}
    .sec{margin-bottom:1.5rem}.tw{background:#1e293b;border-radius:10px;overflow:hidden;border:1px solid #334155}
    table{width:100%;border-collapse:collapse;font-size:.8rem}
    thead tr{background:#0f172a}thead th{text-align:left;padding:.6rem .9rem;color:#64748b;font-weight:600;text-transform:uppercase;font-size:.66rem;border-bottom:1px solid #334155}
    tbody tr{border-bottom:1px solid #1e293b}tbody tr:hover{background:#1e293b88}tbody td{padding:.55rem .9rem;vertical-align:middle}
    tbody tr.fail{background:rgba(239,68,68,.06)}tbody tr.fail td{color:#fca5a5}
    .badge{display:inline-block;padding:.15rem .45rem;border-radius:999px;font-size:.62rem;font-weight:700;text-transform:uppercase}
    .b-login-v{background:#1e3a8a33;color:#93c5fd}.b-login-i{background:#44403c33;color:#d1d5db}
    .b-crear-v{background:#14532d33;color:#86efac}.b-crear-i{background:#78350f33;color:#fcd34d}
    .b-eliminar{background:#7f1d1d33;color:#fca5a5}.b-error{background:#991b1b33;color:#f87171}
    td:first-child{color:#64748b;font-size:.72rem;font-family:monospace}
    footer{margin-top:2rem;text-align:center;color:#475569;font-size:.74rem;border-top:1px solid #1e293b;padding-top:1.2rem}
  </style></head><body>
  <header><div class="logo">🧪</div><div><h1>Reporte QA v8.0 — Escenarios Completos
    <span>${BASE_URL} &nbsp;|&nbsp; ${ahora}</span></h1></div></header>
  <div class="grid">
    <div class="card"><div class="lbl">Duración</div><div class="val b">${M.durationSeconds}s</div></div>
    <div class="card"><div class="lbl">Éxito</div><div class="val ${M.successRate>=90?'g':'y'}">${M.successRate}%</div></div>
    <div class="card"><div class="lbl">✅ Total</div><div class="val g">${M.total_passed}</div></div>
    <div class="card"><div class="lbl">❌ Total</div><div class="val ${M.total_failed>0?'r':'g'}">${M.total_failed}</div></div>
    <div class="card"><div class="lbl">Login OK</div><div class="val b">${M.loginValidos_passed}/5</div></div>
    <div class="card"><div class="lbl">Rechazo OK</div><div class="val b">${M.loginInvalidos_passed}/5</div></div>
    <div class="card"><div class="lbl">Creados</div><div class="val p">${M.creacionValidos_passed}/5</div></div>
    <div class="card"><div class="lbl">Eliminados</div><div class="val p">${M.eliminaciones_passed}/5</div></div>
  </div>
  <div class="sec"><h2>📊 Resumen por Escenario</h2><div class="tw"><table>
    <thead><tr><th>Escenario</th><th>✅ Pasaron</th><th>❌ Fallaron</th><th>Total</th><th>% Éxito</th></tr></thead>
    <tbody>${esc}</tbody></table></div></div>
  <div class="sec"><h2>⏱️ Duración por Escenario</h2><div class="tw"><table>
    <thead><tr><th>Paso</th><th>Tiempo</th><th>Barra</th></tr></thead>
    <tbody>${steps||'<tr><td colspan="3">Sin datos</td></tr>'}</tbody></table></div></div>
  <div class="sec"><h2>📋 Log completo</h2><div class="tw"><table>
    <thead><tr><th>Hora</th><th>Tipo</th><th>Descripción</th><th>Detalle</th><th>Estado</th></tr></thead>
    <tbody>${filas}</tbody></table></div></div>
  <footer>Playwright QA v8.0 · Prometheus: localhost:9091/metrics · Grafana: localhost:3000</footer>
</body></html>`;
}

// =============================================================================
// TEST PRINCIPAL
// =============================================================================
test('QA Completo — Login + Creación + Eliminación', async ({ page }) => {
  t0 = Date.now();
  console.log('\n' + '═'.repeat(55));
  console.log('  🧪 PLAYWRIGHT QA v8.0 — ESCENARIOS COMPLETOS');
  console.log('═'.repeat(55));

  try {
    await medirPaso('1a_login_validos',   () => escenarioLoginValidos(page));
    await medirPaso('1b_login_invalidos', () => escenarioLoginInvalidos(page));
    await loginAdmin(page);
    await medirPaso('2a_creacion_valida',   () => escenarioCreacionValida(page));
    await medirPaso('2b_creacion_invalida', () => escenarioCreacionInvalida(page));
    await irAUsers(page);
    await medirPaso('3_eliminacion', () => escenarioEliminacion(page));
    reg('RESUMEN', `Completado`, `✅${M.total_passed} ❌${M.total_failed} 📈${M.successRate}%`);
  } catch (e) {
    M.total_failed++;
    reg('ERROR', 'Error crítico', e.message, false);
    throw e;
  } finally {
    guardarMetricas();
    const rp = path.join(__dirname, '..', 'reports', 'reporte-qa.html');
    fs.mkdirSync(path.dirname(rp), { recursive: true });
    fs.writeFileSync(rp, generarHTML(), 'utf-8');
    console.log(`\n  📄 HTML:    reports/reporte-qa.html`);
    console.log(`  📡 METRICS: http://localhost:9091/metrics`);
    console.log(`  📈 GRAFANA: http://localhost:3000\n`);
  }
});
