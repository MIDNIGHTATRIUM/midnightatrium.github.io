const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],root=document.documentElement;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let map,col={};

/* palette */
function setTheme(t){root.dataset.theme=t;try{localStorage.setItem('nm-theme',t)}catch(e){}
 const cs=getComputedStyle(root);col={a:cs.getPropertyValue('--accent').trim(),b:cs.getPropertyValue('--inset').trim()}}
$$('[data-t]').forEach(b=>b.onclick=()=>setTheme(b.dataset.t));
let saved;try{saved=localStorage.getItem('nm-theme')}catch(e){}
setTheme(saved==='shibuya'?'shibuya':'night');

/* panels */
function show(id){if(!id)id='top';const p=$('#'+id);if(!p||!p.classList.contains('panel')){id='top';}
 $$('.panel').forEach(x=>x.hidden=x.id!==id);
 $$('#nav a').forEach(a=>a.classList.toggle('on',a.dataset.p===id));
 if(id==='wx'&&map)setTimeout(()=>map.invalidateSize(),0)}
addEventListener('hashchange',()=>show(location.hash.slice(1)));

/* NWS */
async function J(u){let r;try{r=await fetch(u,{headers:{Accept:'application/geo+json','Api-User-Agent':'midnightatrium.github.io (MIDNIGHTATRIUM)'}})}catch(e){r=await fetch(u)}
 if(!r.ok)throw Error(r.status);return r.json()}
const F=c=>c==null?'--':(c*9/5+32).toFixed(1)+' °F';
async function obs(){const el=$('#obs');
 for(const s of['KISM','KMCO']){try{
  const p=(await J(`https://api.weather.gov/stations/${s}/observations/latest`)).properties;
  if(p.temperature.value==null)continue;
  const pa=p.barometricPressure.value??p.seaLevelPressure.value,w=p.windSpeed.value,d=p.windDirection.value,
   dir=d==null?'':['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'][Math.round(d/22.5)%16]+' ';
  el.innerHTML=`<table class="dt"><tr><th>STATION<td>${s}<tr><th>OBSERVED<td>${new Date(p.timestamp).toLocaleString()}
<tr><th>SKY<td>${esc(p.textDescription||'--')}<tr><th>PRESSURE<td>${pa==null?'--':(pa/100).toFixed(1)+' hPa'}
<tr><th>TEMP<td>${F(p.temperature.value)}<tr><th>DEW POINT<td>${F(p.dewpoint.value)}
<tr><th>HUMIDITY<td>${p.relativeHumidity.value==null?'--':Math.round(p.relativeHumidity.value)+' %'}
<tr><th>WIND<td>${w==null?'CALM':dir+Math.round(w*0.621371)+' mph'}</table>`;return}catch(e){}}
 el.textContent='ERR: NWS observations unreachable (KISM, KMCO). Try again later.'}
async function afd(){const el=$('#afd');
 try{const l=(await J('https://api.weather.gov/products/types/AFD/locations/MLB'))['@graph'][0];
  const p=await J(l['@id']);el.textContent=p.issuanceTime+'\n\n'+p.productText}
 catch(e){el.textContent='ERR: NWS Melbourne AFD unreachable. Try again later.'}}

/* radar */
function radar(){const el=$('#map');if(!window.L){el.textContent='ERR: Leaflet failed to load.';return}
 map=L.map('map',{center:[28.33,-81.65],zoom:8,minZoom:5,maxZoom:11});
 L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(map);
 const N='https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png',
  rl=L.tileLayer(N,{opacity:.75,attribution:'NEXRAD: Iowa Environmental Mesonet'}).addTo(map);let bad=0;
 rl.on('tileerror',()=>$('#rstat').textContent='ERR: radar tiles failing ('+(++bad)+')');
 rl.on('load',()=>{if(!bad)$('#rstat').textContent='NEXRAD N0Q, tiles loaded '+new Date().toLocaleTimeString()});
 L.circleMarker([28.33,-81.65],{radius:4,color:'#f33'}).addTo(map);
 setInterval(()=>{bad=0;rl.setUrl(N+'?t='+Date.now())},3e5)}

/* github */
async function repos(){const el=$('#repos');
 try{const r=await fetch('https://api.github.com/users/MIDNIGHTATRIUM/repos?sort=updated&per_page=6');
  if(!r.ok)throw Error(r.status===403?'rate limited, try later':'HTTP '+r.status);
  const d=await r.json();
  el.innerHTML=d.length?'<table class="dt"><tr><th>REPO<th>DESCRIPTION<th>LANG<th>UPDATED'+d.map(x=>`<tr><td><a href="${esc(x.html_url)}">${esc(x.name)}</a><td>${esc(x.description||'--')}<td>${esc(x.language||'--')}<td>${x.updated_at.slice(0,10)}`).join('')+'</table>':'No public repositories yet.'}
 catch(e){el.textContent='ERR: GitHub API: '+e.message}}

/* rack synth */
let ac,an,filt,master,lfo=[],cur=null,bins;
function init(){ac=new AudioContext();
 filt=ac.createBiquadFilter();filt.type='lowpass';filt.Q.value=3;filt.frequency.value=+$('#cut').value;
 master=ac.createGain();master.gain.value=+$('#vol').value;
 an=ac.createAnalyser();an.fftSize=2048;an.smoothingTimeConstant=.75;bins=new Uint8Array(an.frequencyBinCount);
 filt.connect(master);master.connect(an);an.connect(ac.destination);
 [[.6,14],[6.3,3]].forEach(([f,d])=>{const o=ac.createOscillator(),g=ac.createGain(); /* tape wow + flutter, in cents */
  o.frequency.value=f;g.gain.value=d;o.connect(g);o.start();lfo.push(g)})}
function chord(notes){const t=ac.currentTime,g=ac.createGain(),os=[];
 g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(1/(notes.length*2),t+.5);g.connect(filt);
 notes.forEach(n=>[-7,7].forEach(d=>{const o=ac.createOscillator();o.type='sawtooth';
  o.frequency.value=440*2**((n-69)/12);o.detune.value=d;lfo.forEach(l=>l.connect(o.detune));o.connect(g);o.start();os.push(o)}));
 return{g,os}}
function release(v){const t=ac.currentTime;v.g.gain.cancelScheduledValues(t);v.g.gain.setValueAtTime(v.g.gain.value,t);
 v.g.gain.linearRampToValueAtTime(0,t+1.2);v.os.forEach(o=>o.stop(t+1.3))}
$$('#presets button').forEach(b=>b.onclick=()=>{
 if(!ac)init();ac.resume();const same=cur&&cur.b===b;
 if(cur){release(cur.v);cur.b.classList.remove('on');cur=null}
 if(!same&&b.dataset.c){cur={b,v:chord(JSON.parse(b.dataset.c))};b.classList.add('on')}});
$('#cut').oninput=e=>filt&&filt.frequency.setTargetAtTime(+e.target.value,ac.currentTime,.03);
$('#vol').oninput=e=>master&&master.gain.setTargetAtTime(+e.target.value,ac.currentTime,.03);
const cx=$('#spec').getContext('2d');
(function draw(){requestAnimationFrame(draw);
 cx.fillStyle=col.b;cx.fillRect(0,0,256,64);if(!an)return;
 an.getByteFrequencyData(bins);cx.fillStyle=col.a;
 for(let i=0;i<32;i++){const b=Math.round(4*1.13**i),n=Math.round(Math.max(bins[b],bins[b+1])/255*16);
  for(let k=0;k<n;k++)cx.fillRect(i*8,60-k*4,7,3)}})();

radar();show(location.hash.slice(1));obs();afd();repos();
setInterval(obs,6e5);
