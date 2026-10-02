(() => {
  const KEY = 'arthurs-circus-web-v1';
  const trip = { id: 'fuengirola-2026', name: 'Fuengirola 2026', subtitle: 'The Wine & Tapas Tour', country: 'Spain', startDate: '2026-09-28', endDate: '2026-10-05' };
  const profiles = [
    { id: 'jamie', name: 'Jamie', type: 'adult', emoji: '🍷' },
    { id: 'adult-2', name: 'Adult 2', type: 'adult', emoji: '🥂' },
    { id: 'kid-1', name: 'Kid 1', type: 'kid', emoji: '🍦' },
  ];
  const seed = {
    profileId: 'jamie', tab: 'home',
    places: [
      { id: 'place-1', name: 'Tapas Stop One', address: 'Fuengirola, Málaga, Spain', type: 'restaurant' },
      { id: 'place-2', name: 'Seafront Wine Bar', address: 'Paseo Marítimo, Fuengirola, Spain', type: 'bar' },
      { id: 'place-3', name: 'Old Town Bodega', address: 'Fuengirola, Málaga, Spain', type: 'bar' },
    ],
    reviews: [
      { id: 'r1', placeId: 'place-1', profileId: 'jamie', overall: 5, comment: 'Brilliant wine, proper glasses and exactly the sort of tapas stop we wanted.', createdAt: '2026-09-29T18:30:00Z' },
      { id: 'r2', placeId: 'place-1', profileId: 'kid-1', overall: 4, comment: 'Great chips and the pudding was the best bit.', createdAt: '2026-09-29T18:35:00Z' },
    ], entries: [], votes: []
  };
  let state;
  try { state = JSON.parse(localStorage.getItem(KEY) || 'null') || structuredClone(seed); }
  catch { state = structuredClone(seed); }
  if (!Array.isArray(state.places) || !Array.isArray(state.reviews) || !Array.isArray(state.entries) || !Array.isArray(state.votes)) state = structuredClone(seed);
  if (!state.profileId) state.profileId = profiles[0].id;
  let selectedPlace = null;
  let formScore = 0;
  let diaryKind = 'photo';
  let diaryDay = dayKey();
  const app = document.querySelector('#app');
  const select = document.querySelector('#profile-select');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const profile = () => profiles.find(p => p.id === state.profileId) || profiles[0];
  const placeFor = id => state.places.find(p => p.id === id);
  const average = placeId => {
    const rows = state.reviews.filter(r => r.placeId === placeId);
    return rows.length ? rows.reduce((sum, r) => sum + Number(r.overall), 0) / rows.length : 0;
  };
  const score = id => average(id) ? average(id).toFixed(1) : '—';
  const sortedPlaces = () => [...state.places].sort((a, b) => average(b.id) - average(a.id));
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); return true; } catch { alert('This device is low on browser storage. Try removing a large diary photo and save again.'); return false; } };
  function dayKey(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
  const stamp = () => `<div class="stamp"><span>${esc(trip.country.toUpperCase())}</span><small>${esc(trip.startDate)} / ${esc(trip.endDate)}</small></div>`;
  const syncNote = `<div class="notice"><strong>Saved in this browser.</strong> This web version keeps your entries on this device. Family accounts and syncing between devices will turn on after the shared online database is connected.</div>`;
  function setTab(tab) { state.tab = tab; selectedPlace = null; save(); render(); }
  function render() {
    select.innerHTML = profiles.map(p => `<option value="${esc(p.id)}" ${p.id === state.profileId ? 'selected' : ''}>${esc(p.emoji)} ${esc(p.name)}</option>`).join('');
    document.querySelectorAll('.bottom-nav [data-tab]').forEach(button => button.classList.toggle('active', button.dataset.tab === state.tab));
    if (selectedPlace) return renderPlace(selectedPlace);
    if (state.tab === 'places') return renderPlaces();
    if (state.tab === 'diary') return renderDiary();
    if (state.tab === 'awards') return renderAwards();
    if (state.tab === 'family') return renderFamily();
    renderHome();
  }
  function placeCards(list) {
    if (!list.length) return '<div class="card empty">No stops yet. Add your first favourite below.</div>';
    return list.map((p, i) => `<article class="card place-card" data-open-place="${esc(p.id)}"><span class="rank">${i + 1}</span><div><h3>${esc(p.name)}</h3><div class="address">${esc(p.address)} · ${esc(p.type)}</div></div><span class="score">⭐ ${esc(score(p.id))}</span></article>`).join('');
  }
  function renderHome() {
    const sorted = sortedPlaces();
    app.innerHTML = `<div class="content"><section class="hero"><div class="eyebrow">FAMILY TRAVEL PASSPORT · CURRENT TRIP</div><h1>${esc(trip.name)}</h1><div class="subtitle">${esc(trip.subtitle)}</div>${stamp()}<p class="playing">Reviewing as ${esc(profile().emoji)} ${esc(profile().name)}</p></section>
      <div class="quick-actions"><button data-goto="places"><span>🍽️</span>Find a stop<br><small class="muted">Browse and rate the holiday favourites</small></button><button data-goto="diary"><span>📖</span>Add a memory<br><small class="muted">Save a photo or the quote of the day</small></button></div>
      <h2 class="section-title">Big Top Leaderboard</h2>${placeCards(sorted)}${syncNote}</div>`;
  }
  function renderPlaces() {
    const list = sortedPlaces();
    app.innerHTML = `<div class="content"><div class="eyebrow">THE HOLIDAY STOPS</div><h1>Where have we ended up?</h1><p class="muted">Keep the bars, restaurants and little discoveries together with the family verdict.</p>${syncNote}<input class="search" id="place-search" placeholder="Search your saved stops…" aria-label="Search saved stops"><div id="place-list">${placeCards(list)}</div>
      <h2 class="section-title">Add a stop</h2><form id="add-place" class="card form"><label class="field">Place name<input name="name" required maxlength="80" placeholder="e.g. The little tapas place by the beach"></label><label class="field">Town or address<input name="address" required maxlength="140" placeholder="Fuengirola, Spain"></label><div class="row"><label class="field" style="flex:1">Kind<select name="type"><option>restaurant</option><option>bar</option><option>cafe</option><option>winery</option><option>other</option></select></label><button class="button" type="submit">Add stop</button></div></form></div>`;
  }
  function renderPlace(id) {
    const place = placeFor(id); if (!place) { selectedPlace = null; return renderPlaces(); }
    const reviews = state.reviews.filter(r => r.placeId === id).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
    app.innerHTML = `<div class="content"><button class="soft-button" data-back>← All stops</button><div class="hero" style="margin-top:16px"><div class="eyebrow">${esc(place.type.toUpperCase())} · FAMILY STOP</div><h1>${esc(place.name)}</h1><p class="subtitle">${esc(place.address)}</p><div class="pill">⭐ ${esc(score(id))} · ${reviews.length} ${reviews.length === 1 ? 'review' : 'reviews'}</div></div>
      <h2 class="section-title">Add your verdict</h2><form id="add-review" class="card form"><div class="field"><span>Your overall rating</span><div class="rating" id="star-rating" aria-label="Choose a star rating">${[1,2,3,4,5].map(n => `<button type="button" data-score="${n}" aria-label="${n} stars">★</button>`).join('')}</div><span class="rating-caption" id="rating-caption">Tap a star</span></div><label class="field">What should the family remember?<textarea name="comment" maxlength="1000" placeholder="The food, the drinks, the atmosphere…"></textarea></label><button class="button" type="submit">Save family rating</button></form>
      <h2 class="section-title">Family verdicts</h2>${reviews.length ? reviews.map(r => `<article class="card"><div class="row space"><strong>${esc((profiles.find(p=>p.id===r.profileId)||{name:'Family',emoji:'🎪'}).emoji)} ${esc((profiles.find(p=>p.id===r.profileId)||{name:'Family'}).name)}</strong><span class="score">⭐ ${esc(Number(r.overall).toFixed(1))}</span></div>${r.comment ? `<p class="muted" style="margin:10px 0 0">${esc(r.comment)}</p>` : ''}<small class="muted">${esc(new Date(r.createdAt).toLocaleDateString())}</small></article>`).join('') : '<div class="card empty">No ratings yet. Be the first to give the verdict.</div>'}</div>`;
  }
  const entriesForDay = () => state.entries.filter(e => e.day === diaryDay).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  function renderDiary() {
    const days = [...new Set([dayKey(), ...state.entries.map(e => e.day)])].sort().reverse();
    const entries = entriesForDay();
    const voteCount = id => state.votes.filter(v => v.entryId === id).length;
    const winners = kind => {
      const items = entries.filter(e => e.kind === kind); const max = Math.max(0, ...items.map(e => voteCount(e.id)));
      return max ? items.filter(e => voteCount(e.id) === max).map(e => e.id) : [];
    };
    const photoWinners = winners('photo'), quoteWinners = winners('quote');
    app.innerHTML = `<div class="content"><div class="eyebrow">THE CIRCUS CHRONICLES</div><h1>Wish you were here 📖</h1><p class="muted">${esc(trip.name)} · Posting as ${esc(profile().emoji)} ${esc(profile().name)}</p>${syncNote}
      <div class="days">${days.map(d => `<button class="day ${d===diaryDay?'selected':''}" data-day="${esc(d)}">${d===dayKey()?'Today':esc(d)}</button>`).join('')}</div>
      <h2 class="section-title">Add today's circus moment</h2><div class="tabs"><button class="tab-button ${diaryKind==='photo'?'selected':''}" data-kind="photo">📸 Photo</button><button class="tab-button ${diaryKind==='quote'?'selected':''}" data-kind="quote">💬 Quote</button></div>
      <form id="add-entry" class="card form"><label class="field">Holiday date<input name="day" type="date" max="${dayKey()}" value="${esc(diaryDay)}" required></label>${diaryKind==='photo'?'<label class="field">Choose a holiday photo<input name="photo" type="file" accept="image/*" required></label>':''}<label class="field">${diaryKind==='quote'?'What did somebody say?':'Caption'}<textarea name="text" maxlength="1000" placeholder="${diaryKind==='quote'?'“I only came for one…” — Who said it?':'Give this moment a caption…'}"></textarea></label><button class="button" type="submit">Save to the diary</button></form>
      <h2 class="section-title">${diaryDay===dayKey()?'Today at the Big Top':esc(diaryDay)} 🎪</h2><p class="muted">One photo vote and one quote vote per family profile, per day. Ties share the crown.</p>
      ${entries.length ? entries.map(entry => { const author = profiles.find(p=>p.id===entry.profileId)||{name:'Family',emoji:'🎪'}; const chosen = state.votes.some(v=>v.entryId===entry.id&&v.profileId===state.profileId); const winning=(entry.kind==='photo'?photoWinners:quoteWinners).includes(entry.id); return `<article class="card"><div class="row space"><span class="label">${esc(author.emoji)} ${esc(author.name)} · ${entry.kind==='photo'?'PHOTO':'QUOTE'}</span>${winning?'<span class="leader">🏆 Leading</span>':''}</div>${entry.photoUri?`<img class="entry-image" src="${entry.photoUri}" alt="${esc(entry.text||'Holiday photo')}">`:''}${entry.text?`<p class="${entry.kind==='quote'?'quote':''}">${esc(entry.text)}</p>`:''}<div class="row space"><button class="vote ${chosen?'selected':''}" data-vote="${esc(entry.id)}">${chosen?'♥ Your vote':'♡ Vote'} · ${voteCount(entry.id)}</button>${entry.profileId===state.profileId?`<button class="delete" data-delete="${esc(entry.id)}">Delete my entry</button>`:''}</div></article>`; }).join('') : '<div class="card empty">No circus moments yet. Add the first photo or memorable quote for this day.</div>'}</div>`;
  }
  function renderAwards() {
    const ranked = sortedPlaces();
    const winner = ranked[0] && average(ranked[0].id) ? ranked[0] : null;
    app.innerHTML = `<div class="content"><div class="eyebrow">THE BIG TOP HONOURS</div><h1>Big Top Awards 🏆</h1><p class="muted">The family's holiday favourites, ranked by the ratings you've saved.</p>${winner?`<div class="hero"><div class="eyebrow">CURRENT FAMILY FAVOURITE</div><h2>${esc(winner.name)}</h2><p class="subtitle">⭐ ${esc(score(winner.id))} average · ${state.reviews.filter(r=>r.placeId===winner.id).length} reviews</p>${esc(winner.address)}</div>`:'<div class="card empty">Add a rating and the family awards will start taking shape.</div>'}<h2 class="section-title">The leaderboard</h2>${placeCards(ranked)}${syncNote}</div>`;
  }
  function renderFamily() {
    app.innerHTML = `<div class="content"><div class="eyebrow">THE TRAVELLING TROUPE</div><h1>Meet the family 🎪</h1><p class="muted">Choose who is adding the next rating, diary moment or vote.</p>${profiles.map(p=>`<button class="card row space" style="width:100%;text-align:left;cursor:pointer;color:var(--ink)" data-profile="${esc(p.id)}"><span><strong style="font-size:18px">${esc(p.emoji)} ${esc(p.name)}</strong><br><span class="muted">${p.type==='kid'?'Young critic':'Family reviewer'}</span></span><span class="pill">${p.id===state.profileId?'Currently active':'Switch profile'}</span></button>`).join('')}${syncNote}<p class="fineprint">Profiles on this screen are for trying the app on one device. Family sign-in and cross-device access will be added with the shared database.</p></div>`;
  }
  function compressPhoto(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader(); reader.onerror = reject;
      reader.onload = () => { const image = new Image(); image.onerror = reject; image.onload = () => {
        const scale = Math.min(1, 1400 / Math.max(image.width, image.height)); const canvas = document.createElement('canvas'); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height); resolve(canvas.toDataURL('image/jpeg', .78));
      }; image.src = reader.result; }; reader.readAsDataURL(file);
    });
  }
  document.addEventListener('click', async event => {
    const button = event.target.closest('button,[data-open-place]'); if (!button) return;
    if (button.dataset.tab) setTab(button.dataset.tab);
    else if (button.dataset.goto) setTab(button.dataset.goto);
    else if (button.dataset.openPlace) { selectedPlace = button.dataset.openPlace; formScore = 0; render(); }
    else if (button.hasAttribute('data-back')) { selectedPlace = null; state.tab = 'places'; render(); }
    else if (button.dataset.score) { formScore = Number(button.dataset.score); document.querySelectorAll('#star-rating button').forEach(star=>star.classList.toggle('on',Number(star.dataset.score)<=formScore)); document.querySelector('#rating-caption').textContent = `${formScore} out of 5 stars`; }
    else if (button.dataset.kind) { diaryKind = button.dataset.kind; renderDiary(); }
    else if (button.dataset.day) { diaryDay = button.dataset.day; renderDiary(); }
    else if (button.dataset.vote) {
      const entry = state.entries.find(e=>e.id===button.dataset.vote); if (!entry) return;
      const old = state.votes.find(v=>v.tripId===trip.id&&v.day===entry.day&&v.kind===entry.kind&&v.profileId===state.profileId);
      state.votes = state.votes.filter(v=>!(v.tripId===trip.id&&v.day===entry.day&&v.kind===entry.kind&&v.profileId===state.profileId));
      if (old?.entryId !== entry.id) state.votes.push({tripId:trip.id,day:entry.day,kind:entry.kind,profileId:state.profileId,entryId:entry.id}); save(); renderDiary();
    } else if (button.dataset.delete) {
      if (!confirm('Delete your diary moment and its votes?')) return;
      state.entries=state.entries.filter(e=>e.id!==button.dataset.delete);state.votes=state.votes.filter(v=>v.entryId!==button.dataset.delete);save();renderDiary();
    } else if (button.dataset.profile) { state.profileId=button.dataset.profile;save();renderFamily(); }
  });
  document.addEventListener('input', event => {
    if (event.target.id === 'place-search') {
      const q=event.target.value.trim().toLowerCase(); const list=sortedPlaces().filter(p=>`${p.name} ${p.address} ${p.type}`.toLowerCase().includes(q)); document.querySelector('#place-list').innerHTML=placeCards(list);
    }
  });
  document.addEventListener('submit', async event => {
    event.preventDefault(); const form=event.target;
    if (form.id==='add-place') {
      const data=new FormData(form); state.places.unshift({id:`place-${Date.now()}`,name:String(data.get('name')).trim(),address:String(data.get('address')).trim(),type:String(data.get('type'))});save();renderPlaces();
    } else if (form.id==='add-review') {
      if (!formScore) return alert('Choose a star rating first.'); const data=new FormData(form); state.reviews.unshift({id:`review-${Date.now()}`,placeId:selectedPlace,profileId:state.profileId,overall:formScore,comment:String(data.get('comment')).trim(),createdAt:new Date().toISOString()}); if(save()){formScore=0;render();}
    } else if (form.id==='add-entry') {
      const data=new FormData(form); const text=String(data.get('text')).trim(); const day=String(data.get('day'));
      if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||day>dayKey())return alert('Choose today or an earlier holiday date.');
      let photoUri; const file=data.get('photo');
      if(diaryKind==='photo'){if(!(file instanceof File)||!file.size)return alert('Choose a holiday photo first.');try{photoUri=await compressPhoto(file);}catch{return alert('That photo could not be opened. Please choose another.');}}
      if(diaryKind==='quote'&&!text)return alert('Add the quote first.'); diaryDay=day;
      state.entries.unshift({id:`entry-${Date.now()}`,tripId:trip.id,profileId:state.profileId,day,kind:diaryKind,text,photoUri,createdAt:new Date().toISOString()});if(save())renderDiary();
    }
  });
  select.addEventListener('change',()=>{state.profileId=select.value;save();render();});
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('./sw.js').catch(()=>{});
  render();
})();
