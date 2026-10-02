(() => {
  const KEY = 'arthurs-circus-web-v1';
  const defaultTrip = { id:'family-holiday', name:'Our Family Holiday', destination:'Add your destination', startDate:'', endDate:'' };
  const defaultProfiles = [
    { id:'adult-1', name:'Adult 1', type:'adult', emoji:'🧳' },
    { id:'adult-2', name:'Adult 2', type:'adult', emoji:'🕶️' },
    { id:'kid-1', name:'Kid 1', type:'kid', emoji:'🍦' },
    { id:'kid-2', name:'Kid 2', type:'kid', emoji:'🧃' }
  ];
  const freshState = () => ({ profileId:'adult-1', tab:'home', trip:{...defaultTrip}, profiles:structuredClone(defaultProfiles), places:[], reviews:[], entries:[], votes:[] });
  let state;
  try { state = JSON.parse(localStorage.getItem(KEY) || 'null') || freshState(); }
  catch { state = freshState(); }
  if (!state || typeof state !== 'object') state = freshState();
  state.trip = {...defaultTrip, ...(state.trip || {})};
  state.profiles = Array.isArray(state.profiles) && state.profiles.length ? state.profiles : structuredClone(defaultProfiles);
  for (const key of ['places','reviews','entries','votes']) if (!Array.isArray(state[key])) state[key] = [];
  // Clear the old placeholder stops from the first prototype, while keeping any real entries.
  state.places = state.places.filter(p => p.address !== 'Your holiday destination');
  if (!state.profiles.some(p => p.id === state.profileId)) state.profileId = state.profiles[0].id;
  let selectedPlace = null, tripEditorOpen = false, formScores = {};
  let diaryKind = 'photo', diaryDay = dayKey();
  const app = document.querySelector('#app'), select = document.querySelector('#profile-select');
  const dimensions = [
    ['food','Food & drink'], ['value','Value for money'], ['service','Service'], ['vibe','Atmosphere'], ['family','Family approval']
  ];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const person = id => state.profiles.find(p => p.id === id) || state.profiles[0] || defaultProfiles[0];
  const placeFor = id => state.places.find(p => p.id === id);
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); return true; } catch { alert('Your phone browser is out of storage. Try deleting an old photo from the diary and save again.'); return false; } };
  function dayKey(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
  const average = (placeId, dimension='overall') => {
    const values = state.reviews.filter(r => r.placeId === placeId && Number(r[dimension]) > 0).map(r => Number(r[dimension]));
    return values.length ? values.reduce((a,b)=>a+b,0)/values.length : 0;
  };
  const score = id => average(id) ? average(id).toFixed(1) : '—';
  const rankedPlaces = () => [...state.places].sort((a,b) => average(b.id)-average(a.id));
  function stamp(text, small='OFFICIAL FAMILY RECORD') { return `<div class="stamp"><span>${esc(text || 'HOLIDAY PASSPORT')}</span><small>${esc(small)}</small></div>`; }
  const syncNote = `<aside class="notice"><strong>Saved on this device.</strong> This version keeps your diary and ratings in this browser. For everyone to see the same entries on different phones, we still need to connect the shared family account.</aside>`;
  function setTab(tab) { state.tab = tab; selectedPlace = null; save(); render(); }
  function render() {
    select.innerHTML = state.profiles.map(p => `<option value="${esc(p.id)}" ${p.id===state.profileId?'selected':''}>${esc(p.emoji)} ${esc(p.name)}</option>`).join('');
    document.querySelectorAll('.bottom-nav [data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab===state.tab));
    if (selectedPlace) return renderPlace(selectedPlace);
    if (state.tab==='places') return renderPlaces();
    if (state.tab==='diary') return renderDiary();
    if (state.tab==='awards') return renderAwards();
    if (state.tab==='family') return renderFamily();
    renderHome();
  }
  function placeCards(list) {
    if (!list.length) return `<article class="card empty"><div class="empty-mark">⌖</div><strong>No evidence filed yet.</strong><p>Add the first place before the good ones get away with it.</p></article>`;
    return list.map((p,i) => `<button class="card place-card" data-open-place="${esc(p.id)}"><span class="rank">${String(i+1).padStart(2,'0')}</span><span class="place-copy"><strong>${esc(p.name)}</strong><small>${esc(p.address)} · ${esc(p.type)}</small></span><span class="score">${average(p.id)?`★ ${esc(score(p.id))}`:'Rate me →'}</span></button>`).join('');
  }
  function renderHome() {
    const dated = state.trip.startDate || state.trip.endDate ? `${state.trip.startDate || '—'}  →  ${state.trip.endDate || '—'}` : 'Dates still under negotiation';
    const reviews = state.reviews.length, entries = state.entries.length;
    app.innerHTML = `<div class="content">
      <div class="page-kicker"><span>TRAVEL DOCUMENT NO. 001</span><span>VALID FOR FAMILY USE</span></div>
      <section class="passport-cover"><div class="cover-seal">ATC<br><b>✦</b></div><div class="cover-copy"><div class="eyebrow">THE FAMILY HOLIDAY PASSPORT</div><h1>${esc(state.trip.name)}</h1><p>${esc(state.trip.destination)} <span>·</span> ${esc(dated)}</p><div class="cover-bottom"><span>${esc(person(state.profileId).emoji)} Currently writing: <b>${esc(person(state.profileId).name)}</b></span><button class="text-button" data-action="edit-trip">${tripEditorOpen?'Close trip details':'Edit trip details'}</button></div></div></section>
      ${tripEditorOpen ? `<form id="trip-form" class="card form"><div class="form-heading"><span class="eyebrow">TRIP DETAILS</span><span class="muted">The admin department is you.</span></div><label class="field">Trip name<input name="name" maxlength="70" value="${esc(state.trip.name)}" placeholder="e.g. The annual family expedition"></label><label class="field">Destination<input name="destination" maxlength="100" value="${esc(state.trip.destination)}" placeholder="Town, island or airport lounge"></label><div class="two-col"><label class="field">From<input name="startDate" type="date" value="${esc(state.trip.startDate)}"></label><label class="field">To<input name="endDate" type="date" value="${esc(state.trip.endDate)}"></label></div><button class="button" type="submit">Save trip details</button></form>` : ''}
      <div class="stat-strip"><div><strong>${state.places.length}</strong><span>places logged</span></div><div><strong>${reviews}</strong><span>verdicts filed</span></div><div><strong>${entries}</strong><span>memories saved</span></div></div>
      <div class="quick-actions"><button data-goto="places"><span>＋</span><b>Log a place</b><small>Restaurants, bars, cafés and other financial decisions.</small></button><button data-goto="diary"><span>▤</span><b>Save the evidence</b><small>Photos, quotes and the exact version of events.</small></button></div>
      <div class="section-head"><div><div class="eyebrow">CURRENT FIELD NOTES</div><h2>Places under review</h2></div><button class="text-button" data-goto="places">All places →</button></div>
      ${placeCards(rankedPlaces().slice(0,3))}
      <aside class="quip"><span>“</span><p>${homeQuip()}</p><small>FAMILY POLICY: opinions are final until dessert arrives.</small></aside>
      ${syncNote}</div>`;
  }
  function homeQuip() {
    const lines = [
      'Every meal is an opportunity to say “we should have booked somewhere else” while still clearing the plate.',
      'We travel for the culture. The chips are a very important part of the culture.',
      'All expenses are shared. All blame is assigned individually.',
      'Please retain receipts. Especially if somebody says “it was only a quick drink”.'
    ];
    return lines[Math.floor(Date.now()/86400000)%lines.length];
  }
  function renderPlaces() {
    const list = rankedPlaces();
    app.innerHTML = `<div class="content"><div class="eyebrow">PLACE REGISTER · ${state.places.length} FILED</div><h1>Where did we eat, drink or regret?</h1><p class="lede">Log the address, leave an honest verdict and remember who confidently ordered the weird thing.</p>
      <input class="search" id="place-search" placeholder="Search places, towns or types…" aria-label="Search places"><div id="place-list">${placeCards(list)}</div>
      <div class="section-head"><div><div class="eyebrow">NEW FILE</div><h2>Add a place</h2></div></div>
      <form id="add-place" class="card form"><label class="field">Name of place<input name="name" required maxlength="80" placeholder="The place with the suspiciously good garlic bread"></label><label class="field">Town or address<input name="address" required maxlength="140" placeholder="So we can find it again. Allegedly."></label><div class="row"><label class="field grow">Type<select name="type"><option>Restaurant</option><option>Bar</option><option>Cafe</option><option>Beach</option><option>Market</option><option>Attraction</option><option>Other</option></select></label><button class="button" type="submit">Add to passport</button></div></form>
      ${syncNote}</div>`;
  }
  const starRow = (dimension,label) => `<div class="rating-line"><span>${esc(label)}</span><div class="rating" data-rating-group="${esc(dimension)}" role="group" aria-label="Rate ${esc(label)}">${[1,2,3,4,5].map(n=>`<button type="button" class="${(formScores[dimension]||0)>=n?'on':''}" data-rating="${dimension}" data-score="${n}" aria-label="${n} out of 5">★</button>`).join('')}</div></div>`;
  const verdictFor = r => r.overall>=5?'Would return. Hide the receipt.':r.overall>=4?'Would go back, preferably before the kids get hangry.':r.overall>=3?'Fine. Nobody has written a one-star review of the family yet.':r.overall>=2?'We have discussed it in the group chat.': 'A learning experience. A costly, edible learning experience.';
  function renderPlace(id) {
    const place = placeFor(id); if (!place) { selectedPlace=null; return renderPlaces(); }
    const reviews = state.reviews.filter(r=>r.placeId===id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
    const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name} ${place.address}`)}`;
    app.innerHTML = `<div class="content"><button class="soft-button" data-back>← Place register</button><section class="place-heading"><div class="eyebrow">${esc(place.type.toUpperCase())} · PASSPORT ENTRY</div><h1>${esc(place.name)}</h1><p class="lede">${esc(place.address)} <a class="text-button" href="${mapUrl}" target="_blank" rel="noreferrer">Map ↗</a></p><div class="rating-summary">${average(id)?`★ ${esc(score(id))} family average`:'No rating yet'} <span>·</span> ${reviews.length} ${reviews.length===1?'verdict':'verdicts'}</div></section>
      <div class="section-head"><div><div class="eyebrow">FORM ATC-5</div><h2>Submit your verdict</h2></div></div>
      <form id="add-review" class="card form"><p class="form-intro">Be honest. The waiter cannot see this. Probably.</p>${starRow('overall','Overall verdict *')}
      <details class="rating-details"><summary>Break it down (optional, but useful for the awards)</summary><div class="rating-breakdown">${dimensions.map(([key,label])=>starRow(key,label)).join('')}</div></details>
      <label class="field">Would you go back?<select name="returnVerdict"><option value="yes">Yes. Book it before somebody sensible does.</option><option value="maybe">Maybe. Depends who is paying.</option><option value="no">No. We have suffered enough.</option></select></label>
      <label class="field">What happened? <textarea name="comment" maxlength="1000" placeholder="The food, the bill, the service, who ordered the octopus…"></textarea></label>
      <button class="button" type="submit">File this verdict</button></form>
      <div class="section-head"><div><div class="eyebrow">SIGNED BY THE FAMILY</div><h2>Previous verdicts</h2></div></div>
      ${reviews.length?reviews.map(r=>`<article class="card review-card"><div class="row space"><strong>${esc(person(r.profileId).emoji)} ${esc(person(r.profileId).name)}</strong><span class="score">★ ${esc(Number(r.overall).toFixed(1))}</span></div><p class="verdict-quip">${esc(verdictFor(r))}</p>${r.comment?`<p>${esc(r.comment)}</p>`:''}<div class="review-meta">${esc(new Date(r.createdAt).toLocaleDateString())}${r.food?` · Food ${r.food}/5 · Value ${r.value||'—'}/5 · Vibe ${r.vibe||'—'}/5`:''}</div></article>`).join(''):`<article class="card empty"><strong>No verdicts filed.</strong><p>The place is currently enjoying the benefit of the doubt.</p></article>`}
      <button class="delete-place" data-delete-place="${esc(id)}">Remove this place from the passport</button></div>`;
  }
  const entriesForDay = () => state.entries.filter(e=>e.day===diaryDay).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  function renderDiary() {
    const days=[...new Set([dayKey(),...state.entries.map(e=>e.day)])].sort().reverse(), entries=entriesForDay();
    const voteCount=id=>state.votes.filter(v=>v.entryId===id).length;
    const winners=kind=>{const items=entries.filter(e=>e.kind===kind),max=Math.max(0,...items.map(e=>voteCount(e.id)));return max?items.filter(e=>voteCount(e.id)===max).map(e=>e.id):[];};
    const pw=winners('photo'), qw=winners('quote');
    app.innerHTML=`<div class="content"><div class="eyebrow">DAILY EVIDENCE LOG</div><h1>The bits we’ll misremember</h1><p class="lede">Photos, quotes and competing accounts of what “just one drink” meant.</p>
      <div class="days">${days.map(d=>`<button class="day ${d===diaryDay?'selected':''}" data-day="${esc(d)}">${d===dayKey()?'Today':esc(d)}</button>`).join('')}</div>
      <div class="section-head"><div><div class="eyebrow">ADD TO THE RECORD</div><h2>Today's evidence</h2></div></div>
      <div class="tabs"><button class="tab-button ${diaryKind==='photo'?'selected':''}" data-kind="photo">📷 Photo</button><button class="tab-button ${diaryKind==='quote'?'selected':''}" data-kind="quote">“” Quote</button></div>
      <form id="add-entry" class="card form"><label class="field">Date<input name="day" type="date" max="${dayKey()}" value="${esc(diaryDay)}" required></label>${diaryKind==='photo'?'<label class="field">Choose a photo<input name="photo" type="file" accept="image/*" required><small class="hint">The photo is stored in this browser. Best not to upload 400 pictures of the same paella.</small></label>':''}<label class="field">${diaryKind==='quote'?'What was actually said?':'Caption the evidence'}<textarea name="text" maxlength="1000" placeholder="${diaryKind==='quote'?'“I thought you said this was included.” — the family treasurer':'Who, where, and why does everyone look sunburnt?'}"></textarea></label><button class="button" type="submit">Add to the record</button></form>
      <div class="section-head"><div><div class="eyebrow">DAILY PUBLIC VOTE</div><h2>${diaryDay===dayKey()?'Today':esc(diaryDay)}</h2></div></div><p class="muted">Everyone gets one photo vote and one quote vote per day. Ties are settled by absolutely no authority whatsoever.</p>
      ${entries.length?entries.map(entry=>{const author=person(entry.profileId),chosen=state.votes.some(v=>v.entryId===entry.id&&v.profileId===state.profileId),winning=(entry.kind==='photo'?pw:qw).includes(entry.id);return `<article class="card diary-card"><div class="row space"><span class="label">${esc(author.emoji)} ${esc(author.name)} · ${entry.kind==='photo'?'PHOTO':'QUOTE'}</span>${winning?'<span class="leader">★ Current favourite</span>':''}</div>${entry.photoUri?`<img class="entry-image" src="${entry.photoUri}" alt="${esc(entry.text||'Holiday photo')}">`:''}${entry.text?`<p class="${entry.kind==='quote'?'quote':''}">${esc(entry.text)}</p>`:''}<div class="row space"><button class="vote ${chosen?'selected':''}" data-vote="${esc(entry.id)}">${chosen?'♥ Voted':'♡ Vote'} · ${voteCount(entry.id)}</button>${entry.profileId===state.profileId?`<button class="delete" data-delete="${esc(entry.id)}">Delete</button>`:''}</div></article>`;}).join(''):`<article class="card empty"><strong>No evidence for ${diaryDay===dayKey()?'today':esc(diaryDay)}.</strong><p>Everyone’s story is still suspiciously consistent.</p></article>`}
      ${syncNote}</div>`;
  }
  function renderAwards() {
    const scored=state.places.filter(p=>average(p.id));
    const awardRows=[['overall',"The place we'd actually return to",'Has to survive the family group chat first.'],['food','Best thing we ate','May be a side dish. No one is judging.'],['value','Best value','The only award the holiday budget supports.'],['service','Service with a pulse','Or at least a visible member of staff.'],['vibe','Best atmosphere','Good lighting can hide a lot.'],['family','Most likely to keep the kids happy','A rare and valuable result.']];
    const award=(key,title,sub)=>{const eligible=scored.filter(p=>average(p.id,key));const winner=[...eligible].sort((a,b)=>average(b.id,key)-average(a.id,key))[0];return `<article class="award-card"><span class="award-seal">${key==='overall'?'★':'✦'}</span><div><small>${esc(title)}</small><strong>${winner?`${esc(winner.name)} · ${average(winner.id,key).toFixed(1)}/5`:'Awaiting nominations'}</strong><p>${winner?esc(winner.address):'The panel has not been bribed with snacks yet.'} <span>· ${esc(sub)}</span></p></div></article>`;};
    const biggestSplurge=[...state.places].sort((a,b)=>state.reviews.filter(r=>r.placeId===b.id).length-state.reviews.filter(r=>r.placeId===a.id).length)[0];
    app.innerHTML=`<div class="content"><div class="eyebrow">ANNUAL FAMILY HONOURS</div><h1>The official-ish verdicts</h1><p class="lede">Awards based on the ratings you entered. The judges are family members and therefore compromised.</p>
      <div class="award-list">${awardRows.map(([k,t,s])=>award(k,t,s)).join('')}</div>
      ${biggestSplurge?`<article class="quip splurge"><div class="eyebrow">SPECIAL MENTION</div><strong>Most discussed at the dinner table</strong><p>${esc(biggestSplurge.name)} — ${state.reviews.filter(r=>r.placeId===biggestSplurge.id).length} verdicts, and still no agreement.</p></article>`:''}
      <div class="section-head"><div><div class="eyebrow">THE RUNNING ORDER</div><h2>All places</h2></div></div>${placeCards(rankedPlaces())}${syncNote}</div>`;
  }
  function renderFamily() {
    app.innerHTML=`<div class="content"><div class="eyebrow">HOUSEHOLD CONTRIBUTORS</div><h1>Who’s holding the pen?</h1><p class="lede">Give everyone a name so we know who gave the chips five stars and the hotel two.</p>
      <div class="profile-list">${state.profiles.map(p=>`<button class="card profile-card ${p.id===state.profileId?'current':''}" data-profile="${esc(p.id)}"><span class="profile-emoji">${esc(p.emoji)}</span><span><strong>${esc(p.name)}</strong><small>${p.type==='kid'?'Junior reviewer':'Family reviewer'}</small></span><span class="pill">${p.id===state.profileId?'Writing now':'Switch to this person'}</span></button>`).join('')}</div>
      <div class="section-head"><div><div class="eyebrow">EDIT THE ROLL CALL</div><h2>Names and roles</h2></div></div><form id="profile-form" class="card form">${state.profiles.map((p,i)=>`<label class="field">${p.type==='kid'?'Young critic':'Family reviewer'} ${i+1}<input name="name-${esc(p.id)}" maxlength="32" value="${esc(p.name)}" required></label>`).join('')}<button class="button" type="submit">Save names</button></form>
      ${state.profiles.length<8?`<form id="add-profile" class="card form"><div class="eyebrow">ADD ANOTHER CONTRIBUTOR</div><label class="field">Name<input name="name" maxlength="32" required placeholder="The newest member of the review panel"></label><label class="field">Role<select name="type"><option value="adult">Family reviewer</option><option value="kid">Young critic</option></select></label><button class="soft-button" type="submit">Add person</button></form>`:''}
      <details class="backup-details"><summary>Back up or move this passport</summary><p class="muted">A backup file lets you move this device’s entries to another browser. It does not keep devices in sync automatically.</p><div class="row"><button class="soft-button" data-action="export">Download backup</button><label class="soft-button import-button">Restore backup<input id="import-backup" type="file" accept="application/json,.json" hidden></label></div></details>
      ${syncNote}</div>`;
  }
  function compressPhoto(file) {
    return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=reject;reader.onload=()=>{const image=new Image();image.onerror=reject;image.onload=()=>{const scale=Math.min(1,1400/Math.max(image.width,image.height)),canvas=document.createElement('canvas');canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL('image/jpeg',.78));};image.src=reader.result;};reader.readAsDataURL(file);});
  }
  document.addEventListener('click',async event=>{
    const button=event.target.closest('button,[data-open-place]');if(!button)return;
    if(button.dataset.tab)setTab(button.dataset.tab);
    else if(button.dataset.goto)setTab(button.dataset.goto);
    else if(button.dataset.openPlace){selectedPlace=button.dataset.openPlace;formScores={};render();}
    else if(button.hasAttribute('data-back')){selectedPlace=null;state.tab='places';render();}
    else if(button.dataset.rating){formScores[button.dataset.rating]=Number(button.dataset.score);const form=document.querySelector('#add-review');if(form){const holder=form.querySelector(`[data-rating-group="${button.dataset.rating}"]`);if(holder)holder.querySelectorAll('button').forEach(star=>star.classList.toggle('on',Number(star.dataset.score)<=formScores[button.dataset.rating]));}}
    else if(button.dataset.kind){diaryKind=button.dataset.kind;renderDiary();}
    else if(button.dataset.day){diaryDay=button.dataset.day;renderDiary();}
    else if(button.dataset.action==='edit-trip'){tripEditorOpen=!tripEditorOpen;renderHome();}
    else if(button.dataset.action==='export'){const blob=new Blob([JSON.stringify(state)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='arthurs-holiday-passport-backup.json';a.click();URL.revokeObjectURL(url);}
    else if(button.dataset.vote){const entry=state.entries.find(e=>e.id===button.dataset.vote);if(!entry)return;const old=state.votes.find(v=>v.tripId===state.trip.id&&v.day===entry.day&&v.kind===entry.kind&&v.profileId===state.profileId);state.votes=state.votes.filter(v=>!(v.tripId===state.trip.id&&v.day===entry.day&&v.kind===entry.kind&&v.profileId===state.profileId));if(old?.entryId!==entry.id)state.votes.push({tripId:state.trip.id,day:entry.day,kind:entry.kind,profileId:state.profileId,entryId:entry.id});save();renderDiary();}
    else if(button.dataset.delete){if(!confirm('Remove this entry and its votes?'))return;state.entries=state.entries.filter(e=>e.id!==button.dataset.delete);state.votes=state.votes.filter(v=>v.entryId!==button.dataset.delete);save();renderDiary();}
    else if(button.dataset.deletePlace){if(!confirm('Remove this place and its reviews from the passport?'))return;state.places=state.places.filter(p=>p.id!==button.dataset.deletePlace);state.reviews=state.reviews.filter(r=>r.placeId!==button.dataset.deletePlace);selectedPlace=null;save();renderPlaces();}
    else if(button.dataset.profile){state.profileId=button.dataset.profile;save();render();}
  });
  document.addEventListener('input',event=>{if(event.target.id==='place-search'){const q=event.target.value.trim().toLowerCase(),list=rankedPlaces().filter(p=>`${p.name} ${p.address} ${p.type}`.toLowerCase().includes(q)),node=document.querySelector('#place-list');if(node)node.innerHTML=placeCards(list);}});
  document.addEventListener('change',async event=>{if(event.target.id==='import-backup'){const file=event.target.files?.[0];if(!file)return;try{const incoming=JSON.parse(await file.text());if(!Array.isArray(incoming.places)||!Array.isArray(incoming.reviews)||!Array.isArray(incoming.entries)||!Array.isArray(incoming.votes))throw new Error('invalid');state={...freshState(),...incoming,trip:{...defaultTrip,...incoming.trip}};save();alert('Backup restored on this device.');render();}catch{alert('That backup file could not be read.');}}});
  document.addEventListener('submit',async event=>{
    event.preventDefault();const form=event.target;
    if(form.id==='trip-form'){const d=new FormData(form);state.trip.name=String(d.get('name')).trim()||defaultTrip.name;state.trip.destination=String(d.get('destination')).trim()||defaultTrip.destination;state.trip.startDate=String(d.get('startDate'));state.trip.endDate=String(d.get('endDate'));if(state.trip.startDate&&state.trip.endDate&&state.trip.endDate<state.trip.startDate)return alert('The return date needs to be after the start date.');tripEditorOpen=false;save();renderHome();}
    else if(form.id==='add-place'){const d=new FormData(form);state.places.unshift({id:`place-${Date.now()}`,name:String(d.get('name')).trim(),address:String(d.get('address')).trim(),type:String(d.get('type'))});save();renderPlaces();}
    else if(form.id==='add-review'){if(!formScores.overall)return alert('Give the overall verdict a star rating first.');const d=new FormData(form),review={id:`review-${Date.now()}`,placeId:selectedPlace,profileId:state.profileId,overall:formScores.overall,comment:String(d.get('comment')).trim(),returnVerdict:String(d.get('returnVerdict')),createdAt:new Date().toISOString()};for(const [key] of dimensions)review[key]=formScores[key]||0;state.reviews.unshift(review);if(save()){formScores={};render();}}
    else if(form.id==='profile-form'){const d=new FormData(form);for(const p of state.profiles)p.name=String(d.get(`name-${p.id}`)).trim()||p.name;save();render();}
    else if(form.id==='add-profile'){if(state.profiles.length>=8)return alert('The review panel is full. Eight people is already a lot of opinions.');const d=new FormData(form),type=String(d.get('type')),name=String(d.get('name')).trim();if(!name)return;state.profiles.push({id:`${type}-${Date.now()}`,name,type,emoji:type==='kid'?'🍦':'🧳'});save();render();}
    else if(form.id==='add-entry'){const d=new FormData(form),text=String(d.get('text')).trim(),day=String(d.get('day'));if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||day>dayKey())return alert('Choose today or an earlier holiday date.');let photoUri;const file=d.get('photo');if(diaryKind==='photo'){if(!(file instanceof File)||!file.size)return alert('Choose a photo first.');try{photoUri=await compressPhoto(file);}catch{return alert('That photo could not be opened. Please choose another.');}}if(diaryKind==='quote'&&!text)return alert('Add the quote first.');diaryDay=day;state.entries.unshift({id:`entry-${Date.now()}`,tripId:state.trip.id,profileId:state.profileId,day,kind:diaryKind,text,photoUri,createdAt:new Date().toISOString()});if(save())renderDiary();}
  });
  select.addEventListener('change',()=>{state.profileId=select.value;save();render();});
  if('serviceWorker'in navigator&&/^https?:$/.test(location.protocol))navigator.serviceWorker.register('./sw.js').catch(()=>{});
  render();
})();
