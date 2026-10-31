import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { GameEngine, ENGINE_VERSION } from '../shared/engine.js';
import { canPlaceBlockAtPosition } from '../shared/mechanics.js';
const browser = await chromium.launch();
const dir = 'output/playwright/focused-play'; await mkdir(dir, { recursive: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const page = await context.newPage(), errors = [], backend = [];
page.on('pageerror', e => errors.push(e.message));
page.on('request', r => { const u=new URL(r.url()); if (u.hostname.endsWith('.supabase.co') || u.pathname.startsWith('/api/')) backend.push(u.pathname); });
async function state() { return page.evaluate(() => JSON.parse(window.render_game_to_text())); }
async function openMenu() { await page.locator('#play-menu-btn').click(); await page.locator('#playMenu.active').waitFor(); }
async function place() { await page.locator('#gameCanvas').focus(); await page.keyboard.press('1'); await page.keyboard.press('Enter'); }
async function frame(name) { await page.waitForTimeout(180); await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true }); }
try {
  await page.goto('http://127.0.0.1:5197');
  await page.locator('#landingStartClassicBtn').click(); await place();
  assert.equal((await state()).moves, 1);
  assert.equal((await state()).wallpaper, 'playables');
  await frame('classic-390');
  assert.ok(await page.locator('#hud-overlay').evaluate(el => el.getBoundingClientRect().height < 100));
  assert.equal(await page.locator('#updates-btn').isVisible(), false);
  assert.equal(await page.locator('#keyboard-controls').isVisible(), false);
  await openMenu(); await frame('menu');
  const before = await state(); await page.keyboard.press('1'); await page.keyboard.press('ArrowRight'); assert.equal((await state()).moves, before.moves);
  await page.locator('#mute-btn').click(); assert.equal((await state()).muted, true);
  await page.keyboard.press('Escape'); assert.equal(await page.locator('#play-menu-btn').evaluate(el => el === document.activeElement), true);
  await page.reload(); await openMenu(); assert.equal(await page.locator('#mute-btn').getAttribute('aria-pressed'), 'true');
  await page.locator('#mute-btn').click(); await page.locator('#mode-levels-btn').click();
  await page.locator('[data-level="1"]').click();
  assert.equal((await state()).mode, 'levels');
  await frame('levels-390');
  for (const [w,h] of [[320,568], [390,844], [844,390], [1280,800]]) {
    await page.setViewportSize({width:w,height:h}); await frame(`levels-${w}`);
    const s = await state();
    const canvas = await page.locator('#gameCanvas').boundingBox();
    const hud = await page.locator('#hud-overlay').boundingBox();
    assert.ok(canvas.y + s.boardLayout.y >= hud.y + hud.height - 1, 'board below compact HUD');
    assert.ok(s.boardLayout.x >= 0 && s.boardLayout.y + s.boardLayout.cellSize * 8 < canvas.height);
    for (const p of s.pieces.filter(p=>p.active)) assert.ok(p.y + p.shape.length * p.cellSize < canvas.height, 'whole tray fits');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth), 'no gameplay scrolling');
    let chosen;
    for(let slot=0;slot<3&&!chosen;slot++)if(s.pieces[slot].active)for(let y=0;y<8&&!chosen;y++)for(let x=0;x<8&&!chosen;x++)
      if(canPlaceBlockAtPosition(s.board,s.pieces[slot].shape,x,y))chosen={p:s.pieces[slot],x,y};
    assert.ok(chosen);
    const {p,x,y}=chosen, b=s.boardLayout;
    await page.mouse.move(canvas.x+p.x+p.shape[0].length*p.cellSize/2,canvas.y+p.y+p.shape.length*p.cellSize/2);
    await page.mouse.down();
    await page.mouse.move(canvas.x+b.x+(x+p.shape[0].length/2)*b.cellSize,canvas.y+b.y+(y+p.shape.length/2)*b.cellSize,{steps:8});
    await page.mouse.up();
    assert.equal((await state()).moves,s.moves+1,'drag uses current layout and legal grid placement');
  }
  await page.setViewportSize({width:390,height:844});
  await openMenu(); await page.locator('#level-restart-btn').click();
  await openMenu(); await page.locator('#theme-btn').click(); await page.keyboard.press('Escape'); await frame('light');
  await openMenu(); await page.getByRole('button',{name:'Keyboard & accessible board controls',exact:true}).click();
  assert.equal(await page.locator('#keyboard-controls').isVisible(),true);
  await page.locator('#accessible-pieces button').first().click();
  await page.locator('#accessible-board button').first().focus(); await page.keyboard.press('Enter');
  assert.ok((await state()).moves > 0);
  await page.locator('#keyboard-controls summary').click();
  // Resume a real replay just before a line clear; only its final move is played here.
  const game = new GameEngine({kind:'classic',seed:1}); let fixture;
  while (!game.over && game.moves < 100 && !fixture) {
    let action;
    for(let slot=0;slot<3&&!action;slot++)if(game.tray[slot].active)for(const y of [3,4,2,5,1,6,0,7])for(let x=0;x<8&&!action;x++)
      if(canPlaceBlockAtPosition(game.grid,game.tray[slot].shape,x,y))action={type:'place',slot,x,y};
    if(!action)break;
    const actions=structuredClone(game.actions); const result=game.apply(action);
    if(result.lines && [...game.revealed].some(key=>/,[34]$/.test(key)))fixture={actions,action};
  }
  assert.ok(fixture);
  await page.evaluate(({fixture,version})=>{localStorage.setItem('bb_theme','dark');localStorage.setItem('bb_in_progress_game',JSON.stringify({version,startedAt:Date.now(),options:{kind:'classic',seed:1},actions:fixture.actions,practice:true,officialSession:null,blockStyle:'bevel'}));},{fixture,version:ENGINE_VERSION});
  await page.reload(); await page.locator('#gameCanvas').focus(); await page.keyboard.press(String(fixture.action.slot+1));
  for(let x=0;x<fixture.action.x;x++)await page.keyboard.press('ArrowRight');
  for(let y=0;y<fixture.action.y;y++)await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  assert.ok((await state()).revealed.length >= 8); await frame('real-line-reveal');
  // Full glass is an existing cosmetic option; use it to inspect the full underlying artwork.
  await page.evaluate(()=>localStorage.setItem('bb_photo_reveal_mode','all-glass')); await page.reload(); await frame('logo-revealed');
  await page.evaluate(()=>{localStorage.setItem('bb_theme','paper');}); await page.reload(); await frame('logo-light');
  // A saved custom photo wins over the default; a saved preset remains selected.
  const custom='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#a55677"/></svg>');
  await page.evaluate(custom=>{localStorage.setItem('bb_wallpaper_theme_id','custom');localStorage.setItem('bb_custom_wallpaper_image',custom);},custom);
  await page.reload(); assert.equal((await state()).wallpaper,'custom'); await frame('custom-preserved');
  await page.evaluate(()=>localStorage.setItem('bb_wallpaper_theme_id','ocean-abyss')); await page.reload(); assert.equal((await state()).wallpaper,'ocean-abyss');
  assert.deepEqual(errors,[]); assert.deepEqual(backend,[]);
  await writeFile('output/review/focused-play.json', JSON.stringify({passed:true,errors,initialBackendRequests:backend.length,realReveal:true,customChoicePreserved:true},null,2));
  console.log('PASS compact gameplay, viewport fit, menu/focus, mute, accessible placements, real line reveal, light/dark and saved wallpaper choices; no backend calls/page errors.');
} finally { await browser.close(); }
