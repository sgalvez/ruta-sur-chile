import {test,expect} from '@playwright/test';
async function transport(page:any,testInfo:any){await page.locator(testInfo.project.name==='mobile'?'.mobile-nav [data-view="mobility"]':'.site-header [data-view="mobility"]').click();}
test('legacy favorites, themes, routes and featured stops work together',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('ruta-sur-favorites','["reserva-nacional-rio-de-los-cipreses"]'));
 await page.goto('/');await expect(page.locator('.place-card')).toHaveCount(62);
 expect(await page.locator('#route').evaluate(el=>el.getBoundingClientRect().width)).toBeGreaterThan(130);
 expect(await page.locator('#place-kind').evaluate(el=>el.getBoundingClientRect().width)).toBeGreaterThan(130);
 await expect(page.locator('.saved-count').first()).toHaveText('1');
 await page.locator('[data-theme="myths"]').click();await page.locator('[data-theme="heritage"]').click();
 await page.locator('#query').fill('almas navegantes');await expect(page.locator('.place-card')).toHaveCount(1);
 await page.locator('#route').selectOption('austral');await expect(page.locator('.empty-state')).toBeVisible();
 await page.locator('#clear').click();await page.locator('#place-kind').selectOption('monument');await expect(page.locator('.place-card')).toHaveCount(4);
 await page.locator('[data-featured="muela-del-diablo"]').click();await expect(page.locator('#detail-content')).toContainText('A pie, a tu ritmo');
 await page.locator('#close-detail').click();await page.locator('[data-featured="cascada-invertida"]').click();await expect(page.locator('#detail-content')).toContainText('depende del viento');
});
test('ferries and MOP notices work offline and expose historical itineraries',async({page,context},testInfo)=>{
 await page.goto('/');await expect(page.locator('#offline')).toContainText('Fichas listas sin señal',{timeout:25000});
 await transport(page,testInfo);await expect(page.locator('.ferry-card')).toHaveCount(7);
 await expect(page.locator('.ferry-card').filter({hasText:'Quellón–Chaitén'})).toContainText('vencido');
 await page.locator('#ferry-route').selectOption('main');await expect(page.locator('.ferry-card')).toHaveCount(4);
 await page.locator('#road-region').selectOption('Maule');await expect(page.locator('.road-card').first()).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`test-results/${testInfo.project.name}-ferries.png`,fullPage:true});
 await context.setOffline(true);await page.reload();await transport(page,testInfo);
 await expect(page.locator('.ferry-card')).toHaveCount(7);await expect(page.locator('.road-card').first()).toBeVisible();
 await page.locator('#mobility-refresh').click();await expect(page.locator('#toast')).toContainText('datos guardados');
});
test.describe('network update outcomes',()=>{
test.use({serviceWorkers:'block'});
test('refresh distinguishes unchanged, changed and failed downloads while preserving the open detail',async({page})=>{
 await page.goto('/');await expect(page.locator('.place-card')).toHaveCount(62);
 await page.locator('#reload').click();await expect(page.locator('#toast')).toContainText('No hay cambios');
 await page.locator('#query').fill('cipreses');await expect(page.locator('.place-card')).toHaveCount(1);
 await page.locator('[data-open]').first().click();
 await page.route('**/data/v2/state.json',async route=>{const r=await route.fetch();const data=await r.json();data.attemptedAt='2026-09-12T23:59:00Z';await route.fulfill({json:data});});
 // Trigger the same updater while the dialog remains open; native modal blocks pointer input behind it.
 await page.locator('#reload').evaluate((b:HTMLButtonElement)=>b.click());await expect(page.locator('#toast')).toContainText('Información actualizada');
 await expect(page.locator('#detail')).toBeVisible();await expect(page.locator('#query')).toHaveValue('cipreses');
 await page.unroute('**/data/v2/state.json');await page.route('**/data/v2/state.json',r=>r.abort());
 await page.locator('#reload').evaluate((b:HTMLButtonElement)=>b.click());await expect(page.locator('#toast')).toContainText('datos guardados');
 await expect(page.locator('#detail')).toBeVisible();
});
});
