const { test, expect } = require('@playwright/test');

test('Login y creación de usuario', async ({ page }) => {

  // LOGIN

  await page.goto('https://demo1.codigoveloz.lol/login');

  await page.locator('input[wire\\:model="email"]').fill('asd@gmail.com');

  await page.locator('input[wire\\:model="password"]').fill('123123');

  await page.locator('button[type="submit"]').click();

  // Esperar que termine la carga después del login
  await page.waitForLoadState('networkidle');

  console.log('Login exitoso');
  console.log('URL:', page.url());

  // Esperar y hacer clic en "Nuevo Usuario"
  await page.getByRole('button', { name: /Nuevo Usuario/i }).click();

  // Esperar que aparezca el modal/formulario
  await page.waitForTimeout(1000);

  // Nombre
  await page.locator('input[wire\\:model="name"]').fill('clasecegos');

  // Email
  await page.locator('input[wire\\:model="email"]').last().fill('cegos@gmail.com');

  // Contraseña
  await page.locator('input[wire\\:model="password"]').last().fill('12345678');


  // USUARIO

  await page.getByRole('button', { name: /Crear Usuario/i }).click();

  // Esperar procesamiento
  await page.waitForLoadState('networkidle');

  console.log('Usuario creado');

  // Espera visual
  await page.waitForTimeout(5000);

});