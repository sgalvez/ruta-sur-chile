import {test,expect} from '@playwright/test';
test('search, favorites, details and geolocation denial remain usable',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.locator('h1')).toContainText('El sur');
 await expect(page.locator('.place-card').first()).toBeVisible();
 await page.locator('#query').fill('cipreses');await expect(page.locator('.place-card')).toHaveCount(1);
 await page.locator('[data-save]').first().click();await page.locator('[data-open]').first().click();
 await expect(page.locator('#detail')).toBeVisible();await expect(page.locator('#detail-content')).toContainText('Fuentes y fechas');
 await page.locator('#close-detail').click();await expect(page.locator('#detail')).not.toBeVisible();await page.reload();
 await expect(page.locator('.saved-count').first()).toHaveText('1');
 await page.locator('#query').fill('lugarmuyimposible');await expect(page.locator('.empty-state')).toBeVisible();
 await page.locator('#clear').click();await expect(page.locator('.place-card').first()).toBeVisible();
 await page.locator('#nearby').click();await expect(page.locator('#toast')).toContainText('No pudimos acceder',{timeout:15000});
 expect(errors).toEqual([]);
});
test('catalog and favorites work after a real offline reload',async({page,context})=>{
 await page.goto('/');await expect(page.locator('#offline')).toContainText('Fichas listas sin señal',{timeout:25000});
 await page.locator('.save-button').first().click();
 await context.setOffline(true);await page.reload();
 await expect(page.locator('.place-card').first()).toBeVisible();await expect(page.locator('#connection-banner')).toContainText('Sin conexión');
 await expect(page.locator('.saved-count').first()).toHaveText('1');
 await page.locator('#query').fill('Ñuble');await expect(page.locator('.place-card').first()).toBeVisible();
 await context.setOffline(false);await page.locator('#reload').click();await expect(page.locator('h1')).toContainText('El sur');
});
test('layout has no horizontal overflow and filters match both views',async({page},testInfo)=>{
 await page.goto('/');await expect(page.locator('.place-card').first()).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('[data-kind="nature"]').click();await expect(page.locator('.place-card.camping')).toHaveCount(0);
 await page.locator('#region').selectOption('Los Lagos');
 if(testInfo.project.name==='mobile')await page.locator('.mobile-nav [data-view="map"]').click();
 await expect(page.locator('#map.leaflet-container')).toBeVisible({timeout:15000});
 await expect(page.locator('.place-marker')).toHaveCount(await page.locator('.place-card').count());
 await page.screenshot({path:`test-results/${testInfo.project.name}-explore.png`,fullPage:true});
});
test('GitHub Pages project subpath supports assets, deep links and offline reload',async({page,context})=>{
 await page.goto('/ruta-sur-chile/#lugar/reserva-nacional-rio-de-los-cipreses');
 await expect(page.locator('#detail')).toBeVisible();
 await page.locator('#close-detail').click();await expect(page).toHaveURL(/ruta-sur-chile\/#explorar$/);
 await expect(page.locator('#offline')).toContainText('Fichas listas sin señal',{timeout:25000});
 await context.setOffline(true);await page.reload();await expect(page.locator('.place-card').first()).toBeVisible();
});
