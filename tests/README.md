# 🧪 Automatización QA – Gestión de Usuarios
**URL:** https://demo1.codigoveloz.lol/  
**Herramienta:** Playwright

---

## 📁 Estructura del proyecto

```
playwright-demo/
├── tests/
│   └── gestion-usuarios.spec.js   ← Script principal
├── reports/
│   └── reporte-qa.html            ← Reporte (se genera al correr)
├── playwright.config.js
├── package.json
└── README.md
```

---

## ⚙️ Instalación

```bash
npm install
npx playwright install chromium
```

---

## ▶️ Cómo correr el test

```bash
# Modo headless (sin ventana, recomendado para CI/CD)
npm test

# Modo con navegador visible (para depurar)
npm run test:headed

# Modo debug paso a paso
npm run test:debug
```

---

## 👥 Administrar la lista de usuarios

Abre `tests/gestion-usuarios.spec.js` y edita el arreglo `USUARIOS_A_CREAR`:

```javascript
const USUARIOS_A_CREAR = [
  {
    id: 1,
    nombre: 'Ausberto Andres Vargas Silva',
    email: 'andsorepopcorns@gmail.com',
    password: 'P4ssw0rd2026',
    editName: 'Andres Vargas Silva', // ← Se edita después de crear
  },
  {
    id: 2,
    nombre: 'Otro Usuario',
    email: 'otro@gmail.com',
    password: 'OtraPass2026',
    editName: null, // ← null = no editar
  },
];
```

| Campo      | Descripción                                             |
|------------|---------------------------------------------------------|
| `id`       | Identificador único (solo para el log y reporte)        |
| `nombre`   | Nombre completo al crear                                |
| `email`    | Correo electrónico                                      |
| `password` | Contraseña del nuevo usuario                            |
| `editName` | Nombre a editar tras crear (`null` para no editar)      |

---

## 📄 Reporte HTML

Al finalizar, el reporte se genera en `reports/reporte-qa.html`.  
Contiene:
- Resumen de eventos (total, exitosos, errores)
- Tabla de usuarios procesados
- Log detallado de cada paso con timestamp

---

## 🔑 Credenciales del admin

Definidas en la constante `ADMIN` del script:
```javascript
const ADMIN = {
  email: 'asd@gmail.com',
  password: '123123',
};
```
