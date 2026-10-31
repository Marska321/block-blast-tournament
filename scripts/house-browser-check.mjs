import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';

process.env.VITE_CASUAL_ONLY='true';
process.env.VITE_CLASSIC_RANKED_ENABLED='true';
process.env.VITE_SUPABASE_URL='https://pilot.supabase.co';
process.env.VITE_SUPABASE_ANON_KEY='fixture-public-key';
process.env.VITE_TURNSTILE_SITE_KEY='fixture-sitekey';
const server=await createServer({envDir:false,server:{host:'127.0.0.1',port:5197,strictPort:true}});
await server.listen();
const browser=await chromium.launch({headless:true});
try {
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',acceptDownloads:true});
  await context.addInitScript(()=>{
    localStorage.setItem('bb_has_seen_landing','true');
    window.cardLabels=[];
    const original=CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText=function(value,...args){
      if(this.canvas.width===1080)window.cardLabels.push(value);
      return original.call(this,value,...args);
    };
  });
  let participants=0,closed=false,entries=[];
  const page=await context.newPage();
  const errors=[];let authRequests=0,writeRequests=0;
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(new URL(request.url()).hostname.endsWith('.supabase.co'))authRequests++;});
  await page.route('**/api/classic*',async route=>{
    if(route.request().method()!=='GET')writeRequests++;
    await route.fulfill({json:{day:closed?'2026-10-20':'2026-10-21',today:'2026-10-21',startsAt:'2026-10-20T22:00:00Z',endsAt:'2026-10-21T22:00:00Z',closed,
      serverTime:'2026-10-21T12:00:00Z',demo:false,entries,me:entries.find(entry=>entry.isMe)||null,participants,
      streak:{current:0,longest:0,playedToday:false}}});
  });
  await mkdir('output/playwright/house-challengers',{recursive:true});
  await page.goto('http://127.0.0.1:5197');
  await page.locator('#mode-classic-btn').click();
  await page.locator('#gameCanvas').focus();await page.keyboard.press('1');await page.keyboard.press('Enter');
  assert.equal((await page.evaluate(()=>JSON.parse(window.render_game_to_text()))).moves,1);
  await page.locator('#leaderboard-btn').click();
  await page.getByRole('heading',{name:'Beat the house.'}).waitFor();
  const house=page.locator('.classic-standings [data-house="true"]');
  assert.equal(await house.count(),6);
  assert.match(await page.locator('#classicBoard').getByRole('status').innerText(),/0 players/);
  assert.equal(await page.locator('.classic-house-badge').count(),6);
  assert.ok(await house.first().evaluate(row=>row.getBoundingClientRect().bottom<innerHeight));
  await page.getByRole('heading',{name:'Beat the house.'}).scrollIntoViewIfNeeded();
  await page.screenshot({path:'output/playwright/house-challengers/empty-dark.png',fullPage:true});
  entries=[{rank:1,nickname:'New champ',score:13000,isMe:false,pointsToNext:null},
    {rank:2,nickname:'Real player',score:3420,isMe:true,pointsToNext:9581},
    {rank:3,nickname:'Just started',score:100,isMe:false,pointsToNext:3321}];participants=3;
  await page.getByRole('button',{name:'Refresh board',exact:true}).click();
  await page.getByRole('status').filter({hasText:'3 players'}).waitFor();
  const names=await page.locator('.classic-nickname').allTextContents();
  assert.equal(names[0],'New champ');assert.ok(names.indexOf('Real player (you)')<names.indexOf('Lekker LinesHouse'));
  assert.match(await page.locator('.classic-personal').innerText(),/#2/);
  assert.equal(await page.locator('[aria-label="Player rank 2"]').count(),1);
  const download=page.waitForEvent('download');await page.locator('#classicResultsCard').click();
  await(await download).saveAs('output/playwright/house-challengers/real-results-only.png');
  const labels=await page.evaluate(()=>window.cardLabels);
  assert.ok(labels.includes('New champ'));assert.ok(!labels.includes('Captain Combo'));assert.ok(!labels.includes('BlokBot'));
  participants=49;await page.getByRole('button',{name:'Refresh board',exact:true}).click();
  await page.getByRole('status').filter({hasText:'49 players'}).waitFor();assert.equal(await house.count(),6);
  await page.setViewportSize({width:320,height:568});
  await page.getByRole('heading',{name:'Beat the house.'}).scrollIntoViewIfNeeded();
  await page.screenshot({path:'output/playwright/house-challengers/narrow-dark.png',fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  participants=50;await page.getByRole('button',{name:'Refresh board',exact:true}).click();
  await page.getByRole('status').filter({hasText:'50 players'}).waitFor();assert.equal(await house.count(),0);
  assert.equal(await page.locator('.classic-standings li').count(),3);
  participants=0;entries=[];closed=true;await page.getByRole('button',{name:'Yesterday',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Final results'}).waitFor();assert.equal(await house.count(),0);
  assert.match(await page.locator('#classicBoard').innerText(),/No accepted scores yet/);
  assert.equal(authRequests,0);assert.equal(writeRequests,0);assert.deepEqual(errors,[]);
  console.log('House challengers passed: empty/live board, score sorting and ties, genuine player ranks/counts, 49/50 retirement, closed-day exclusion, real-only card, narrow layout, local gameplay and zero Auth/write requests.');
}finally{await browser.close();await server.close();}
