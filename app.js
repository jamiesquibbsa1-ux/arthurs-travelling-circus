(() => {
  const KEY = 'arthurs-circus-web-v1';
  const defaultTrip = { id:'family-holiday', name:'Our Family Holiday', destination:'Add your destination', startDate:'', endDate:'' };
  const defaultProfiles = [
    { id:'adult-1', name:'Adult 1', type:'adult', emoji:'🧳' },
    { id:'adult-2', name:'Adult 2', type:'adult', emoji:'🕶️' },
    { id:'kid-1', name:'Kid 1', type:'kid', emoji:'🍦' },
    { id:'kid-2', name:'Kid 2', type:'kid', emoji:'🧃' }
  ];
  const freshState = () => ({ profileId:'adult-1', tab:'home', trip:{...defaultTrip}, profiles:structuredClone(defaultProfiles), places:[], reviews:[], entries:[], votes:[], competitions:[], lastArea:'', lastLocation:null });
  let state;
  try { state = JSON.parse(localStorage.getItem(KEY) || 'null') || freshState(); }
  catch { state = freshState(); }
  if (!state || typeof state !== 'object') state = freshState();
  for (const review of (state.reviews||[])) if (review.foodTest == null && review.tapasTest != null) review.foodTest = review.tapasTest;
  state.trip = {...defaultTrip, ...(state.trip || {})};
  state.profiles = Array.isArray(state.profiles) && state.profiles.length ? state.profiles : structuredClone(defaultProfiles);
  for (const key of ['places','reviews','entries','votes','competitions']) if (!Array.isArray(state[key])) state[key] = [];
  if (typeof state.lastArea !== 'string') state.lastArea = '';
  if (!state.lastLocation || !Number.isFinite(Number(state.lastLocation.latitude)) || !Number.isFinite(Number(state.lastLocation.longitude))) state.lastLocation = null;
  // Clear the old placeholder stops from the first prototype, while keeping any real entries.
  state.places = state.places.filter(p => p.address !== 'Your holiday destination');
  if (!state.profiles.some(p => p.id === state.profileId)) state.profileId = state.profiles[0].id;
  let selectedPlace = null, tripEditorOpen = false, formScores = {}, reviewType='food', selectedSearchPlace=null;
  let placeSearchResults=[], lastPlaceSearchAt=0, googleMapsLoading;
  let diaryKind = 'photo', diaryDay = dayKey(), selectedCompetitionId = null, competitionDraftQuestionCount = 4;
  const app = document.querySelector('#app'), select = document.querySelector('#profile-select');
  const ratingSets = {
    food: [['foodTest','Food Test'],['walletDamage','Wallet Damage'],['vibeCheck','Vibe Check'],['peopleWatching','People Watching'],['holidayFeeling','Holiday Feeling'],['looRating','Loo Rating'],['worthTheWalk','Worth the Walk?']],
    drinks: [['properGlass','Proper Glass?'],['oneMoreThen','One More Then?'],['walletDamage','Wallet Damage'],['vibeCheck','Vibe Check'],['peopleWatching','People Watching'],['holidayFeeling','Holiday Feeling'],['looRating','Loo Rating'],['pintTest','Pint Test'],['cocktailTest','Cocktail Test'],['wineTest','Wine Test'],['tomorrowRisk','Tomorrow Morning Risk'],['worthTheWalk','Worth the Walk?']],
    both: [['foodTest','Food Test'],['properGlass','Proper Glass?'],['oneMoreThen','One More Then?'],['walletDamage','Wallet Damage'],['vibeCheck','Vibe Check'],['peopleWatching','People Watching'],['holidayFeeling','Holiday Feeling'],['looRating','Loo Rating'],['pintTest','Pint Test'],['cocktailTest','Cocktail Test'],['wineTest','Wine Test'],['tomorrowRisk','Tomorrow Morning Risk'],['worthTheWalk','Worth the Walk?']]
  };
  const allRatingDimensions = [...new Map(Object.values(ratingSets).flat().map(([key,label])=>[key,label]))];
  const ratingEmoji = {foodTest:'🍽️',properGlass:'🍷',oneMoreThen:'🍹',walletDamage:'💸',vibeCheck:'✨',peopleWatching:'👀',holidayFeeling:'☀️',looRating:'🚽',pintTest:'🍺',cocktailTest:'🍸',wineTest:'🍇',tomorrowRisk:'😵',worthTheWalk:'👟'};
  const reviewTypeLabel = value => ({food:'Food',drinks:'Drinks',both:'Food & drinks'}[value]||'Food');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const person = id => state.profiles.find(p => p.id === id) || state.profiles[0] || defaultProfiles[0];
  const sessionPlaceDetails = new Map(), pendingPlaceDetails = new Set(), failedPlaceDetails = new Set();
  const placeFor = id => {const place=state.places.find(p=>p.id===id);return place?{...place,...(place.googlePlaceId?sessionPlaceDetails.get(place.googlePlaceId):null)}:undefined;};
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); return true; } catch { alert('Your phone browser is out of storage. Try deleting an old photo from the diary and save again.'); return false; } };
  function dayKey(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
  const average = (placeId, dimension='overall') => {
    const values = state.reviews.filter(r => r.placeId === placeId && Number(r[dimension]) > 0).map(r => Number(r[dimension]));
    return values.length ? values.reduce((a,b)=>a+b,0)/values.length : 0;
  };
  const score = id => average(id) ? average(id).toFixed(1) : '—';
  const rankedPlaces = () => [...state.places].sort((a,b) => average(b.id)-average(a.id)).map(p=>placeFor(p.id));
  function stamp(text, small='OFFICIAL FAMILY RECORD') { return `<div class="stamp"><span>${esc(text || 'HOLIDAY PASSPORT')}</span><small>${esc(small)}</small></div>`; }
  const syncNote = `<aside class="notice"><strong>Saved on this device.</strong> This version keeps your diary and ratings in this browser. For everyone to see the same entries on different phones, we still need to connect the shared family account.<div class="policy-links"><a href="./privacy.html">Privacy</a><a href="./terms.html">Terms</a></div></aside>`;
  function setTab(tab) { state.tab = tab; selectedPlace = null; save(); render(); }
  function render() {
    hydrateSavedGooglePlaces();
    select.innerHTML = state.profiles.map(p => `<option value="${esc(p.id)}" ${p.id===state.profileId?'selected':''}>${esc(p.emoji)} ${esc(p.name)}</option>`).join('');
    document.querySelectorAll('.bottom-nav [data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab===state.tab));
    if (selectedPlace) return renderPlace(selectedPlace);
    if (state.tab==='places') return renderPlaces();
    if (state.tab==='diary') return renderDiary();
    if (state.tab==='competition') return renderCompetition();
    if (state.tab==='awards') return renderAwards();
    if (state.tab==='family') return renderFamily();
    renderHome();
  }
  function googleConfig() { return window.HOLIDAY_PASSPORT_CONFIG || {}; }
  async function loadGoogleMaps() {
    const key=googleConfig().googleMapsApiKey;
    if(!key)throw new Error('Google Maps key is not configured.');
    if(window.google?.maps?.importLibrary)return window.google.maps;
    if(!googleMapsLoading)googleMapsLoading=new Promise((resolve,reject)=>{
      const callback=`holidayMapsLoaded${Date.now()}`;
      const timer=setTimeout(()=>{delete window[callback];reject(new Error('Google Maps did not finish loading.'));},12000);
      window[callback]=()=>{clearTimeout(timer);delete window[callback];resolve(window.google.maps);};
      const script=document.createElement('script');
      script.src=`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async&callback=${callback}`;
      script.async=true;script.onerror=()=>{delete window[callback];reject(new Error('Google Maps could not load.'));};
      document.head.appendChild(script);
    });
    return googleMapsLoading;
  }
  async function hydrateSavedGooglePlaces() {
    const missing=state.places.filter(place=>place.googlePlaceId&&!sessionPlaceDetails.has(place.googlePlaceId)&&!pendingPlaceDetails.has(place.googlePlaceId)&&!failedPlaceDetails.has(place.googlePlaceId));
    if(!missing.length||!googleConfig().googleMapsApiKey)return;
    missing.forEach(place=>pendingPlaceDetails.add(place.googlePlaceId));
    try {
      const maps=await loadGoogleMaps(),{Place}=await maps.importLibrary('places');
      await Promise.all(missing.map(async saved=>{
        try {
          const place=new Place({id:saved.googlePlaceId});
          await place.fetchFields({fields:['displayName','formattedAddress','location','googleMapsURI']});
          const location=place.location;
          sessionPlaceDetails.set(saved.googlePlaceId,{name:place.displayName||'Saved Google Maps place',address:place.formattedAddress||'',googleMapsUri:place.googleMapsURI||'',lat:location?.lat?.(),lon:location?.lng?.()});
        } catch { failedPlaceDetails.add(saved.googlePlaceId); }
        finally { pendingPlaceDetails.delete(saved.googlePlaceId); }
      }));
      if(missing.some(place=>sessionPlaceDetails.has(place.googlePlaceId)))render();
    } catch { missing.forEach(place=>{pendingPlaceDetails.delete(place.googlePlaceId);failedPlaceDetails.add(place.googlePlaceId);}); }
  }
  function placeCards(list) {
    if (!list.length) return `<article class="card empty"><div class="empty-mark">⌖</div><strong>No evidence filed yet.</strong><p>Add the first place before the good ones get away with it.</p></article>`;
    return list.map((p,i) => `<button class="card place-card" data-open-place="${esc(p.id)}">${p.photoUri?`<img class="place-thumb" src="${p.photoUri}" alt="">`:`<span class="place-thumb place-thumb-empty">${p.type==='Bar'?'🍹':'🍔'}</span>`}<span class="rank">${String(i+1).padStart(2,'0')}</span><span class="place-copy"><strong>${esc(p.name||(p.googlePlaceId?'Google Maps place':'Unnamed place'))}</strong><small>${esc(p.address||p.googleType||p.type)}</small></span><span class="score">${average(p.id)?`★ ${esc(score(p.id))}`:'Rate me →'}</span></button>`).join('');
  }
  function renderHome() {
    const dated = state.trip.startDate || state.trip.endDate ? `${state.trip.startDate || '—'}  →  ${state.trip.endDate || '—'}` : 'Dates still under negotiation';
    const reviews = state.reviews.length, entries = state.entries.length;
    app.innerHTML = `<div class="content">
      <div class="page-kicker"><span>FAMILY HOLIDAY FIELD GUIDE · OFFICIAL-ISH</span><span>OPINIONS MAY CHANGE AFTER DESSERT</span></div>
      <section class="passport-cover"><div class="cover-seal">ATC<br><b>✦</b></div><div class="cover-copy"><div class="eyebrow">EAT. DRINK. RATE. REPEAT.</div><h1>${esc(state.trip.name)}</h1><p>${esc(state.trip.destination)} <span>·</span> ${esc(dated)}</p><div class="cover-bottom"><span>${esc(person(state.profileId).emoji)} Pen currently held by: <b>${esc(person(state.profileId).name)}</b></span><button class="text-button" data-action="edit-trip">${tripEditorOpen?'Close trip details':'Edit trip details'}</button></div></div></section>
      <div class="snack-stickers" aria-hidden="true"><span>🍺</span><span>🍔</span><span>🍟</span><span>🍹</span><span>🍦</span></div>
      ${tripEditorOpen ? `<form id="trip-form" class="card form"><div class="form-heading"><span class="eyebrow">TRIP DETAILS</span><span class="muted">The admin department is you.</span></div><label class="field">Trip name<input name="name" maxlength="70" value="${esc(state.trip.name)}" placeholder="e.g. The annual family expedition"></label><label class="field">Destination<input name="destination" maxlength="100" value="${esc(state.trip.destination)}" placeholder="Town, island or airport lounge"></label><div class="two-col"><label class="field">From<input name="startDate" type="date" value="${esc(state.trip.startDate)}"></label><label class="field">To<input name="endDate" type="date" value="${esc(state.trip.endDate)}"></label></div><button class="button" type="submit">Save trip details</button></form>` : ''}
      <div class="stat-strip"><div><strong>${state.places.length}</strong><span>places logged</span></div><div><strong>${reviews}</strong><span>verdicts filed</span></div><div><strong>${entries}</strong><span>memories saved</span></div></div>
      <div class="quick-actions"><button data-goto="places"><span>＋</span><b>Find food or a drink</b><small>Record the bill before everyone forgets who ordered it.</small></button><button data-goto="diary"><span>▤</span><b>Save the evidence</b><small>Photos, quotes and the family’s highly reliable version.</small></button></div>
      <div class="section-head"><div><div class="eyebrow">THE FAMILY HAS TAKEN NOTES</div><h2>Places we’ve put on trial</h2></div><button class="text-button" data-goto="places">All places →</button></div>
      ${placeCards(rankedPlaces().slice(0,3))}
      <aside class="quip"><span>“</span><p>${homeQuip()}</p><small>FAMILY POLICY: opinions are final until dessert arrives.</small></aside>
      ${syncNote}</div>`;
  }
  function homeQuip() {
    const lines = [
      'Our family motto: “We should have booked somewhere else,” spoken with a full mouth.',
      'We travel for the culture. The chips are a protected cultural asset.',
      'The bill is shared. The blame has been carefully assigned.',
      '“Just one quick drink” has now been entered into evidence.'
    ];
    return lines[Math.floor(Date.now()/86400000)%lines.length];
  }
  function renderPlaces() {
    const list = rankedPlaces();
    app.innerHTML = `<div class="content"><div class="eyebrow">THE HOLIDAY SNACK HUNT · ${state.places.length} PLACES</div><div class="snack-stickers page-stickers" aria-hidden="true"><span>🍺</span><span>🍔</span><span>🍟</span><span>🍹</span><span>🍦</span></div><h1>Where are we eating, drinking or making questionable choices?</h1><p class="lede">Type a place name. Pick the nearest one. Pretend the bill was a surprise.</p>
      <section class="card map-finder fun-finder"><div class="finder-top"><div><div class="eyebrow">📍 SEARCH NEARBY</div><h2>Find a place in Fuengirola</h2></div></div><form id="place-finder" class="place-finder-form"><label class="field place-lookup-label">Bar, restaurant or place<input id="nearby-query" name="query" autocomplete="off" placeholder="Try McDonald’s, food or a bar…" required minlength="2"></label><button class="button place-search-button" type="submit">Search</button></form><p class="hint" id="location-status">Search by name and choose the right place from the results.</p><div id="nearby-suggestions" class="suggestions" role="listbox" aria-label="Places in Fuengirola"></div><div class="google-attribution"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">Map data © OpenStreetMap contributors</a></div><p class="finder-joke">Find it, file it, blame whoever picked it.</p></section>
      <input class="search" id="place-search" placeholder="Search places already logged…" aria-label="Search saved places"><div id="place-list">${placeCards(list)}</div>
      <div class="section-head"><div><div class="eyebrow">FOUND SOMEWHERE WORTH A LOOK?</div><h2>Add it to the evidence</h2></div></div>
      <form id="add-place" class="card form"><label class="field">Name of place<input id="new-place-name" name="name" required maxlength="80" placeholder="The place with suspiciously good chips"></label><label class="field">Town or address<input id="new-place-address" name="address" required maxlength="180" placeholder="Fuengirola, Spain"></label><label class="field">Add a photo <span class="optional-label">(optional)</span><input name="placePhoto" type="file" accept="image/*"><small class="hint">Add a menu, meal, sign or family evidence. Stored on this phone.</small></label><div class="row"><label class="field grow">What are we reviewing?<select name="type"><option>Restaurant</option><option>Bar</option><option>Cafe</option><option>Beach</option><option>Market</option><option>Attraction</option><option>Other</option></select></label><button class="button" type="submit">Add to our holiday list</button></div></form>
      ${syncNote}</div>`;
  }
  const starRow = (dimension,label) => dimension==='overall' ? `<div class="rating-line overall-rating-line"><div class="rating-title"><span>${esc(label)}</span><strong class="rating-value">${formScores[dimension]?`${formScores[dimension]}/5`:'Tap a face'}</strong></div><div class="rating emoji-rating" data-rating-group="${esc(dimension)}" role="group" aria-label="Rate ${esc(label)}">${['🙁','🙂','😄','🤩','🤯'].map((face,i)=>{const n=i+1;return `<button type="button" class="${formScores[dimension]===n?'on':''}" data-rating="${dimension}" data-score="${n}" aria-label="${n} out of 5">${face}</button>`;}).join('')}</div><small class="face-scale"><span>Not for us</span><span>Best ever!</span></small></div>` : `<div class="rating-line category-rating-line"><div class="rating-title"><span>${esc(label)}</span><strong class="rating-value">${formScores[dimension]?`${formScores[dimension]}/5`:'—/5'}</strong></div><div class="rating category-rating" data-rating-group="${esc(dimension)}" role="group" aria-label="Rate ${esc(label)}">${[1,2,3,4,5].map(n=>`<button type="button" class="${(formScores[dimension]||0)>=n?'on':''}" data-rating="${dimension}" data-score="${n}" aria-label="${n} out of 5">${n}★</button>`).join('')}</div></div>`;
  const verdictFor = r => r.overall>=5?'Ridiculously good. Put it on the rota and warn the wallet.':r.overall>=4?'Would go back. It has survived the family group chat.':r.overall>=3?'Entirely acceptable. Nobody cried, which is above average.':r.overall>=2?'We’ve held a family meeting. Several people have lost ordering privileges.':'A costly lesson in letting someone choose because they said “trust me”.';
  function renderPlace(id) {
    const place = placeFor(id); if (!place) { selectedPlace=null; return renderPlaces(); }
    const reviews = state.reviews.filter(r=>r.placeId===id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
    const mapUrl = place.googleMapsUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name} ${place.address}`)}`;
    const groupedReviews=state.profiles.map(profile=>({profile,reviews:reviews.filter(r=>r.profileId===profile.id)})).filter(group=>group.reviews.length);
    const personScore=list=>list.reduce((sum,r)=>sum+Number(r.overall||0),0)/list.length;
    const familyRatingRows=allRatingDimensions.map(([key,label])=>{const values=reviews.map(r=>Number(r[key])).filter(value=>value>0),avg=values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;return `<article class="family-rating-tile ${avg?'has-score':'not-rated'}"><span class="family-rating-emoji">${ratingEmoji[key]||'⭐'}</span><span class="family-rating-name">${esc(label)}</span><strong>${avg?`${avg.toFixed(1)}<small>/5</small>`:'—'}</strong><small class="family-rating-count">${values.length?`${values.length} ${values.length===1?'rating':'ratings'}`:'Not rated yet'}</small></article>`;}).join('');
    app.innerHTML = `<div class="content"><button class="soft-button" data-back>← Back to places</button><section class="place-heading">${place.photoUri?`<img class="place-hero-photo" src="${place.photoUri}" alt="${esc(place.name)}">`:''}<div class="eyebrow">${esc(place.type.toUpperCase())} · FAMILY INVESTIGATION</div><h1>${esc(place.name)}</h1><p class="lede">${esc(place.address)} <a class="text-button" href="${esc(mapUrl)}" target="_blank" rel="noreferrer">Show us the map ↗</a></p><div class="rating-summary">${average(id)?`⭐ ${esc(score(id))} overall family score`:'⭐ Waiting for the family to judge'} <span>·</span> ${reviews.length} ${reviews.length===1?'rating':'ratings'}</div></section>
      ${place.photoUri?`<button class="photo-change-link" data-action="change-place-photo">Change place photo</button><input id="change-place-photo" type="file" accept="image/*" hidden>`:`<form id="place-photo-form" class="card photo-add-form"><label class="field">Give this place a face <span class="optional-label">(optional)</span><input name="placePhoto" type="file" accept="image/*"><small class="hint">Pick a photo of the place or what you ordered.</small></label><button class="soft-button" type="submit">Add place photo 📸</button></form>`}
      <div class="section-head"><div><div class="eyebrow">YOUR TURN</div><h2>Rate this place</h2></div></div>
      <form id="add-review" class="card form"><p class="form-intro">Be honest. We’ve already forgotten the waiter’s name.</p><label class="field">What are we judging?<select id="review-type" name="reviewType"><option value="food" ${reviewType==='food'?'selected':''}>🍴 Food</option><option value="drinks" ${reviewType==='drinks'?'selected':''}>🍹 Drinks</option><option value="both" ${reviewType==='both'?'selected':''}>🍽️🍷 Both (the full investigation)</option></select></label>${starRow('overall','How was it?')}
      <details class="rating-details"><summary>Add more ratings (optional)</summary><div class="rating-breakdown" id="rating-breakdown">${ratingSets[reviewType].map(([key,label])=>starRow(key,label)).join('')}</div><p class="hint">One star = “absolutely not”; five = “book it again before Dad finds the bill”.</p></details>
      <label class="field">Would you go back?<select name="returnVerdict"><option value="yes">Yes. Put it on the rota.</option><option value="maybe">Maybe. Ask the person paying.</option><option value="no">No. We have suffered enough.</option></select></label>
      <label class="field">Add a comment (optional) <textarea name="comment" maxlength="1000" placeholder="Was it lovely? Who ate the chips? Be honest."></textarea></label>
      <button class="button" type="submit">Save my rating ⭐</button></form>
      <div class="section-head"><div><div class="eyebrow">EVERYONE’S VERY IMPORTANT OPINION</div><h2>Family scorecard</h2></div></div>
      ${reviews.length?`<section class="family-scoreboard"><div class="overall-score-bubble"><span>🍟</span><div><small>FAMILY AVERAGE</small><strong>${esc(score(id))}<em>/5</em></strong><small>${reviews.length} ${reviews.length===1?'overall rating':'overall ratings'}</small></div><span>⭐</span></div><section class="family-averages"><div class="family-averages-heading"><div><h3>Everyone’s scores</h3><p>Average for each rating, across the family.</p></div><span>📊</span></div><div class="family-rating-grid">${familyRatingRows}</div></section><div class="section-head member-scores-heading"><div><div class="eyebrow">WHO GAVE WHICH SCORE?</div><h2>Ratings by person</h2></div></div>${groupedReviews.map(({profile,reviews:list})=>{const memberScore=personScore(list);return `<article class="person-rating-card"><div class="person-rating-head"><span class="person-avatar">${esc(profile.emoji)}</span><div class="person-rating-name"><strong>${esc(profile.name)}</strong><small>${list.length} ${list.length===1?'rating':'ratings'}</small></div><div class="person-overall"><strong>⭐ ${memberScore.toFixed(1)}</strong><small>their average</small></div></div>${list.map(r=>{const scores=(ratingSets[r.reviewType]||ratingSets.both).filter(([key])=>Number(r[key])>0).map(([key,label])=>`${label} ${r[key]}/5`);return `<div class="person-review"><div class="person-review-top"><span class="review-type-pill">${esc(reviewTypeLabel(r.reviewType))}</span><strong>${esc(Number(r.overall).toFixed(1))} / 5 ⭐</strong></div><p class="verdict-quip">${esc(verdictFor(r))}</p>${r.comment?`<p class="person-comment">“${esc(r.comment)}”</p>`:''}${scores.length?`<div class="rating-chips">${scores.map(s=>`<span>${esc(s)}</span>`).join('')}</div>`:''}<small class="review-meta">${esc(new Date(r.createdAt).toLocaleDateString())}</small></div>`;}).join('')}</article>`;}).join('')}</section>`:`<article class="card empty"><strong>No verdicts filed.</strong><p>Add ratings to see the family averages for this place.</p></article>`}
      <button class="delete-place" data-delete-place="${esc(id)}">Remove this place from the passport</button></div>`;
  }
  const entriesForDay = () => state.entries.filter(e=>e.day===diaryDay).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  function renderDiary() {
    const days=[...new Set([dayKey(),...state.entries.map(e=>e.day)])].sort().reverse(), entries=entriesForDay();
    const voteCount=id=>state.votes.filter(v=>v.entryId===id).length;
    const winners=kind=>{const items=entries.filter(e=>e.kind===kind),max=Math.max(0,...items.map(e=>voteCount(e.id)));return max?items.filter(e=>voteCount(e.id)===max).map(e=>e.id):[];};
    const pw=winners('photo'), qw=winners('quote');
    app.innerHTML=`<div class="content"><div class="eyebrow">THE HOLIDAY EVIDENCE LOCKER</div><h1>Things we’ll deny saying later</h1><p class="lede">Photos, quotes and the family’s completely unbiased account of “just one drink”.</p>
      <div class="days">${days.map(d=>`<button class="day ${d===diaryDay?'selected':''}" data-day="${esc(d)}">${d===dayKey()?'Today':esc(d)}</button>`).join('')}</div>
      <div class="section-head"><div><div class="eyebrow">ADD TO THE RECORD</div><h2>Today's evidence</h2></div></div>
      <div class="tabs"><button class="tab-button ${diaryKind==='photo'?'selected':''}" data-kind="photo">📷 Photo</button><button class="tab-button ${diaryKind==='quote'?'selected':''}" data-kind="quote">“” Quote</button></div>
      <form id="add-entry" class="card form"><label class="field">Date<input name="day" type="date" max="${dayKey()}" value="${esc(diaryDay)}" required></label>${diaryKind==='photo'?'<label class="field">Choose a photo<input name="photo" type="file" accept="image/*" required><small class="hint">Saved in this browser. Try not to upload 400 photos of the same plate of chips.</small></label>':''}<label class="field">${diaryKind==='quote'?'What was actually said?':'Caption the evidence'}<textarea name="text" maxlength="1000" placeholder="${diaryKind==='quote'?'“I thought you said this was included.”':'Who, where, and why does everyone look sunburnt?'}"></textarea></label>${diaryKind==='quote'?'<label class="field">Who said it? <input name="quoteAuthor" maxlength="60" placeholder="Arthur, after seeing the bill" required></label>':''}<button class="button" type="submit">Add it to the evidence 🕵️</button></form>
      <section class="vote-zone"><div class="section-head"><div><div class="eyebrow">PICK YOUR WINNER</div><h2>Today’s family vote</h2></div><span class="vote-day-pill">${diaryDay===dayKey()?'TODAY':esc(diaryDay)}</span></div><p class="vote-instructions">Switch the name at the top to vote as someone else. One vote each for a photo and a quote.</p>
      ${entries.length?['photo','quote'].map(kind=>{const candidates=entries.filter(e=>e.kind===kind),winnersForKind=kind==='photo'?pw:qw;return candidates.length?`<section class="vote-category ${kind==='quote'?'quote-vote':'photo-vote'}"><h3><span>${kind==='photo'?'📸':'💬'}</span>${kind==='photo'?'Best holiday photo':'Quote of the day'}</h3><p class="vote-category-hint">${kind==='photo'?'Whose photo deserves the fridge?':'Who delivered the line of the holiday?'}</p><div class="vote-candidates">${candidates.map(entry=>{const author=person(entry.profileId),voters=state.votes.filter(v=>v.entryId===entry.id),chosen=voters.some(v=>v.profileId===state.profileId),winning=winnersForKind.includes(entry.id);return `<article class="vote-card ${chosen?'is-voted':''} ${winning?'is-winning':''}">${entry.photoUri?`<img class="vote-image" src="${entry.photoUri}" alt="${esc(entry.text||'Holiday photo')}">`:''}<div class="vote-card-body"><div class="vote-card-meta"><span class="author-badge">${esc(author.emoji)} ${esc(author.name)}</span>${winning?'<span class="leader">🏆 In the lead</span>':''}</div>${entry.text?`<p class="${kind==='quote'?'quote':''}">${esc(entry.text)}</p>`:''}${kind==='quote'&&entry.quoteAuthor?`<p class="quote-author">— ${esc(entry.quoteAuthor)} said this (allegedly)</p>`:''}<div class="vote-card-bottom"><div class="voter-stack" aria-label="${voters.length} votes">${voters.map(v=>`<span title="${esc(person(v.profileId).name)}">${esc(person(v.profileId).emoji)}</span>`).join('')||'<small>No votes yet</small>'}</div><button class="vote ${chosen?'selected':''}" data-vote="${esc(entry.id)}">${chosen?'✓ Your vote':'👆 I vote for this'} <span>${voteCount(entry.id)}</span></button>${entry.profileId===state.profileId?`<button class="delete" data-delete="${esc(entry.id)}" aria-label="Delete your entry">🗑️</button>`:''}</div></div></article>`;}).join('')}</div></section>`:'';}).join(''):`<article class="card empty"><strong>No evidence for ${diaryDay===dayKey()?'today':esc(diaryDay)} yet.</strong><p>Add a photo or quote above, then the family can vote.</p></article>`}</section>
      ${syncNote}</div>`;
  }
  function competitionQuestionField(index) {
    return `<article class="competition-question-builder"><div class="competition-question-number">📸 Question ${index+1}</div><label class="field">Photo<input name="question-photo-${index}" type="file" accept="image/*" required><small class="hint">Choose a clear picture for this question.</small></label><label class="field">Question or clue <span class="optional-label">(optional)</span><input name="question-prompt-${index}" maxlength="180" placeholder="What is this? Where was it taken?"></label><label class="field">Correct answer<input name="question-answer-${index}" maxlength="120" placeholder="Add accepted answers separated by |" required><small class="hint">Example: Malaga | Málaga</small></label></article>`;
  }
  const normaliseQuizAnswer = answer => String(answer||'').toLocaleLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/[^\p{L}\p{N}]/gu,'');
  function competitionPoints(competition, submission) {
    return competition.questions.reduce((points,question)=>{
      const answer=normaliseQuizAnswer(submission.answers?.[question.id]);
      const accepted=String(question.answer||'').split('|').map(normaliseQuizAnswer).filter(Boolean);
      return points+(answer&&accepted.includes(answer)?1:0);
    },0);
  }
  function renderCompetition() {
    const competition=state.competitions.find(item=>item.id===selectedCompetitionId);
    if(competition){
      const submissions=competition.submissions||[],revealed=competition.status==='revealed',live=competition.status==='live';
      const answerStatuses=competition.entrants.map(entrant=>({entrant,submission:submissions.find(item=>item.entrantId===entrant.id)}));
      const leaderboard=answerStatuses.filter(row=>row.submission).sort((a,b)=>competitionPoints(competition,b.submission)-competitionPoints(competition,a.submission)||a.entrant.name.localeCompare(b.entrant.name));
      app.innerHTML=`<div class="content competition-page"><button class="soft-button" data-competition-back>← All competitions</button><div class="competition-hero"><div class="eyebrow">🏆 FAMILY PHOTO CHALLENGE</div><h1>${esc(competition.name)}</h1><p>${competition.mode==='teams'?'Teams':'Solo players'} · ${competition.questions.length} photo questions · ${competition.entrants.length} ${competition.mode==='teams'?'teams':'players'}</p><div class="competition-stickers" aria-hidden="true">⭐ 😊 📸 🎉</div></div>
      ${competition.status==='setup'?`<section class="competition-status setup"><strong>🧰 Ready to play?</strong><span>Check the photo questions, then start the quiz.</span></section><div class="competition-question-preview">${competition.questions.map((question,index)=>`<article class="competition-photo-card"><img src="${question.photoUri}" alt="Photo for question ${index+1}"><div><span class="question-chip">QUESTION ${index+1}</span><strong>${esc(question.prompt||'What is in this photo?')}</strong></div></article>`).join('')}</div><button class="button competition-main-button" data-start-competition="${esc(competition.id)}">Start the quiz 🚀</button>`:''}
      ${live?`<section class="competition-status live"><strong>🎉 Quiz is on!</strong><span>${submissions.length} of ${competition.entrants.length} ${competition.mode==='teams'?'teams':'players'} have sent their answers. Pass this phone around so each entrant can submit.</span></section><form id="submit-competition-answers" class="card form competition-answer-form"><label class="field">Who’s submitting?<select name="entrantId" required>${competition.entrants.map(entrant=>`<option value="${esc(entrant.id)}">${esc(entrant.name)}${submissions.some(item=>item.entrantId===entrant.id)?' · update answers':''}</option>`).join('')}</select></label><p class="competition-tip">Look at each photo and enter one answer. You can change your answers until the host reveals them.</p>${competition.questions.map((question,index)=>`<article class="competition-answer-card"><div class="competition-answer-top"><span class="question-chip">QUESTION ${index+1}</span><span>⭐ 1 point</span></div><img src="${question.photoUri}" alt="Photo question ${index+1}"><h3>${esc(question.prompt||`What is in photo ${index+1}?`)}</h3><label class="field">Your answer<input name="answer-${esc(question.id)}" maxlength="120" placeholder="Type your answer…" required></label></article>`).join('')}<button class="button competition-main-button" type="submit">Submit answers 🎯</button></form><div class="competition-entry-status"><strong>Answer sheets</strong>${answerStatuses.map(({entrant,submission})=>`<div><span>${esc(entrant.name)}</span><b>${submission?'✅ Submitted':'⏳ Still thinking'}</b></div>`).join('')}</div>${submissions.length?`<button class="soft-button reveal-button" data-reveal-competition="${esc(competition.id)}">Reveal answers & scores 🏆</button>`:''}`:''}
      ${revealed?`<section class="competition-status revealed"><strong>🏁 Results are in!</strong><span>Here’s how everyone did.</span></section><div class="competition-leaderboard">${leaderboard.length?leaderboard.map((row,index)=>`<article class="leaderboard-row ${index===0?'champion':''}"><span class="leaderboard-medal">${['🥇','🥈','🥉'][index]||'⭐'}</span><span class="leaderboard-name"><strong>${esc(row.entrant.name)}</strong><small>${index===0&&leaderboard.length>1?'Quiz champion':`${competitionPoints(competition,row.submission)} correct`}</small></span><strong class="leaderboard-score">${competitionPoints(competition,row.submission)} / ${competition.questions.length}</strong></article>`).join(''):'<p>No answers were submitted this time.</p>'}</div><div class="competition-answer-key"><h2>The answers</h2>${competition.questions.map((question,index)=>`<article><img src="${question.photoUri}" alt="Question ${index+1}"><div><span class="question-chip">QUESTION ${index+1}</span><p>${esc(question.prompt||'What is in this photo?')}</p><strong>✅ ${esc(question.answer)}</strong></div></article>`).join('')}</div>`:''}
      ${syncNote}</div>`;
      return;
    }
    app.innerHTML=`<div class="content competition-page"><div class="eyebrow">🏆 FAMILY PHOTO CHALLENGE</div><div class="competition-hero"><div class="competition-stickers" aria-hidden="true">⭐ 😊 📸 🎉</div><h1>Quiz time!</h1><p>Start a photo quiz, choose teams or solo players, and let the family battle it out.</p></div><form id="create-competition" class="card form competition-create-form"><div class="competition-form-heading"><span>✨</span><div><strong>Set up a competition</strong><small>Photos, guesses and one extremely important trophy.</small></div></div><label class="field">Competition name<input name="name" maxlength="70" placeholder="e.g. Who knows Fuengirola best?" required></label><label class="field">How are we playing?<select name="mode"><option value="teams">👥 Teams</option><option value="solo">🧍 Everyone plays solo</option></select></label><label class="field">${'Team names or player names'}<textarea name="entrants" maxlength="400" placeholder="The Squibbs, Team Arthur, The Snack Attack" required></textarea><small class="hint">Enter one name per line or separate names with commas. Use team names for teams, or each person’s name for solo play.</small></label><div class="competition-questions-heading"><h2>Photo questions</h2><span>📸 ${competitionDraftQuestionCount} ready</span></div><div id="competition-question-builders">${Array.from({length:competitionDraftQuestionCount},(_,index)=>competitionQuestionField(index)).join('')}</div><button class="soft-button add-question-button" type="button" data-add-competition-question>＋ Add another photo question</button><small class="hint">Photos are resized and saved on this device. Add as many rounds as you like.</small><button class="button competition-main-button" type="submit">Create competition 🚀</button></form>
      ${state.competitions.length?`<div class="section-head"><div><div class="eyebrow">PAST & CURRENT GAMES</div><h2>Pick up where you left off</h2></div></div><div class="competition-history">${[...state.competitions].reverse().map(item=>`<button class="card competition-history-card" data-open-competition="${esc(item.id)}"><span class="history-cup">🏆</span><span><strong>${esc(item.name)}</strong><small>${item.entrants.length} ${item.mode==='teams'?'teams':'players'} · ${item.questions.length} photos</small></span><span class="history-status ${esc(item.status)}">${item.status==='revealed'?'Results':item.status==='live'?'Playing':'Ready'}</span></button>`).join('')}</div>`:''}${syncNote}</div>`;
  }
  function renderAwards() {
    const scored=rankedPlaces().filter(p=>average(p.id));
    const awardRows=[['overall',"The place we'd actually return to",'A unanimous family decision is not required.'],['foodTest','The Food Test','Big plates. Bigger opinions.'],['walletDamage','Best survival of the wallet','The budget would like a word.'],['properGlass','Proper Glass?','We are not snobs. We are investigators.'],['vibeCheck','Best Vibe Check','Lighting can hide a lot.'],['holidayFeeling','Maximum Holiday Feeling','Holiday mode: activated-ish.'],['oneMoreThen','One More Then?','Famous last words, entered into evidence.'],['tomorrowRisk','Tomorrow Morning Risk','The judges reserve the right to amend scores.']];
    const award=(key,title,sub)=>{const eligible=scored.filter(p=>average(p.id,key));const winner=[...eligible].sort((a,b)=>average(b.id,key)-average(a.id,key))[0];return `<article class="award-card"><span class="award-seal">${key==='overall'?'★':'✦'}</span><div><small>${esc(title)}</small><strong>${winner?`${esc(winner.name)} · ${average(winner.id,key).toFixed(1)}/5`:'Awaiting nominations'}</strong><p>${winner?esc(winner.address):'The panel has not been bribed with snacks yet.'} <span>· ${esc(sub)}</span></p></div></article>`;};
    const biggestSplurge=rankedPlaces().sort((a,b)=>state.reviews.filter(r=>r.placeId===b.id).length-state.reviews.filter(r=>r.placeId===a.id).length)[0];
    app.innerHTML=`<div class="content"><div class="eyebrow">THE FAMILY’S VERY OFFICIAL-ISH AWARDS</div><h1>Who won the holiday?</h1><p class="lede">Awards based on the ratings you entered. The judges accept snacks and have obvious favourites.</p>
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
    return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=reject;reader.onload=()=>{const image=new Image();image.onerror=reject;image.onload=()=>{const scale=Math.min(1,1000/Math.max(image.width,image.height)),canvas=document.createElement('canvas');canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL('image/jpeg',.68));};image.src=reader.result;};reader.readAsDataURL(file);});
  }
  const locationStatus = message => { const node=document.querySelector('#location-status'); if(node)node.textContent=message; };
  function googleMapsLink(place) {
    const url = place.googleMapsUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name} ${place.address}`)}`;
    return esc(url);
  }
  function formatDistance(meters) {
    if(!Number.isFinite(meters))return '';
    return meters<1000?`${Math.round(meters)} m away`:`${(meters/1000).toFixed(1)} km away`;
  }
  function showSuggestions(results, message='') {
    const node=document.querySelector('#nearby-suggestions');if(!node)return;
    placeSearchResults=results;
    node.innerHTML=results.length?results.map((place,index)=>{
      const name=place.name||'Place';
      const area=place.display_name||'Fuengirola, Spain';
      return `<button class="place-suggestion" type="button" role="option" aria-selected="false" data-place-choice="${index}"><span class="suggestion-icon">📍</span><span class="suggestion-copy"><strong>${esc(name)}</strong><small>${esc(area)}</small></span><span class="suggestion-arrow">Choose ›</span></button>`;
    }).join(''):(message?`<p class="suggestion-message">${esc(message)}</p>`:'');
  }
  async function searchPlaces(query) {
    if(query.trim().length<2){showSuggestions([],'Type at least two letters to search.');return;}
    const startAt=Math.max(Date.now(),lastPlaceSearchAt+1100);
    lastPlaceSearchAt=startAt;
    if(startAt>Date.now())await new Promise(resolve=>setTimeout(resolve,startAt-Date.now()));
    showSuggestions([],'Looking around Fuengirola…');
    try {
      const params=new URLSearchParams({format:'jsonv2',q:`${query.trim()}, Fuengirola, Spain`,countrycodes:'es',limit:'6',addressdetails:'1',namedetails:'1',viewbox:'-4.80,36.65,-4.46,36.43',bounded:'1','accept-language':'en'});
      const response=await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`,{headers:{'Accept':'application/json'}});
      if(!response.ok)throw new Error(response.status===429?'Search is taking a breather. Wait a few seconds and try again.':'Could not reach place search. Check your connection and try again.');
      const data=await response.json();
      const results=data.map(item=>({...item,name:item.name||item.namedetails?.name||item.display_name?.split(',')[0]||'Place'}));
      showSuggestions(results,results.length?'':'No matches found around Fuengirola. Try another name.');
    } catch(error) {
      showSuggestions([],error.message||'Google could not find that just now. Try again in a moment.');
    }
  }
  function choosePlace(index) {
    const place=placeSearchResults[index];if(!place)return;
    const name=place.name||'Place',address=place.display_name||'Fuengirola, Spain';
    const form=document.querySelector('#add-place');
    selectedSearchPlace={name,address,lat:Number(place.lat),lon:Number(place.lon),osmPlaceId:String(place.place_id||'')};
    document.querySelector('#new-place-name').value=name;
    document.querySelector('#new-place-address').value=address;
    const kind=`${place.class||place.category||''} ${place.type||''}`.toLowerCase();
    const typeSelect=form?.querySelector('[name="type"]');
    if(typeSelect)typeSelect.value=kind.includes('bar')||kind.includes('pub')?'Bar':kind.includes('cafe')?'Cafe':kind.includes('restaurant')||kind.includes('fast_food')?'Restaurant':'Other';
    showSuggestions([]);
    const query=document.querySelector('#nearby-query');if(query)query.value='';
    locationStatus(`${name} selected. Add it to the list and start the family review.`);
    form?.scrollIntoView({behavior:'smooth',block:'center'});
    document.querySelector('#new-place-name')?.focus({preventScroll:true});
  }
  document.addEventListener('click',async event=>{
    const button=event.target.closest('button,[data-open-place]');if(!button)return;
    if(button.dataset.tab)setTab(button.dataset.tab);
    else if(button.dataset.goto)setTab(button.dataset.goto);
    else if(button.hasAttribute('data-competition-back')){selectedCompetitionId=null;renderCompetition();}
    else if(button.dataset.openCompetition){selectedCompetitionId=button.dataset.openCompetition;renderCompetition();}
    else if(button.dataset.startCompetition){const competition=state.competitions.find(item=>item.id===button.dataset.startCompetition);if(competition){competition.status='live';selectedCompetitionId=competition.id;save();renderCompetition();}}
    else if(button.dataset.revealCompetition){const competition=state.competitions.find(item=>item.id===button.dataset.revealCompetition);if(competition){if((competition.submissions||[]).length<competition.entrants.length)return alert('Wait until every team or player has submitted their answers.');competition.status='revealed';save();renderCompetition();}}
    else if(button.hasAttribute('data-add-competition-question')){const holder=document.querySelector('#competition-question-builders');if(holder){holder.insertAdjacentHTML('beforeend',competitionQuestionField(competitionDraftQuestionCount));competitionDraftQuestionCount++;const count=document.querySelector('.competition-questions-heading span');if(count)count.textContent=`📸 ${competitionDraftQuestionCount} ready`;}}
    else if(button.dataset.openPlace){selectedPlace=button.dataset.openPlace;formScores={};render();}
    else if(button.hasAttribute('data-back')){selectedPlace=null;state.tab='places';render();}
    else if(button.dataset.rating){formScores[button.dataset.rating]=Number(button.dataset.score);const form=document.querySelector('#add-review');if(form){const holder=form.querySelector(`[data-rating-group="${button.dataset.rating}"]`);if(holder){const selected=formScores[button.dataset.rating];holder.querySelectorAll('button').forEach(face=>face.classList.toggle('on',button.dataset.rating==='overall'?Number(face.dataset.score)===selected:Number(face.dataset.score)<=selected));const value=holder.closest('.rating-line')?.querySelector('.rating-value');if(value)value.textContent=`${selected}/5`;const scale=form.querySelector('.face-scale');if(scale&&button.dataset.rating==='overall')scale.classList.add('rated');}}}
    else if(button.hasAttribute('data-place-choice'))choosePlace(Number(button.dataset.placeChoice));
    else if(button.dataset.kind){diaryKind=button.dataset.kind;renderDiary();}
    else if(button.dataset.day){diaryDay=button.dataset.day;renderDiary();}
    else if(button.dataset.action==='edit-trip'){tripEditorOpen=!tripEditorOpen;renderHome();}
    else if(button.dataset.action==='change-place-photo'){document.querySelector('#change-place-photo')?.click();}
    else if(button.dataset.action==='export'){const blob=new Blob([JSON.stringify(state)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='arthurs-holiday-passport-backup.json';a.click();URL.revokeObjectURL(url);}
    else if(button.dataset.vote){const entry=state.entries.find(e=>e.id===button.dataset.vote);if(!entry)return;const old=state.votes.find(v=>v.tripId===state.trip.id&&v.day===entry.day&&v.kind===entry.kind&&v.profileId===state.profileId);state.votes=state.votes.filter(v=>!(v.tripId===state.trip.id&&v.day===entry.day&&v.kind===entry.kind&&v.profileId===state.profileId));if(old?.entryId!==entry.id)state.votes.push({tripId:state.trip.id,day:entry.day,kind:entry.kind,profileId:state.profileId,entryId:entry.id});save();renderDiary();}
    else if(button.dataset.delete){if(!confirm('Remove this entry and its votes?'))return;state.entries=state.entries.filter(e=>e.id!==button.dataset.delete);state.votes=state.votes.filter(v=>v.entryId!==button.dataset.delete);save();renderDiary();}
    else if(button.dataset.deletePlace){if(!confirm('Remove this place and its reviews from the passport?'))return;state.places=state.places.filter(p=>p.id!==button.dataset.deletePlace);state.reviews=state.reviews.filter(r=>r.placeId!==button.dataset.deletePlace);selectedPlace=null;save();renderPlaces();}
    else if(button.dataset.profile){state.profileId=button.dataset.profile;save();render();}
  });
  document.addEventListener('input',event=>{if(event.target.id==='place-search'){const q=event.target.value.trim().toLowerCase(),list=rankedPlaces().filter(p=>`${p.name} ${p.address} ${p.type}`.toLowerCase().includes(q)),node=document.querySelector('#place-list');if(node)node.innerHTML=placeCards(list);}});
  document.addEventListener('change',async event=>{if(event.target.id==='change-place-photo'){const file=event.target.files?.[0],place=state.places.find(p=>p.id===selectedPlace);if(file&&place){try{place.photoUri=await compressPhoto(file);if(save())renderPlace(selectedPlace);}catch{alert('That photo could not be opened. Please choose another.');}}return;}if(event.target.id==='review-type'){reviewType=event.target.value;const box=document.querySelector('#rating-breakdown');if(box)box.innerHTML=ratingSets[reviewType].map(([key,label])=>starRow(key,label)).join('');}});
  document.addEventListener('change',async event=>{if(event.target.id==='import-backup'){const file=event.target.files?.[0];if(!file)return;try{const incoming=JSON.parse(await file.text());if(!Array.isArray(incoming.places)||!Array.isArray(incoming.reviews)||!Array.isArray(incoming.entries)||!Array.isArray(incoming.votes))throw new Error('invalid');state={...freshState(),...incoming,trip:{...defaultTrip,...incoming.trip}};save();alert('Backup restored on this device.');render();}catch{alert('That backup file could not be read.');}}});
  document.addEventListener('submit',async event=>{
    event.preventDefault();const form=event.target;
    if(form.id==='place-finder'){const d=new FormData(form);searchPlaces(String(d.get('query')||''));}
    else if(form.id==='create-competition'){
      const d=new FormData(form),name=String(d.get('name')||'').trim(),mode=String(d.get('mode'));
      const entrantNames=String(d.get('entrants')||'').split(/[\n,;]+/).map(value=>value.trim()).filter(Boolean).filter((value,index,all)=>all.findIndex(other=>other.toLocaleLowerCase()===value.toLocaleLowerCase())===index);
      if(entrantNames.length<2)return alert('Add at least two teams or players so there’s someone to beat.');
      const questions=[];
      for(let index=0;index<competitionDraftQuestionCount;index++){
        const file=d.get(`question-photo-${index}`),answer=String(d.get(`question-answer-${index}`)||'').trim(),prompt=String(d.get(`question-prompt-${index}`)||'').trim();
        if(!(file instanceof File)||!file.size||!answer)return alert(`Add a photo and answer for question ${index+1}.`);
        try{questions.push({id:`question-${Date.now()}-${index}`,photoUri:await compressPhoto(file),prompt,answer});}catch{return alert(`The photo for question ${index+1} could not be opened. Choose another.`);}
      }
      const competition={id:`competition-${Date.now()}`,name,mode:mode==='solo'?'solo':'teams',entrants:entrantNames.map((entrantName,index)=>({id:`entrant-${Date.now()}-${index}`,name:entrantName})),questions,submissions:[],status:'setup',createdAt:new Date().toISOString()};
      state.competitions.push(competition);selectedCompetitionId=competition.id;competitionDraftQuestionCount=4;if(save())renderCompetition();
    }
    else if(form.id==='submit-competition-answers'){
      const competition=state.competitions.find(item=>item.id===selectedCompetitionId);if(!competition||competition.status!=='live')return;
      const d=new FormData(form),entrantId=String(d.get('entrantId')),entrant=competition.entrants.find(item=>item.id===entrantId);if(!entrant)return alert('Choose your team or player name first.');
      const answers={};for(const question of competition.questions){const answer=String(d.get(`answer-${question.id}`)||'').trim();if(!answer)return alert('Answer every photo question before submitting.');answers[question.id]=answer;}
      const submission={entrantId,answers,submittedAt:new Date().toISOString()},existing=competition.submissions.findIndex(item=>item.entrantId===entrantId);if(existing>=0)competition.submissions[existing]=submission;else competition.submissions.push(submission);
      if(save())renderCompetition();
    }
    else if(form.id==='trip-form'){const d=new FormData(form);state.trip.name=String(d.get('name')).trim()||defaultTrip.name;state.trip.destination=String(d.get('destination')).trim()||defaultTrip.destination;state.trip.startDate=String(d.get('startDate'));state.trip.endDate=String(d.get('endDate'));if(state.trip.startDate&&state.trip.endDate&&state.trip.endDate<state.trip.startDate)return alert('The return date needs to be after the start date.');tripEditorOpen=false;save();renderHome();}
    else if(form.id==='add-place'){const d=new FormData(form),photo=d.get('placePhoto'),place={id:`place-${Date.now()}`,type:String(d.get('type')),name:String(d.get('name')).trim(),address:String(d.get('address')).trim()};if(photo instanceof File&&photo.size){try{place.photoUri=await compressPhoto(photo);}catch{return alert('That photo could not be opened. Please choose another.');}}if(selectedSearchPlace){place.lat=selectedSearchPlace.lat;place.lon=selectedSearchPlace.lon;place.osmPlaceId=selectedSearchPlace.osmPlaceId;}state.places.unshift(place);if(save()){selectedSearchPlace=null;renderPlaces();}}
    else if(form.id==='place-photo-form'){const d=new FormData(form),photo=d.get('placePhoto'),place=state.places.find(p=>p.id===selectedPlace);if(!(photo instanceof File)||!photo.size)return alert('Choose a photo first.');if(!place)return;try{place.photoUri=await compressPhoto(photo);}catch{return alert('That photo could not be opened. Please choose another.');}if(save())renderPlace(selectedPlace);}
    else if(form.id==='add-review'){if(!formScores.overall)return alert('Give the overall verdict a star rating first.');const d=new FormData(form),kind=String(d.get('reviewType'))||reviewType,review={id:`review-${Date.now()}`,placeId:selectedPlace,profileId:state.profileId,reviewType:kind,overall:formScores.overall,comment:String(d.get('comment')).trim(),returnVerdict:String(d.get('returnVerdict')),createdAt:new Date().toISOString()};for(const [key] of ratingSets[kind])review[key]=formScores[key]||0;state.reviews.unshift(review);if(save()){formScores={};reviewType='food';render();}}
    else if(form.id==='profile-form'){const d=new FormData(form);for(const p of state.profiles)p.name=String(d.get(`name-${p.id}`)).trim()||p.name;save();render();}
    else if(form.id==='add-profile'){if(state.profiles.length>=8)return alert('The review panel is full. Eight people is already a lot of opinions.');const d=new FormData(form),type=String(d.get('type')),name=String(d.get('name')).trim();if(!name)return;state.profiles.push({id:`${type}-${Date.now()}`,name,type,emoji:type==='kid'?'🍦':'🧳'});save();render();}
    else if(form.id==='add-entry'){const d=new FormData(form),text=String(d.get('text')).trim(),quoteAuthor=String(d.get('quoteAuthor')||'').trim(),day=String(d.get('day'));if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||day>dayKey())return alert('Choose today or an earlier holiday date.');let photoUri;const file=d.get('photo');if(diaryKind==='photo'){if(!(file instanceof File)||!file.size)return alert('Choose a photo first.');try{photoUri=await compressPhoto(file);}catch{return alert('That photo could not be opened. Please choose another.');}}if(diaryKind==='quote'&&!text)return alert('Add the quote first.');if(diaryKind==='quote'&&!quoteAuthor)return alert('Tell us who said it. The family lawyers insist.');diaryDay=day;state.entries.unshift({id:`entry-${Date.now()}`,tripId:state.trip.id,profileId:state.profileId,day,kind:diaryKind,text,quoteAuthor,photoUri,createdAt:new Date().toISOString()});if(save())renderDiary();}
  });
  select.addEventListener('change',()=>{state.profileId=select.value;save();render();});
  if('serviceWorker'in navigator&&/^https?:$/.test(location.protocol))navigator.serviceWorker.register('./sw.js').catch(()=>{});
  render();
})();
