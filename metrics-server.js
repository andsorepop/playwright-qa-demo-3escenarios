// Servidor de métricas Prometheus — v2.0 con escenarios completos
const http = require('http');
const fs   = require('fs');
const path = require('path');

const METRICS_FILE = path.join(__dirname, 'reports', 'playwright-metrics.json');
const PORT = 9091;

function leerMetricas() {
  try {
    if (!fs.existsSync(METRICS_FILE)) return null;
    return JSON.parse(fs.readFileSync(METRICS_FILE, 'utf-8'));
  } catch (e) { return null; }
}

function formatearPrometheus(m) {
  if (!m) return `# No hay métricas aún. Corre el test primero.\nplaywright_last_run_timestamp 0\n`;

  const g = (help, name, val, labels = '') => [
    `# HELP ${name} ${help}`,
    `# TYPE ${name} gauge`,
    `${name}${labels} ${val ?? 0}`,
  ].join('\n');

  const lines = [
    g('Login válidos pasados',              'playwright_login_validos_passed',      m.loginValidos_passed),
    g('Login válidos fallados',             'playwright_login_validos_failed',      m.loginValidos_failed),
    g('Login inválidos rechazados (ok)',    'playwright_login_invalidos_passed',    m.loginInvalidos_passed),
    g('Login inválidos no rechazados',      'playwright_login_invalidos_failed',    m.loginInvalidos_failed),
    g('Creaciones válidas exitosas',        'playwright_creacion_validos_passed',   m.creacionValidos_passed),
    g('Creaciones válidas falladas',        'playwright_creacion_validos_failed',   m.creacionValidos_failed),
    g('Creaciones inválidas rechazadas',    'playwright_creacion_invalidos_passed', m.creacionInvalidos_passed),
    g('Creaciones inválidas no rechazadas', 'playwright_creacion_invalidos_failed', m.creacionInvalidos_failed),
    g('Eliminaciones exitosas',             'playwright_eliminaciones_passed',      m.eliminaciones_passed),
    g('Eliminaciones falladas',             'playwright_eliminaciones_failed',      m.eliminaciones_failed),
    g('Total casos pasados',                'playwright_total_passed',              m.total_passed),
    g('Total casos fallados',               'playwright_total_failed',              m.total_failed),
    g('Tasa de éxito porcentaje',           'playwright_success_rate',             m.successRate),
    g('Duración total en segundos',         'playwright_duration_seconds',         m.durationSeconds),
    g('Unix timestamp última ejecución',    'playwright_last_run_timestamp',        m.timestamp),
  ];

  // Step durations con labels
  if (m.stepDurations) {
    lines.push('# HELP playwright_step_duration_seconds Duración de cada escenario en segundos');
    lines.push('# TYPE playwright_step_duration_seconds gauge');
    for (const [step, sec] of Object.entries(m.stepDurations)) {
      lines.push(`playwright_step_duration_seconds{step="${step}"} ${sec}`);
    }
  }

  return lines.join('\n') + '\n';
}

const server = http.createServer((req, res) => {
  if (req.url === '/metrics') {
    const m = leerMetricas();
    res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' });
    res.end(formatearPrometheus(m));
    console.log(`[${new Date().toISOString()}] GET /metrics → ${m ? `✅ passed=${m.total_passed} failed=${m.total_failed}` : '⏳ sin datos'}`);
  } else if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', port: PORT, metrics: !!leerMetricas() }));
  } else {
    res.writeHead(404); res.end('Usa /metrics o /health');
  }
});

server.listen(PORT, () => {
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`  📡 Metrics Server — Playwright QA v7.0`);
  console.log(`  http://localhost:${PORT}/metrics`);
  console.log(`  Prometheus apunta aquí → Grafana visualiza`);
  console.log(`${'═'.repeat(50)}\n`);
});
