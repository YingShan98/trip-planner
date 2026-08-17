const CFG = window.TRIP_PLANNER_CONFIG || {};
const hasConfig = CFG.supabaseUrl && CFG.supabaseKey && !String(CFG.supabaseUrl).includes('YOUR_') && !String(CFG.supabaseKey).includes('YOUR_');
const sb = hasConfig ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey) : null;
const qs = new URLSearchParams(location.search);
let currentSlug = qs.get('trip') || null;
let currentTrip = null;
let state = blankState();
let editUnlocked = false;
let editPassword = '';
let channel = null;
let saveTimer = null;
let saveInFlight = false;
let savePending = false;

const $ = (s,root=document)=>root.querySelector(s);
const $$ = (s,root=document)=>[...root.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const uid = p => p+'_'+Math.random().toString(36).slice(2,8);
function blankState(){return {days:[{n:1,title:'Day 1',intensity:'light',steps:'',mapUrl:'',items:[],notes:''}],checklist:[],hotels:[],transport:[],budget:[],notes:[],collapsed:{}}}
function defaultDay(n){return {n,title:`Day ${n}`,intensity:'light',steps:'',mapUrl:'',items:[],notes:''}}
function defaultActivity(){return {t:'上午',x:'',move:'',fee:'',link:[]}}
function defaultHotel(){return {rank:'候选',name:'',addr:'',warn:'',pointsText:'',link:[],notes:''}}
function defaultTransport(){return {type:'',description:'',price:''}}
function defaultBudget(){return {category:'',unit:'',quantity:1,unitPrice:'',note:''}}
function normalize(s){
  s=s||{}; const x=blankState();
  x.days=Array.isArray(s.days)&&s.days.length?s.days.map((d,i)=>({...defaultDay(i+1),...d,n:i+1,items:Array.isArray(d.items)?d.items:[]})):x.days;
  x.checklist=Array.isArray(s.checklist)?s.checklist:[];
  x.hotels=Array.isArray(s.hotels)?s.hotels:[];
  x.transport=Array.isArray(s.transport)?s.transport:[];
  x.budget=Array.isArray(s.budget)?s.budget:[];
  x.notes=Array.isArray(s.notes)?s.notes:[];
  x.collapsed=s.collapsed||{};
  return x;
}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),1800)}
function showModal(html){$('#modalBody').innerHTML=html;$('#modal').classList.remove('hidden')}
function closeModal(){$('#modal').classList.add('hidden');$('#modalBody').innerHTML=''}
$('#modalClose').onclick=closeModal; $('#modal').addEventListener('click',e=>{if(e.target.id==='modal')closeModal()});
$('#homeBtn').onclick=()=>goHome(); $('#newTripBtn').onclick=()=>newTripModal(); $('#heroNewTrip').onclick=()=>newTripModal();

function formatDate(d){if(!d)return '';return new Date(d+'T00:00:00').toLocaleDateString('zh-CN',{year:'numeric',month:'numeric',day:'numeric'})}
function dateRange(t){if(!t.start_date&&!t.end_date)return '日期待定';if(t.start_date&&t.end_date)return `${formatDate(t.start_date)} – ${formatDate(t.end_date)}`;return formatDate(t.start_date||t.end_date)}
function setURL(slug){const u=new URL(location.href);if(slug)u.searchParams.set('trip',slug);else u.searchParams.delete('trip');history.pushState({},'',u)}
async function loadTrips(){
  if(!sb){renderHome([]);return}
  const {data,error}=await sb.from('trip_documents').select('id,slug,title,destination,start_date,end_date,currency,description,updated_at').order('updated_at',{ascending:false});
  if(error){toast('无法读取旅行列表：'+error.message);return}
  renderHome(data||[]);
}
function renderHome(trips){
  $('#homeView').classList.remove('hidden');$('#tripView').classList.add('hidden');
  $('#tripCount').textContent=`${trips.length} 个旅行`;
  const box=$('#tripList');
  if(!trips.length){box.innerHTML='<div class="empty">还没有旅行。<br>创建第一趟旅行吧。</div>';return}
  box.innerHTML=trips.map(t=>`<article class="trip-card"><div><h3>${esc(t.title)}</h3><div class="meta"><span class="pill">📍 ${esc(t.destination||'目的地待定')}</span><span class="pill">📅 ${esc(dateRange(t))}</span><span class="pill">💰 ${esc(t.currency||'MYR')}</span></div></div><p class="muted">${esc(t.description||'')}</p><div class="actions"><button class="primary" data-open-trip="${esc(t.slug)}">进入旅行</button><button class="ghost" data-copy-trip="${esc(t.slug)}">复制链接</button><button class="danger" data-delete-trip="${esc(t.slug)}">删除</button></div></article>`).join('');
  $$('#tripList [data-open-trip]').forEach(b=>b.onclick=()=>openTrip(b.dataset.openTrip));
  $$('#tripList [data-copy-trip]').forEach(b=>b.onclick=()=>copyTripLink(b.dataset.copyTrip));
  $$('#tripList [data-delete-trip]').forEach(b=>b.onclick=()=>deleteTrip(b.dataset.deleteTrip));
}
async function goHome(){setURL(null);currentTrip=null;editUnlocked=false;editPassword='';await loadTrips()}
async function openTrip(slug){
  if(!sb){toast('请先配置 config.js');return}
  const {data,error}=await sb.from('trip_documents').select('*').eq('slug',slug).single();
  if(error){toast('无法打开旅行：'+error.message);return}
  currentTrip=data;state=normalize(data.data);editUnlocked=false;editPassword='';currentSlug=slug;setURL(slug);renderTrip();subscribeRealtime();}
function renderTrip(){
  $('#homeView').classList.add('hidden');$('#tripView').classList.remove('hidden');
  const t=currentTrip;
  $('#tripView').innerHTML=`<div class="trip-shell ${editUnlocked?'':'readonly'}">
    <header class="trip-hero"><button class="ghost back" id="backToTrips">← 我的旅行</button><h1>${esc(t.title)}</h1><p>${esc(t.destination||'目的地待定')} · ${esc(dateRange(t))}</p><div class="hero-meta"><span class="pill">💰 ${esc(t.currency||'MYR')}</span><span class="pill">${editUnlocked?'✏️ 可编辑':'👀 只读查看'}</span><span class="pill status" id="syncStatus">${editUnlocked?'编辑模式':'在线同步中'}</span></div><div class="trip-toolbar"><button class="ghost" id="editBtn">${editUnlocked?'🔒 锁定编辑':'🔓 编辑'}</button><button class="ghost" id="settingsBtn">⚙️ 旅行设置</button><button class="ghost" id="exportBtn">⬇️ 导出 JSON</button><button class="ghost" id="importBtn">⬆️ 导入 JSON</button><button class="ghost" id="printBtn">🖨 打印</button><span class="spacer"></span><button class="danger" id="deleteCurrentBtn">删除旅行</button></div></header>
    <main class="content">
      ${renderDashboard()}
      ${renderChecklist()}
      ${renderDays()}
      ${renderHotels()}
      ${renderTransport()}
      ${renderBudget()}
      ${renderNotes()}
    </main>
    ${editUnlocked?'<button class="sticky-save" id="saveNow">保存同步</button>':''}
  </div>`;
  bindTripEvents();
}
function renderDashboard(){const total=state.days.reduce((a,d)=>a+d.items.length,0),done=state.checklist.filter(x=>x.done).length;return `<section class="section"><div class="section-head"><h2>📋 旅行速览</h2><span class="muted">${esc(currentTrip.description||'')}</span></div><div class="dash"><div class="dash-card"><small>旅行天数</small><strong>${state.days.length} 天</strong></div><div class="dash-card"><small>行程项目</small><strong>${total} 项</strong></div><div class="dash-card"><small>Checklist</small><strong>${done}/${state.checklist.length}</strong></div><div class="dash-card"><small>酒店候选</small><strong>${state.hotels.length} 个</strong></div></div></section>`}
function renderChecklist(){return `<section class="section"><div class="section-head"><h2>☑️ Checklist</h2><span class="muted">出发前要完成的事项</span></div><div class="checklist">${state.checklist.length?state.checklist.map((x,i)=>`<div class="check-row ${x.done?'done':''}"><input class="editable" type="checkbox" data-check="${i}" ${x.done?'checked':''}><span class="grow">${esc(x.text)}</span><button class="mini edit-only" data-del-check="${i}">×</button></div>`).join(''):'<div class="empty">暂无事项</div>'}</div>${editUnlocked?'<div class="inline-add edit-only"><input id="newCheck" placeholder="添加 Checklist 项目"><button class="primary" id="addCheck">添加</button></div>':''}</section>`}
function renderDays(){return `<section class="section"><div class="section-head"><h2>🗓️ 行程</h2><span class="muted">任意天数 · 可自由调整顺序</span></div>${state.days.map((d,i)=>renderDay(d,i)).join('')}${editUnlocked?'<button class="add-btn edit-only" id="addDay">＋ 添加 Day</button>':''}</section>`}
function renderDay(d,i){return `<article class="day-card ${state.collapsed[i]?'collapsed':''}" data-day-card="${i}"><div class="day-head"><span class="day-num">D${i+1}</span><input class="day-title editable" data-day-field="title" data-day="${i}" value="${esc(d.title)}"><span class="pill">${d.intensity==='light'?'轻松':d.intensity==='medium'?'中等':'较累'}</span><div class="day-actions"><button class="mini" data-collapse-day="${i}">${state.collapsed[i]?'展开':'折叠'}</button>${editUnlocked?`<button class="mini edit-only" data-up-day="${i}" ${i===0?'disabled':''}>↑</button><button class="mini edit-only" data-down-day="${i}" ${i===state.days.length-1?'disabled':''}>↓</button><button class="mini edit-only" data-del-day="${i}">×</button>`:''}</div></div><div class="day-body"><div class="subline"><select class="editable" data-day-field="intensity" data-day="${i}"><option value="light" ${d.intensity==='light'?'selected':''}>轻松</option><option value="medium" ${d.intensity==='medium'?'selected':''}>中等</option><option value="heavy" ${d.intensity==='heavy'?'selected':''}>较累</option></select><input class="wide editable" data-day-field="steps" data-day="${i}" value="${esc(d.steps)}" placeholder="步行时长/体力提示"><input class="wide editable" data-day-field="mapUrl" data-day="${i}" value="${esc(d.mapUrl)}" placeholder="Google Maps / 地图链接"></div>${d.mapUrl?`<div><a href="${esc(d.mapUrl)}" target="_blank" rel="noopener">🗺️ 打开路线地图</a></div>`:''}<div>${d.items.map((a,j)=>renderActivity(a,i,j)).join('')}</div>${editUnlocked?'<button class="add-btn edit-only" data-add-activity="'+i+'">＋ 添加行程项目</button>':''}<label class="muted" style="display:block;margin-top:10px">Day 备注</label><textarea class="editable" data-day-field="notes" data-day="${i}" placeholder="当天注意事项、老人休息安排、备选方案等">${esc(d.notes||'')}</textarea></div></article>`}
function renderActivity(a,di,ai){return `<div class="activity"><div class="activity-top"><select class="editable" data-act-field="t" data-day="${di}" data-act="${ai}">${['清晨','上午','午间','下午','傍晚','晚间','全天'].map(x=>`<option ${a.t===x?'selected':''}>${x}</option>`).join('')}</select><input class="editable" data-act-field="x" data-day="${di}" data-act="${ai}" value="${esc(a.x)}" placeholder="行程内容">${editUnlocked?`<button class="mini edit-only" data-del-act="${di}:${ai}">×</button>`:''}</div><div class="activity-extra"><input class="editable" data-act-field="move" data-day="${di}" data-act="${ai}" value="${esc(a.move)}" placeholder="🚗 交通"><input class="editable" data-act-field="fee" data-day="${di}" data-act="${ai}" value="${esc(a.fee)}" placeholder="💰 费用"></div><div class="links">${(a.link||[]).map((l,li)=>`<div class="link-row"><input class="editable" data-link-field="label" data-day="${di}" data-act="${ai}" data-link="${li}" value="${esc(l.label)}" placeholder="链接名称"><input class="editable" data-link-field="url" data-day="${di}" data-act="${ai}" data-link="${li}" value="${esc(l.url)}" placeholder="https://..."><button class="mini edit-only" data-del-link="${di}:${ai}:${li}">×</button></div>`).join('')}${editUnlocked?`<button class="mini edit-only" data-add-link="${di}:${ai}">＋ 添加链接</button>`:''}</div></div>`}
function renderHotels(){return `<section class="section"><div class="section-head"><h2>🏨 酒店候选</h2><span class="muted">适用于任何目的地</span></div><div class="hotel-grid">${state.hotels.map((h,i)=>`<article class="hotel-card"><div style="display:flex;gap:7px"><input class="editable" data-hotel-field="rank" data-hotel="${i}" value="${esc(h.rank)}" placeholder="排名"><input class="editable" data-hotel-field="name" data-hotel="${i}" value="${esc(h.name)}" placeholder="酒店名称" style="flex:1;font-weight:700">${editUnlocked?`<button class="mini edit-only" data-del-hotel="${i}">×</button>`:''}</div><input class="editable" data-hotel-field="addr" data-hotel="${i}" value="${esc(h.addr)}" placeholder="地址 / 地铁 / 区域"><input class="editable" data-hotel-field="warn" data-hotel="${i}" value="${esc(h.warn)}" placeholder="⚠️ 注意事项"><textarea class="editable" data-hotel-field="pointsText" data-hotel="${i}" placeholder="优点 / 缺点 / 适合原因">${esc(h.pointsText)}</textarea><textarea class="editable" data-hotel-field="notes" data-hotel="${i}" placeholder="讨论备注">${esc(h.notes)}</textarea><div class="links">${(h.link||[]).map((l,li)=>`<div class="link-row"><input class="editable" data-hlink-field="label" data-hotel="${i}" data-link="${li}" value="${esc(l.label)}"><input class="editable" data-hlink-field="url" data-hotel="${i}" data-link="${li}" value="${esc(l.url)}"><button class="mini edit-only" data-del-hlink="${i}:${li}">×</button></div>`).join('')}${editUnlocked?`<button class="mini edit-only" data-add-hlink="${i}">＋ 添加链接</button>`:''}</div></article>`).join('')||'<div class="empty">暂无酒店候选</div>'}</div>${editUnlocked?'<button class="add-btn edit-only" id="addHotel">＋ 添加酒店</button>':''}</section>`}
function renderTransport(){return `<section class="section"><div class="section-head"><h2>🚐 交通参考</h2><span class="muted">可用于包车、火车、地铁、租车等</span></div><div class="transport-grid">${state.transport.map((x,i)=>`<article class="transport-card"><div style="display:flex;gap:7px"><input class="editable" data-trans-field="type" data-trans="${i}" value="${esc(x.type)}" placeholder="交通方式 / 车型" style="flex:1;font-weight:700">${editUnlocked?`<button class="mini edit-only" data-del-trans="${i}">×</button>`:''}</div><textarea class="editable" data-trans-field="description" data-trans="${i}" placeholder="说明">${esc(x.description)}</textarea><input class="editable" data-trans-field="price" data-trans="${i}" value="${esc(x.price)}" placeholder="参考价格"></article>`).join('')||'<div class="empty">暂无交通参考</div>'}</div>${editUnlocked?'<button class="add-btn edit-only" id="addTransport">＋ 添加交通参考</button>':''}</section>`}
function renderBudget(){const sum=state.budget.reduce((a,x)=>a+(Number(x.quantity)||0)*(Number(x.unitPrice)||0),0);return `<section class="section"><div class="section-head"><h2>💰 预算</h2><span class="muted">${esc(currentTrip.currency||'MYR')} · 估算总额 ${sum.toLocaleString()}</span></div><div style="overflow:auto"><table class="budget-table"><thead><tr><th>分类</th><th>数量</th><th>单价</th><th>小计</th><th>备注</th><th></th></tr></thead><tbody>${state.budget.map((x,i)=>`<tr><td><input class="editable" data-budget-field="category" data-budget="${i}" value="${esc(x.category)}"></td><td><input class="editable" type="number" data-budget-field="quantity" data-budget="${i}" value="${esc(x.quantity)}"></td><td><input class="editable" type="number" data-budget-field="unitPrice" data-budget="${i}" value="${esc(x.unitPrice)}"></td><td>${((Number(x.quantity)||0)*(Number(x.unitPrice)||0)).toLocaleString()}</td><td><input class="editable" data-budget-field="note" data-budget="${i}" value="${esc(x.note)}"></td><td>${editUnlocked?`<button class="mini edit-only" data-del-budget="${i}">×</button>`:''}</td></tr>`).join('')}</tbody></table></div>${editUnlocked?'<button class="add-btn edit-only" id="addBudget">＋ 添加预算项目</button>':''}</section>`}
function renderNotes(){return `<section class="section"><div class="section-head"><h2>💬 留言板</h2><span class="muted">一起讨论，不需要注册账号</span></div><div class="notes">${state.notes.map((n,i)=>`<article class="note-card"><div class="note-head"><input class="editable" data-note-field="author" data-note="${i}" value="${esc(n.author)}" placeholder="姓名"><span class="muted">${esc(n.ts||'')}</span>${editUnlocked?`<button class="mini edit-only" data-del-note="${i}">×</button>`:''}</div><textarea class="editable" data-note-field="text" data-note="${i}" placeholder="留言">${esc(n.text)}</textarea></article>`).join('')||'<div class="empty">还没有留言</div>'}</div>${editUnlocked?'<button class="add-btn edit-only" id="addNote">＋ 写留言</button>':''}</section>`}

function bindTripEvents(){
  $('#backToTrips').onclick=goHome; $('#editBtn').onclick=toggleEdit; $('#settingsBtn').onclick=settingsModal; $('#exportBtn').onclick=exportJSON; $('#importBtn').onclick=importJSON; $('#printBtn').onclick=()=>window.print(); $('#deleteCurrentBtn').onclick=()=>deleteTrip(currentSlug); if($('#saveNow'))$('#saveNow').onclick=saveRemote;
  $('#addCheck')?.addEventListener('click',()=>{const v=$('#newCheck').value.trim();if(v){state.checklist.push({id:uid('c'),text:v,done:false});renderTrip();scheduleSave()}});
  $('#addDay')?.addEventListener('click',()=>{state.days.push(defaultDay(state.days.length+1));renderTrip();scheduleSave()});
  $('#addHotel')?.addEventListener('click',()=>{state.hotels.push(defaultHotel());renderTrip();scheduleSave()});
  $('#addTransport')?.addEventListener('click',()=>{state.transport.push(defaultTransport());renderTrip();scheduleSave()});
  $('#addBudget')?.addEventListener('click',()=>{state.budget.push(defaultBudget());renderTrip();scheduleSave()});
  $('#addNote')?.addEventListener('click',()=>{state.notes.unshift({author:'',text:'',ts:new Date().toLocaleString('zh-CN')});renderTrip();scheduleSave()});
  $$('#tripView [data-check]').forEach(e=>e.onchange=()=>{state.checklist[+e.dataset.check].done=e.checked;scheduleSave()});
  $$('#tripView [data-day-field]').forEach(e=>e.onchange=()=>{state.days[+e.dataset.day][e.dataset.dayField]=e.value;scheduleSave();if(e.dataset.dayField==='intensity')renderTrip()});
  $$('#tripView [data-act-field]').forEach(e=>e.onchange=()=>{state.days[+e.dataset.day].items[+e.dataset.act][e.dataset.actField]=e.value;scheduleSave()});
  $$('#tripView [data-link-field]').forEach(e=>e.onchange=()=>{state.days[+e.dataset.day].items[+e.dataset.act].link[+e.dataset.link][e.dataset.linkField]=e.value;scheduleSave()});
  $$('#tripView [data-hotel-field]').forEach(e=>e.onchange=()=>{state.hotels[+e.dataset.hotel][e.dataset.hotelField]=e.value;scheduleSave()});
  $$('#tripView [data-hlink-field]').forEach(e=>e.onchange=()=>{state.hotels[+e.dataset.hotel].link[+e.dataset.link][e.dataset.hlinkField]=e.value;scheduleSave()});
  $$('#tripView [data-trans-field]').forEach(e=>e.onchange=()=>{state.transport[+e.dataset.trans][e.dataset.transField]=e.value;scheduleSave()});
  $$('#tripView [data-budget-field]').forEach(e=>e.onchange=()=>{state.budget[+e.dataset.budget][e.dataset.budgetField]=e.value;scheduleSave();if(['quantity','unitPrice'].includes(e.dataset.budgetField))renderTrip()});
  $$('#tripView [data-note-field]').forEach(e=>e.onchange=()=>{state.notes[+e.dataset.note][e.dataset.noteField]=e.value;scheduleSave()});
  $$('#tripView [data-del-check]').forEach(b=>b.onclick=()=>{state.checklist.splice(+b.dataset.delCheck,1);renderTrip();scheduleSave()});
  $$('#tripView [data-collapse-day]').forEach(b=>b.onclick=()=>{const i=+b.dataset.collapseDay;state.collapsed[i]=!state.collapsed[i];renderTrip()});
  $$('#tripView [data-up-day]').forEach(b=>b.onclick=()=>moveDay(+b.dataset.upDay,-1));$$('#tripView [data-down-day]').forEach(b=>b.onclick=()=>moveDay(+b.dataset.downDay,1));
  $$('#tripView [data-del-day]').forEach(b=>b.onclick=()=>{if(confirm('删除这个 Day？')){state.days.splice(+b.dataset.delDay,1);state.days.forEach((d,i)=>d.n=i+1);renderTrip();scheduleSave()}});
  $$('#tripView [data-add-activity]').forEach(b=>b.onclick=()=>{state.days[+b.dataset.addActivity].items.push(defaultActivity());renderTrip();scheduleSave()});
  $$('#tripView [data-del-act]').forEach(b=>b.onclick=()=>{const [d,a]=b.dataset.delAct.split(':').map(Number);state.days[d].items.splice(a,1);renderTrip();scheduleSave()});
  $$('#tripView [data-add-link]').forEach(b=>b.onclick=()=>{const [d,a]=b.dataset.addLink.split(':').map(Number);state.days[d].items[a].link.push({label:'链接',url:''});renderTrip();scheduleSave()});
  $$('#tripView [data-del-link]').forEach(b=>b.onclick=()=>{const [d,a,l]=b.dataset.delLink.split(':').map(Number);state.days[d].items[a].link.splice(l,1);renderTrip();scheduleSave()});
  $$('#tripView [data-del-hotel]').forEach(b=>b.onclick=()=>{state.hotels.splice(+b.dataset.delHotel,1);renderTrip();scheduleSave()});
  $$('#tripView [data-add-hlink]').forEach(b=>b.onclick=()=>{state.hotels[+b.dataset.addHlink].link.push({label:'链接',url:''});renderTrip();scheduleSave()});
  $$('#tripView [data-del-hlink]').forEach(b=>b.onclick=()=>{const [h,l]=b.dataset.delHlink.split(':').map(Number);state.hotels[h].link.splice(l,1);renderTrip();scheduleSave()});
  $$('#tripView [data-del-trans]').forEach(b=>b.onclick=()=>{state.transport.splice(+b.dataset.delTrans,1);renderTrip();scheduleSave()});
  $$('#tripView [data-del-budget]').forEach(b=>b.onclick=()=>{state.budget.splice(+b.dataset.delBudget,1);renderTrip();scheduleSave()});
  $$('#tripView [data-del-note]').forEach(b=>b.onclick=()=>{state.notes.splice(+b.dataset.delNote,1);renderTrip();scheduleSave()});
}
function moveDay(i,delta){const j=i+delta;if(j<0||j>=state.days.length)return;[state.days[i],state.days[j]]=[state.days[j],state.days[i]];state.days.forEach((d,k)=>d.n=k+1);renderTrip();scheduleSave()}
async function toggleEdit(){if(editUnlocked){editUnlocked=false;editPassword='';renderTrip();return}const pw=prompt('请输入该旅行的编辑密码');if(!pw)return;const {data,error}=await sb.rpc('verify_trip_password',{p_slug:currentSlug,p_password:pw});if(error){toast(error.message);return}if(data===true){editUnlocked=true;editPassword=pw;renderTrip();toast('已进入编辑模式')}else toast('编辑密码不正确')}
function scheduleSave(){if(!editUnlocked)return;clearTimeout(saveTimer);$('#syncStatus')&&( $('#syncStatus').textContent='等待保存…');saveTimer=setTimeout(saveRemote,650)}
async function saveRemote(){if(!editUnlocked||!sb)return;if(saveInFlight){savePending=true;return}saveInFlight=true;$('#syncStatus')&&($('#syncStatus').textContent='保存中…');try{const {data,error}=await sb.rpc('save_trip',{p_slug:currentSlug,p_password:editPassword,p_data:state});if(error||data!==true)throw new Error(error?.message||'保存失败');if(currentTrip)currentTrip.data=state;$('#syncStatus')&&($('#syncStatus').textContent='已同步');toast('已同步')}catch(e){console.error(e);$('#syncStatus')&&($('#syncStatus').textContent='保存失败');toast('保存失败：'+e.message)}finally{saveInFlight=false;if(savePending){savePending=false;saveRemote()}}}
function subscribeRealtime(){if(!sb||!currentSlug)return;if(channel)sb.removeChannel(channel);channel=sb.channel('trip:'+currentSlug).on('postgres_changes',{event:'UPDATE',schema:'public',table:'trip_documents',filter:`slug=eq.${currentSlug}`},payload=>{if(editUnlocked&&saveInFlight)return;currentTrip=payload.new;state=normalize(payload.new.data);renderTrip();toast('🔄 行程已更新')}).subscribe()}
function settingsModal(){const t=currentTrip;showModal(`<h2>⚙️ 旅行设置</h2><div class="form-grid"><div class="field full"><label>旅行名称</label><input id="mTitle" value="${esc(t.title)}"></div><div class="field"><label>目的地</label><input id="mDestination" value="${esc(t.destination)}"></div><div class="field"><label>货币</label><input id="mCurrency" value="${esc(t.currency)}"></div><div class="field"><label>开始日期</label><input id="mStart" type="date" value="${esc(t.start_date||'')}"></div><div class="field"><label>结束日期</label><input id="mEnd" type="date" value="${esc(t.end_date||'')}"></div><div class="field full"><label>简介</label><textarea id="mDesc">${esc(t.description)}</textarea></div></div><div class="modal-actions"><button class="ghost" id="changePw">修改编辑密码</button><button class="primary" id="saveMeta">保存设置</button></div>`);$('#saveMeta').onclick=async()=>{if(!editUnlocked){toast('请先解锁编辑');return}const {data,error}=await sb.rpc('update_trip_meta',{p_slug:currentSlug,p_password:editPassword,p_title:$('#mTitle').value,p_destination:$('#mDestination').value,p_start_date:$('#mStart').value||null,p_end_date:$('#mEnd').value||null,p_currency:$('#mCurrency').value,p_description:$('#mDesc').value});if(error||data!==true){toast(error?.message||'保存失败');return}currentTrip={...currentTrip,title:$('#mTitle').value,destination:$('#mDestination').value,start_date:$('#mStart').value||null,end_date:$('#mEnd').value||null,currency:$('#mCurrency').value,description:$('#mDesc').value};closeModal();renderTrip();toast('旅行设置已更新')};$('#changePw').onclick=changePasswordModal}
function changePasswordModal(){showModal(`<h2>🔐 修改编辑密码</h2><div class="field"><label>当前密码</label><input id="oldPw" type="password"></div><div class="field" style="margin-top:9px"><label>新密码（至少4位）</label><input id="newPw" type="password"></div><div class="modal-actions"><button class="primary" id="doChangePw">修改</button></div>`);$('#doChangePw').onclick=async()=>{const {data,error}=await sb.rpc('change_trip_password',{p_slug:currentSlug,p_current_password:$('#oldPw').value,p_new_password:$('#newPw').value});if(error||data!==true){toast(error?.message||'密码修改失败');return}editPassword=$('#newPw').value;closeModal();toast('编辑密码已修改')}}
function newTripModal(){if(!sb){alert('请先配置 config.js。');return}showModal(`<h2>＋ 创建新旅行</h2><p class="muted">创建旅行需要系统管理密码；同行者之后只需要旅行自己的编辑密码。</p><div class="form-grid"><div class="field full"><label>系统管理密码</label><input id="nAdmin" type="password"></div><div class="field full"><label>旅行名称</label><input id="nTitle" placeholder="例如：2027 韩国亲友团"></div><div class="field"><label>目的地</label><input id="nDest" placeholder="Seoul / Tokyo / 广州"></div><div class="field"><label>货币</label><input id="nCurrency" value="MYR"></div><div class="field"><label>开始日期</label><input id="nStart" type="date"></div><div class="field"><label>结束日期</label><input id="nEnd" type="date"></div><div class="field full"><label>旅行 Slug（网址标识，只能英文/数字/短横线）</label><input id="nSlug" placeholder="korea-trip-2027"></div><div class="field full"><label>同行者编辑密码</label><input id="nEdit" type="password" placeholder="至少4位"></div><div class="field full"><label>简介</label><textarea id="nDesc" placeholder="旅行目标、人数、注意事项……"></textarea></div></div><div class="modal-actions"><button class="primary" id="createTrip">创建旅行</button></div>`);$('#createTrip').onclick=createTrip}
async function createTrip(){const slug=$('#nSlug').value.trim().toLowerCase(), title=$('#nTitle').value.trim(), edit=$('#nEdit').value;if(!slug||!title||edit.length<4){toast('请填写名称、Slug 和至少4位编辑密码');return}const data=blankState();const {data:row,error}=await sb.rpc('create_trip',{p_admin_password:$('#nAdmin').value,p_slug:slug,p_title:title,p_destination:$('#nDest').value,p_start_date:$('#nStart').value||null,p_end_date:$('#nEnd').value||null,p_currency:$('#nCurrency').value||'MYR',p_description:$('#nDesc').value,p_edit_password:edit,p_data:data});if(error){toast(error.message);return}closeModal();toast('旅行已创建');await openTrip(row.slug)}
async function deleteTrip(slug){if(!sb)return;if(!confirm('删除这趟旅行？此操作不可恢复。'))return;const pw=prompt('请输入系统管理密码');if(!pw)return;const {data,error}=await sb.rpc('delete_trip',{p_admin_password:pw,p_slug:slug});if(error||data!==true){toast(error?.message||'删除失败');return}if(slug===currentSlug){await goHome()}else await loadTrips();toast('旅行已删除')}
async function copyTripLink(slug){const url=new URL(location.href);url.searchParams.set('trip',slug);try{await navigator.clipboard.writeText(url.href);toast('共享链接已复制')}catch{prompt('复制这个链接',url.href)}}
function exportJSON(){const payload={meta:{title:currentTrip.title,destination:currentTrip.destination,start_date:currentTrip.start_date,end_date:currentTrip.end_date,currency:currentTrip.currency,description:currentTrip.description},data:state};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(currentSlug||'trip')+'.json';a.click();URL.revokeObjectURL(a.href)}
function importJSON(){const input=document.createElement('input');input.type='file';input.accept='application/json,.json';input.onchange=async()=>{const file=input.files?.[0];if(!file)return;try{const obj=JSON.parse(await file.text());state=normalize(obj.data||obj);if(obj.meta&&editUnlocked){currentTrip={...currentTrip,...obj.meta}}renderTrip();scheduleSave();toast('JSON 已导入；记得保存同步')}catch(e){toast('JSON 格式无效：'+e.message)}};input.click()}

async function init(){
  if(!hasConfig){renderHome([]);showModal(`<h2>⚙️ 还差一步</h2><p>请复制 <code>config.example.js</code> 为 <code>config.js</code>，填入 Supabase Project URL 和 publishable/anon key。</p><p class="muted">数据库初始化请先执行 <code>supabase/schema.sql</code>。</p><div class="modal-actions"><button class="primary" id="okConfig">知道了</button></div>`);$('#okConfig').onclick=closeModal;return}
  if(currentSlug) await openTrip(currentSlug); else await loadTrips();
}
window.addEventListener('popstate',()=>{currentSlug=new URL(location.href).searchParams.get('trip');if(currentSlug)openTrip(currentSlug);else goHome()});
init();
