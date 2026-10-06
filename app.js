// Release 19: admins can moderate family diary posts, comments and reactions.
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
  let loginMode='signin', sharedDiary=[], sharedCompetitions=[], diaryLoading=false, quizLoading=false, sharedError='';
  let accountReady=false, accountSyncPromise=null, loadedUserId=null, remoteSyncTimer=null, remoteWriteInFlight=false, lastPassportUpdatedAt='';
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
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { alert('Your phone browser is out of storage. Try deleting an old photo from the diary and save again.'); return false; }
    if(accountReady&&window.CircusApi?.member){clearTimeout(remoteSyncTimer);remoteSyncTimer=setTimeout(async()=>{remoteWriteInFlight=true;try{lastPassportUpdatedAt=await window.CircusApi.savePassport(state);sharedError='';localStorage.setItem(KEY,JSON.stringify(state));}catch(error){sharedError=error.message||'The family account could not be updated. Check your connection and retry.';console.error('Family passport sync failed',error);}finally{remoteWriteInFlight=false;}},650);}
    return true;
  };
  function dayKey(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
  const average = (placeId, dimension='overall') => {
    const values = state.reviews.filter(r => r.placeId === placeId && Number(r[dimension]) > 0).map(r => Number(r[dimension]));
    return values.length ? values.reduce((a,b)=>a+b,0)/values.length : 0;
  };
  const score = id => average(id) ? average(id).toFixed(1) : '—';
  const rankedPlaces = () => [...state.places].sort((a,b) => average(b.id)-average(a.id)).map(p=>placeFor(p.id));
  function stamp(text, small='OFFICIAL FAMILY RECORD') { return `<div class="stamp"><span>${esc(text || 'HOLIDAY PASSPORT')}</span><small>${esc(small)}</small></div>`; }
  const syncNote = `<aside class="notice"><strong>Family passport connected.</strong> Places, ratings, photos, quotes, comments, reactions and quiz scores are shared across the family accounts.${sharedError?`<small class="auth-error">${esc(sharedError)}</small>`:''}<div class="policy-links"><a href="./privacy.html">Privacy</a><a href="./terms.html">Terms</a></div></aside>`;
  function goToTop() { window.scrollTo({ top: 0, left: 0, behavior: 'auto' }); }
  function setTab(tab) { goToTop(); state.tab = tab; selectedPlace = null; save(); render(); }
  function renderLogin() {
    const configured=window.CircusApi?.configured;
    document.body.classList.add('auth-required');
    document.querySelector('.bottom-nav').hidden=true;
    document.querySelector('.profile-switch').hidden=true;
    document.querySelector('#account-session').innerHTML='';
    const message=sharedError?`<p class="auth-error" role="alert">${esc(sharedError)}</p>`:'';
    app.innerHTML=`<div class="content auth-page"><div class="auth-stickers" aria-hidden="true">⭐ 🙂 📷 🎉</div><div class="eyebrow">ARTHUR’S TRAVELLING CIRCUS</div><h1>${loginMode==='setup'?'Set up the family admin':'Welcome back, holiday judge'}</h1><p class="lede">${loginMode==='setup'?'Create the first admin login. Keep your one-time setup code private.':'Sign in with the name and password the admin gave you.'}</p>${message}${!configured?'<aside class="notice"><strong>Connection still warming up.</strong> Refresh this page in a minute. If it still cannot connect, the website needs its Supabase setup files.</aside>':''}
      ${loginMode==='setup'?`<form id="bootstrap-admin-form" class="card form auth-form"><label class="field">One-time setup code<input name="setupCode" required autocomplete="off" minlength="24"></label><label class="field">Your name (this is your login name)<input name="username" required maxlength="60" autocomplete="username" placeholder="Jamie Squibb"></label><label class="field">Password<input name="password" type="password" required minlength="8" maxlength="72" autocomplete="new-password"></label><small class="hint">Passwords are handled by Supabase Auth and are never saved in the app as readable text.</small><button class="button" type="submit">Create my admin login 🔐</button><button class="soft-button" type="button" data-auth-mode="signin">Back to sign in</button></form>`:`<form id="sign-in-form" class="card form auth-form"><label class="field">Your name<input name="username" required maxlength="60" autocomplete="username" placeholder="Jamie Squibb"></label><label class="field">Password<input name="password" type="password" required maxlength="72" autocomplete="current-password"></label><button class="button" type="submit">Sign in 🎪</button></form><button class="soft-button auth-setup-link" type="button" data-auth-mode="setup">First time here? Set up the family admin</button>`}
      <p class="auth-footnote">Each family member signs in with their own name and password. The admin creates player logins.</p></div>`;
  }
  function renderAccountPending() {
    document.body.classList.add('auth-required');document.querySelector('.bottom-nav').hidden=true;document.querySelector('.profile-switch').hidden=true;
    const api=window.CircusApi;
    app.innerHTML=`<div class="content auth-page"><div class="auth-stickers">🔄</div><div class="eyebrow">CONNECTING THE FAMILY PASSPORT</div><h1>${sharedError?'We couldn’t load the shared passport':'Just a moment…'}</h1><p class="lede">${sharedError?esc(sharedError):'Opening the shared places, ratings and family diary.'}</p>${sharedError?`<div class="row"><button class="button" data-retry-account>Try again</button><button class="soft-button" data-sign-out>Log out</button></div>`:''}</div>`;
    if(api.member)document.querySelector('#account-session').innerHTML=`<span class="account-name">${esc(api.member.emoji)} ${esc(api.member.display_name)}</span><button class="account-logout" type="button" data-sign-out>Log out</button>`;
  }
  function applyRemotePassport(remote) {
    const tab=state.tab, entries=state.entries||[], votes=state.votes||[];
    state={...freshState(),...remote,trip:{...defaultTrip,...remote.trip},profileId:window.CircusApi.user.id,tab,entries,votes,competitions:[]};
    lastPassportUpdatedAt=remote.updatedAt||'';
    setRemoteIdentity();
  }
  async function connectAccount() {
    const api=window.CircusApi;
    if(!api?.member){accountReady=false;loadedUserId=null;accountSyncPromise=null;renderLogin();return;}
    if(loadedUserId===api.user.id&&accountReady){setRemoteIdentity();render();return;}
    if(accountSyncPromise){await accountSyncPromise;return;}
    sharedError='';accountReady=false;renderAccountPending();
    accountSyncPromise=(async()=>{
      const remote=await api.loadPassport();
      if(remote)applyRemotePassport(remote);
      else if(api.member.role==='admin'){await api.importLegacyDiary(state.entries||[]);lastPassportUpdatedAt=await api.savePassport(state);}
      else throw new Error('The family passport has not been started yet. Ask the admin to sign in first.');
      // Load shared activity immediately so the passport counts are correct on first view.
      const [posts, competitions]=await Promise.all([api.loadPosts(), api.loadCompetitions()]);
      sharedDiary=posts;sharedCompetitions=competitions;
      accountReady=true;loadedUserId=api.user.id;
    })();
    try{await accountSyncPromise;sharedError='';render();}
    catch(error){sharedError=error.message||'Could not load the family passport. Check your connection and try again.';renderAccountPending();}
    finally{accountSyncPromise=null;}
  }
  function setRemoteIdentity() {
    const api=window.CircusApi;
    if(!api?.member)return;
    const linked=api.members.map(member=>({id:member.user_id,name:member.display_name,type:member.role==='admin'?'adult':'kid',emoji:member.emoji||'🙂'}));
    const old=state.profiles.filter(profile=>!linked.some(member=>member.id===profile.id));
    state.profiles=[...linked,...old];state.profileId=api.user.id;
    document.body.classList.remove('auth-required');
    document.querySelector('.bottom-nav').hidden=false;
    document.querySelector('.profile-switch').hidden=true;
    document.querySelector('#account-session').innerHTML=`<span class="account-name">${esc(api.member.emoji)} ${esc(api.member.display_name)}</span><button class="account-logout" type="button" data-sign-out>Log out</button>`;
  }
  function render() {
    if(!window.CircusApi?.member){renderLogin();return;}
    if(!accountReady){renderAccountPending();return;}
    setRemoteIdentity();
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
    const reviews = state.reviews.length, entries = sharedDiary.length;
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
      <form id="add-place" class="card form"><label class="field">Name of place<input id="new-place-name" name="name" required maxlength="80" placeholder="The place with suspiciously good chips"></label><label class="field">Town or address<input id="new-place-address" name="address" required maxlength="180" placeholder="Fuengirola, Spain"></label><label class="field">Add a photo <span class="optional-label">(optional)</span><input name="placePhoto" type="file" accept="image/*"><small class="hint">Add a menu, meal, sign or family evidence. Shared with everyone.</small></label><div class="row"><label class="field grow">What are we reviewing?<select name="type"><option>Restaurant</option><option>Bar</option><option>Cafe</option><option>Beach</option><option>Market</option><option>Attraction</option><option>Other</option></select></label><button class="button" type="submit">Add to our holiday list</button></div></form>
      ${syncNote}</div>`;
  }
  const starRow = (dimension,label) => {
    const title=`<span class="rating-title-label"><span class="rating-title-icon" aria-hidden="true">${ratingEmoji[dimension]||'⭐'}</span>${esc(label)}</span>`;
    return dimension==='overall'
      ? `<div class="rating-line overall-rating-line"><div class="rating-title">${title}<strong class="rating-value">${formScores[dimension]?`${formScores[dimension]}/5`:'Tap a face'}</strong></div><div class="rating emoji-rating" data-rating-group="${esc(dimension)}" role="group" aria-label="Rate ${esc(label)}">${['🙁','🙂','😄','🤩','🤯'].map((face,i)=>{const n=i+1;return `<button type="button" class="${formScores[dimension]===n?'on':''}" data-rating="${dimension}" data-score="${n}" aria-label="${n} out of 5">${face}</button>`;}).join('')}</div><small class="face-scale"><span>Not for us</span><span>Best ever!</span></small></div>`
      : `<div class="rating-line category-rating-line"><div class="rating-title">${title}<strong class="rating-value">${formScores[dimension]?`${formScores[dimension]}/5`:'—/5'}</strong></div><div class="rating category-rating" data-rating-group="${esc(dimension)}" role="group" aria-label="Rate ${esc(label)}">${[1,2,3,4,5].map(n=>`<button type="button" class="${(formScores[dimension]||0)>=n?'on':''}" data-rating="${dimension}" data-score="${n}" aria-label="${n} out of 5"><span class="optional-star" aria-hidden="true">★</span><small>${n}</small></button>`).join('')}</div></div>`;
  };
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
 function renderDiary(fetchFresh=true) {
    const admin=window.CircusApi.member.role==='admin';
    const entries=sharedDiary.filter(entry=>entry.day===diaryDay),days=[...new Set([dayKey(),...sharedDiary.map(entry=>entry.day)])].sort().reverse();
    if(fetchFresh&&!diaryLoading){diaryLoading=true;window.CircusApi.loadPosts().then(posts=>{sharedDiary=posts;sharedError='';}).catch(error=>{sharedError=error.message||'Could not load the shared diary.';}).finally(()=>{diaryLoading=false;if(state.tab==='diary')renderDiary(false);});}
    const reactionMeta={like:['👍','Like'],laugh:['😂','Laugh'],love:['❤️','Love'],hate:['😡','Hate']};
    app.innerHTML=`<div class="content"><div class="eyebrow">THE FAMILY HOLIDAY EVIDENCE LOCKER</div><h1>Things we’ll deny saying later</h1><p class="lede">Everyone sees the same photos and quotes. Add your reaction, leave a comment, and let the record speak for itself.</p>
      <div class="days">${days.map(d=>`<button class="day ${d===diaryDay?'selected':''}" data-day="${esc(d)}">${d===dayKey()?'Today':esc(d)}</button>`).join('')}</div>
      <div class="section-head"><div><div class="eyebrow">ADD TO THE RECORD</div><h2>Today's evidence</h2></div></div>
      <div class="tabs"><button class="tab-button ${diaryKind==='photo'?'selected':''}" data-kind="photo">📷 Photo</button><button class="tab-button ${diaryKind==='quote'?'selected':''}" data-kind="quote">💬 Quote</button></div>
      <form id="add-entry" class="card form"><label class="field">Date<input name="day" type="date" max="${dayKey()}" value="${esc(diaryDay)}" required></label>${diaryKind==='photo'?'<label class="field">Choose a photo<input name="photo" type="file" accept="image/*" required><small class="hint">Photos are resized and shared with the family.</small></label>':''}<label class="field">${diaryKind==='quote'?'What was actually said?':'Caption the evidence'}<textarea name="text" maxlength="1000" placeholder="${diaryKind==='quote'?'“I thought you said this was included.”':'Who, where, and why does everyone look sunburnt?'}"></textarea></label>${diaryKind==='quote'?'<label class="field">Who said it? <input name="quoteAuthor" maxlength="60" placeholder="Arthur, after seeing the bill" required></label>':''}<button class="button" type="submit">Add it to the family diary 📸</button></form>
      <section class="shared-posts"><div class="section-head"><div><div class="eyebrow">${diaryDay===dayKey()?'TODAY’S':'SELECTED DAY ·'} FAMILY FEED</div><h2>Photos & quotes</h2></div><button class="soft-button" data-refresh-diary>↻ Refresh</button></div>${sharedError?`<p class="auth-error">${esc(sharedError)}</p>`:''}${!entries.length?`<article class="card empty"><strong>${diaryLoading?'Checking the family album…':'No evidence filed for this day yet.'}</strong><p>Add the first photo or quote and everyone can react.</p></article>`:entries.map(entry=>{const myReaction=entry.reactions.find(item=>item.author_id===window.CircusApi.user.id)?.reaction;return `<article class="shared-post card" id="post-${esc(entry.id)}">${entry.kind==='photo'?`<img class="shared-post-photo" src="${esc(entry.photoUri)}" alt="${esc(entry.text||'Family holiday photo')}">`:''}<div class="shared-post-head"><span class="post-author">${esc(entry.authorEmoji)} ${esc(entry.author)}</span><div class="post-admin-tools"><time>${esc(entry.day)}</time>${admin?`<button class="admin-moderation-button" type="button" data-admin-moderate="delete-diary-post" data-post-id="${esc(entry.id)}">Remove post</button>`:''} </div></div>${entry.text?`<p class="shared-post-caption ${entry.kind==='quote'?'quote':''}">${esc(entry.text)}</p>`:''}${entry.kind==='quote'&&entry.quoteAuthor?`<p class="quote-author">— ${esc(entry.quoteAuthor)} said it (allegedly)</p>`:''}<div class="post-reactions">${Object.entries(reactionMeta).map(([kind,[emoji,label]])=>{const count=entry.reactions.filter(reaction=>reaction.reaction===kind).length;return `<button class="reaction-button ${myReaction===kind?'selected':''}" type="button" data-react-post="${esc(entry.id)}" data-reaction="${kind}" aria-pressed="${myReaction===kind}"><span>${emoji}</span><small>${label}</small><b>${count}</b></button>`;}).join('')}</div>${admin&&entry.reactions.length?`<button class="admin-moderation-button clear-reactions" type="button" data-admin-moderate="clear-diary-reactions" data-post-id="${esc(entry.id)}">Clear reactions</button>`:''}<div class="post-comments"><strong>Comments <span>${entry.comments.length}</span></strong>${entry.comments.map(comment=>`<div class="post-comment"><div class="post-comment-head"><span>${esc(comment.authorEmoji)} <b>${esc(comment.author)}</b></span>${admin?`<button class="admin-moderation-button comment-delete" type="button" data-admin-moderate="delete-diary-comment" data-comment-id="${esc(comment.id)}" aria-label="Delete comment by ${esc(comment.author)}">Delete</button>`:''} </div><p>${esc(comment.body)}</p></div>`).join('')}<form class="comment-form" data-comment-post="${esc(entry.id)}"><input name="body" maxlength="700" required placeholder="Add a comment…"><button type="submit" aria-label="Post comment">Send ↗</button></form></div></article>`;}).join('')}</section>${syncNote}</div>`;
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
  function renderCompetition(fetchFresh=true) {
    if(fetchFresh&&!quizLoading){quizLoading=true;window.CircusApi.loadCompetitions().then(items=>{sharedCompetitions=items;sharedError='';}).catch(error=>{sharedError=error.message||'Could not load the family quizzes.';}).finally(()=>{quizLoading=false;if(state.tab==='competition')renderCompetition(false);});}
    const api=window.CircusApi,admin=api.member.role==='admin',competition=sharedCompetitions.find(item=>item.id===selectedCompetitionId);
    if(!competition){
      app.innerHTML=`<div class="content competition-page"><div class="eyebrow">🏆 SOLO PHOTO CHALLENGE</div><div class="competition-hero"><div class="competition-stickers" aria-hidden="true">⭐ 😊 📸 🎉</div><h1>Quiz time!</h1><p>Everyone plays under their own name. Each photo has a secret answer, and the family leaderboard appears when the admin reveals the results.</p></div>${sharedError?`<p class="auth-error">${esc(sharedError)}</p>`:''}
      ${admin?`<form id="create-competition" class="card form competition-create-form"><div class="competition-form-heading"><span>✨</span><div><strong>Admin: set up a quiz</strong><small>Once you publish it, every player will see it.</small></div></div><label class="field">Quiz name<input name="title" maxlength="90" placeholder="e.g. What did we spot in Fuengirola?" required></label><div class="competition-questions-heading"><h2>Photo questions</h2><span>📸 ${competitionDraftQuestionCount}</span></div><div id="competition-question-builders">${Array.from({length:competitionDraftQuestionCount},(_,index)=>competitionQuestionField(index)).join('')}</div><button class="soft-button add-question-button" type="button" data-add-competition-question>＋ Add another photo question</button><small class="hint">Questions and answers are kept in the family account. Players can’t see the answers until you reveal them.</small><button class="button competition-main-button" type="submit">Publish quiz to everyone 🚀</button></form>`:''}
      <div class="section-head"><div><div class="eyebrow">SHARED FAMILY QUIZZES</div><h2>Pick a challenge</h2></div><button class="soft-button" data-refresh-quiz>↻ Refresh</button></div>${quizLoading?'<p class="hint">Checking for quizzes…</p>':''}${sharedCompetitions.length?`<div class="competition-history">${sharedCompetitions.map(item=>`<button class="card competition-history-card" data-open-competition="${esc(item.id)}"><span class="history-cup">${item.status==='revealed'?'🏆':'📸'}</span><span><strong>${esc(item.title)}</strong><small>${item.questions.length} photos · ${item.questions.length} points</small></span><span class="history-status ${item.status}">${item.status==='revealed'?'Results':'Play now'}</span></button>`).join('')}</div>`:`<article class="card empty"><strong>${admin?'No quiz yet. Add photos above to get it started.':'The admin has not published a quiz yet.'}</strong><p>When a quiz is published, it appears here for every player.</p></article>`}${syncNote}</div>`;
      return;
    }
    const submissions=competition.submissions||[],mine=submissions.filter(item=>item.player_id===api.user.id),myAnswers=new Map(mine.map(item=>[item.question_id,item.answer]));
    const results=competition.results?.results||[],resultsQuestions=competition.results?.questions||[];
    app.innerHTML=`<div class="content competition-page"><button class="soft-button" data-competition-back>← All quizzes</button><div class="competition-hero"><div class="eyebrow">🏆 SOLO FAMILY PHOTO QUIZ</div><h1>${esc(competition.title)}</h1><p>${competition.questions.length} photos · ${competition.questions.length} points · playing as ${esc(api.member.display_name)}</p><div class="competition-stickers" aria-hidden="true">⭐ 😊 📸 🎉</div></div>
      ${competition.status==='open'?`<section class="competition-status live"><strong>🎉 Your turn!</strong><span>Submit your own answer for every photo. You can edit your sheet until the admin reveals the results.</span></section><form id="submit-competition-answers" class="card form competition-answer-form"><p class="competition-tip">Look closely. The answer could be hiding in plain sight—or in the family WhatsApp photos.</p>${competition.questions.map((question,index)=>`<article class="competition-answer-card"><div class="competition-answer-top"><span class="question-chip">QUESTION ${index+1}</span><span>⭐ 1 point</span></div><img src="${esc(question.photoUri)}" alt="Photo question ${index+1}"><h3>${esc(question.prompt||`What is in photo ${index+1}?`)}</h3><label class="field">Your answer<input name="answer-${esc(question.id)}" maxlength="180" value="${esc(myAnswers.get(question.id)||'')}" placeholder="Type your answer…" required></label></article>`).join('')}<button class="button competition-main-button" type="submit">${mine.length?'Update my answers':'Submit my answers'} 🎯</button></form>${admin?`<section class="competition-entry-status"><strong>Player progress</strong>${api.members.map(member=>{const done=submissions.filter(row=>row.player_id===member.user_id).length;return `<div><span>${esc(member.emoji)} ${esc(member.display_name)}</span><b>${done===competition.questions.length?'✅ Complete':`${done}/${competition.questions.length} answered`}</b></div>`;}).join('')}</section><button class="soft-button reveal-button" data-reveal-competition="${esc(competition.id)}">Reveal scores to everyone 🏆</button>`:''}`:''}
      ${competition.status==='revealed'?`<section class="competition-status revealed"><strong>🏁 Results are in!</strong><span>${results.length} players on the leaderboard. No family appeals will be heard.</span></section><div class="competition-leaderboard">${results.map((row,index)=>`<article class="leaderboard-row ${index===0?'champion':''}"><span class="leaderboard-medal">${['🥇','🥈','🥉'][index]||'⭐'}</span><span class="leaderboard-name"><strong>${esc(row.emoji)} ${esc(row.name)}</strong><small>${index===0?'Quiz champion':`${row.answered} answers sent`}</small></span><strong class="leaderboard-score">${row.correct} / ${competition.questions.length}</strong></article>`).join('')}</div><div class="competition-answer-key"><h2>The answers</h2>${resultsQuestions.map((question,index)=>`<article><img src="${esc(question.photoUri)}" alt="Question ${index+1}"><div><span class="question-chip">QUESTION ${index+1}</span><p>${esc(question.prompt||'What is in this photo?')}</p><strong>✅ ${esc(question.answer)}</strong></div></article>`).join('')}</div>`:''}
      ${syncNote}</div>`;
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
    const api=window.CircusApi,admin=api.member.role==='admin';
    const memberCards=api.members.map(member=>`<article class="card family-account-card"><span>${esc(member.emoji)}</span><strong>${esc(member.display_name)}</strong><small>${member.role==='admin'?'Admin':'Player'}${member.user_id===api.user.id?' · you':''}</small>${admin&&member.role==='player'?`<button class="make-admin-button" type="button" data-promote-member="${esc(member.username)}" data-promote-name="${esc(member.display_name)}">🛡️ Make admin</button>`:''}${admin&&member.user_id!==api.user.id?`<button class="delete-account-button" type="button" data-delete-member="${esc(member.username)}" data-delete-name="${esc(member.display_name)}">🗑️ Delete account</button>`:''}</article>`).join('');
    app.innerHTML=`<div class="content"><div class="eyebrow">FAMILY ACCOUNTS</div><h1>Who’s on the trip?</h1><p class="lede">Every person signs in as themselves, adds their own ratings and plays the quiz solo. Admins can publish quizzes, reveal answers and manage family accounts.</p><div class="family-account-list">${memberCards}</div>
      ${admin?`<div class="section-head"><div><div class="eyebrow">ADMIN ONLY</div><h2>Give someone a login</h2></div></div><form id="create-player-form" class="card form"><label class="field">Name they’ll use to sign in<input name="name" maxlength="60" required placeholder="Arthur Squibb" autocomplete="off"></label><label class="field">Password you’re assigning<input name="password" type="password" minlength="8" maxlength="72" required autocomplete="new-password"></label><fieldset class="account-role-picker"><legend>Choose their access</legend><label class="role-choice"><input type="radio" name="role" value="player" checked><span><strong>🙂 Player</strong><small>Rate places and play the quiz</small></span></label><label class="role-choice admin-role-choice"><input type="radio" name="role" value="admin"><span><strong>🛡️ Admin</strong><small>Create accounts, set up quizzes and reveal results</small></span></label></fieldset><small class="hint">They sign in with the name and password above. Minimum 8 characters. You can reset their password later.</small><button class="button" type="submit">Create account ✨</button></form>${api.members.some(member=>member.role==='player')?`<div class="section-head"><div><div class="eyebrow">PASSWORD HELP</div><h2>Reset a player password</h2></div></div><form id="reset-player-form" class="card form"><label class="field">Player<select name="username">${api.members.filter(member=>member.role==='player').map(member=>`<option value="${esc(member.username)}">${esc(member.display_name)}</option>`).join('')}</select></label><label class="field">New password<input name="password" type="password" minlength="8" maxlength="72" required autocomplete="new-password"></label><button class="soft-button" type="submit">Reset password</button></form>`:''}`:`<aside class="notice"><strong>Need another login?</strong> Ask the family admin to add the person’s name and give them a password.</aside>`}
      <details class="backup-details"><summary>Download or restore a passport backup</summary><p class="muted">Your family account shares the trip, places, ratings, diary and quizzes across signed-in devices. A backup is a separate copy.</p><div class="row"><button class="soft-button" data-action="export">Download backup</button><label class="soft-button import-button">Restore backup<input id="import-backup" type="file" accept="application/json,.json" hidden></label></div></details>${syncNote}</div>`;
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
    if(button.dataset.authMode){loginMode=button.dataset.authMode;sharedError='';renderLogin();}
    else if(button.hasAttribute('data-retry-account')){sharedError='';connectAccount();}
    else if(button.hasAttribute('data-sign-out')){try{await window.CircusApi.signOut();}catch(error){alert(error.message||'Could not sign out.');}}
    else if(button.dataset.tab)setTab(button.dataset.tab);
    else if(button.dataset.goto)setTab(button.dataset.goto);
    else if(button.hasAttribute('data-competition-back')){goToTop();selectedCompetitionId=null;renderCompetition();}
    else if(button.dataset.openCompetition){goToTop();selectedCompetitionId=button.dataset.openCompetition;renderCompetition();}
    else if(button.dataset.promoteMember){if(!confirm(`Make ${button.dataset.promoteName||'this player'} an admin? Admins can create accounts, publish quizzes and reveal results.`))return;try{await window.CircusApi.admin('promote-player',{username:button.dataset.promoteMember});const roster=await window.CircusApi.client.from('circus_members').select('user_id,family_id,username,display_name,role,emoji').eq('family_id',window.CircusApi.member.family_id).order('created_at');if(roster.error)throw roster.error;window.CircusApi.members=roster.data||[];alert(`${button.dataset.promoteName||'Player'} is now an admin.`);renderFamily();}catch(error){alert(error.message||'Could not change that account to admin.');}}
    else if(button.dataset.deleteMember){const name=button.dataset.deleteName||'this person';if(!confirm(`Permanently delete ${name}’s account? They will lose access, and their diary posts, comments, reactions and quiz answers will be deleted. The shared passport and other people’s posts will stay.`))return;try{await window.CircusApi.admin('delete-member',{username:button.dataset.deleteMember});const roster=await window.CircusApi.client.from('circus_members').select('user_id,family_id,username,display_name,role,emoji').eq('family_id',window.CircusApi.member.family_id).order('created_at');if(roster.error)throw roster.error;window.CircusApi.members=roster.data||[];alert(`${name}’s account has been deleted.`);renderFamily();}catch(error){alert(error.message||'Could not delete that account.');}}
    else if(button.dataset.revealCompetition){try{await window.CircusApi.admin('reveal-competition',{competitionId:button.dataset.revealCompetition});sharedCompetitions=await window.CircusApi.loadCompetitions();renderCompetition(false);}catch(error){alert(error.message||'Could not reveal the quiz results.');}}
    else if(button.hasAttribute('data-add-competition-question')){if(competitionDraftQuestionCount>=60)return alert('A quiz can have up to 60 photo questions.');const holder=document.querySelector('#competition-question-builders');if(holder){holder.insertAdjacentHTML('beforeend',competitionQuestionField(competitionDraftQuestionCount));competitionDraftQuestionCount++;const count=document.querySelector('.competition-questions-heading span');if(count)count.textContent=`📸 ${competitionDraftQuestionCount}`;}}
    else if(button.hasAttribute('data-refresh-diary')){try{sharedDiary=await window.CircusApi.loadPosts();sharedError='';renderDiary(false);}catch(error){sharedError=error.message||'Could not refresh the family diary.';renderDiary(false);}}
    else if(button.hasAttribute('data-refresh-quiz')){try{sharedCompetitions=await window.CircusApi.loadCompetitions();sharedError='';renderCompetition(false);}catch(error){sharedError=error.message||'Could not refresh the family quizzes.';renderCompetition(false);}}
    else if(button.dataset.reactPost){try{await window.CircusApi.toggleReaction(button.dataset.reactPost,button.dataset.reaction);sharedDiary=await window.CircusApi.loadPosts();renderDiary(false);}catch(error){alert(error.message||'Could not save that reaction.');}}
    else if(button.dataset.openPlace){goToTop();selectedPlace=button.dataset.openPlace;formScores={};render();}
    else if(button.hasAttribute('data-back')){goToTop();selectedPlace=null;state.tab='places';render();}
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
    if(form.id==='sign-in-form'){
      const d=new FormData(form);try{sharedError='';await window.CircusApi.signIn(String(d.get('username')||''),String(d.get('password')||''));state.profileId=window.CircusApi.user.id;state.tab='home';await connectAccount();}catch(error){sharedError=error.message||'Could not sign in. Check the name and password.';renderLogin();}
    }
    else if(form.id==='bootstrap-admin-form'){
      const d=new FormData(form),values={setupCode:String(d.get('setupCode')||''),username:String(d.get('username')||''),displayName:String(d.get('username')||''),password:String(d.get('password')||'')};
      try{sharedError='';await window.CircusApi.bootstrapAdmin(values);await window.CircusApi.signIn(values.username,values.password);loginMode='signin';state.profileId=window.CircusApi.user.id;state.tab='home';await connectAccount();}catch(error){sharedError=error.message||'Could not set up the admin login.';renderLogin();}
    }
    else if(form.id==='create-player-form'){
      const d=new FormData(form),name=String(d.get('name')||'').trim(),password=String(d.get('password')||''),role=String(d.get('role')||'player');try{await window.CircusApi.admin('create-member',{username:name,displayName:name,password,role});const roster=await window.CircusApi.client.from('circus_members').select('user_id,family_id,username,display_name,role,emoji').eq('family_id',window.CircusApi.member.family_id);if(!roster.error)window.CircusApi.members=roster.data||window.CircusApi.members;alert(`${name} can now sign in as ${role==='admin'?'an admin':'a player'} with that name and password.`);renderFamily();}catch(error){alert(error.message||'Could not create the account.');}
    }
    else if(form.id==='reset-player-form'){
      const d=new FormData(form);try{const result=await window.CircusApi.admin('reset-player-password',{username:String(d.get('username')),password:String(d.get('password'))});alert(result.message||'Password reset.');renderFamily();}catch(error){alert(error.message||'Could not reset that password.');}
    }
    else if(form.id==='place-finder'){const d=new FormData(form);searchPlaces(String(d.get('query')||''));}
    else if(form.id==='create-competition'){
      const d=new FormData(form),title=String(d.get('title')||'').trim();
      const questions=[];
      for(let index=0;index<competitionDraftQuestionCount;index++){
        const file=d.get(`question-photo-${index}`),answer=String(d.get(`question-answer-${index}`)||'').trim(),prompt=String(d.get(`question-prompt-${index}`)||'').trim();
        if(!(file instanceof File)||!file.size||!answer)return alert(`Add a photo and answer for question ${index+1}.`);
        questions.push({file,prompt,answer});
      }
      try{const result=await window.CircusApi.createCompetition({title,questions});competitionDraftQuestionCount=4;sharedCompetitions=await window.CircusApi.loadCompetitions();selectedCompetitionId=result.competitionId;sharedError='';renderCompetition(false);}catch(error){alert(error.message||'Could not publish the family quiz.');}
    }
    else if(form.id==='submit-competition-answers'){
      const competition=sharedCompetitions.find(item=>item.id===selectedCompetitionId);if(!competition||competition.status!=='open')return;
      try{await window.CircusApi.submitAnswers(competition.id,competition.questions,new FormData(form));sharedCompetitions=await window.CircusApi.loadCompetitions();alert('Your answers are in. You can change them until the admin reveals the results.');renderCompetition(false);}catch(error){alert(error.message||'Could not save your answers.');}
    }
    else if(form.dataset.commentPost){const d=new FormData(form),body=String(d.get('body')||'').trim();if(!body)return;try{await window.CircusApi.addComment(form.dataset.commentPost,body);sharedDiary=await window.CircusApi.loadPosts();sharedError='';renderDiary(false);}catch(error){alert(error.message||'Could not add that comment.');}}
    else if(form.id==='trip-form'){const d=new FormData(form);state.trip.name=String(d.get('name')).trim()||defaultTrip.name;state.trip.destination=String(d.get('destination')).trim()||defaultTrip.destination;state.trip.startDate=String(d.get('startDate'));state.trip.endDate=String(d.get('endDate'));if(state.trip.startDate&&state.trip.endDate&&state.trip.endDate<state.trip.startDate)return alert('The return date needs to be after the start date.');tripEditorOpen=false;save();renderHome();}
    else if(form.id==='add-place'){const d=new FormData(form),photo=d.get('placePhoto'),place={id:`place-${Date.now()}`,type:String(d.get('type')),name:String(d.get('name')).trim(),address:String(d.get('address')).trim()};if(photo instanceof File&&photo.size){try{place.photoUri=await compressPhoto(photo);}catch{return alert('That photo could not be opened. Please choose another.');}}if(selectedSearchPlace){place.lat=selectedSearchPlace.lat;place.lon=selectedSearchPlace.lon;place.osmPlaceId=selectedSearchPlace.osmPlaceId;}state.places.unshift(place);if(save()){selectedSearchPlace=null;renderPlaces();}}
    else if(form.id==='place-photo-form'){const d=new FormData(form),photo=d.get('placePhoto'),place=state.places.find(p=>p.id===selectedPlace);if(!(photo instanceof File)||!photo.size)return alert('Choose a photo first.');if(!place)return;try{place.photoUri=await compressPhoto(photo);}catch{return alert('That photo could not be opened. Please choose another.');}if(save())renderPlace(selectedPlace);}
    else if(form.id==='add-review'){if(!formScores.overall)return alert('Give the overall verdict a star rating first.');const d=new FormData(form),kind=String(d.get('reviewType'))||reviewType,review={id:`review-${Date.now()}`,placeId:selectedPlace,profileId:state.profileId,reviewType:kind,overall:formScores.overall,comment:String(d.get('comment')).trim(),returnVerdict:String(d.get('returnVerdict')),createdAt:new Date().toISOString()};for(const [key] of ratingSets[kind])review[key]=formScores[key]||0;state.reviews.unshift(review);if(save()){formScores={};reviewType='food';render();}}
    else if(form.id==='profile-form'){const d=new FormData(form);for(const p of state.profiles)p.name=String(d.get(`name-${p.id}`)).trim()||p.name;save();render();}
    else if(form.id==='add-profile'){if(state.profiles.length>=8)return alert('The review panel is full. Eight people is already a lot of opinions.');const d=new FormData(form),type=String(d.get('type')),name=String(d.get('name')).trim();if(!name)return;state.profiles.push({id:`${type}-${Date.now()}`,name,type,emoji:type==='kid'?'🍦':'🧳'});save();render();}
    else if(form.id==='add-entry'){const d=new FormData(form),text=String(d.get('text')).trim(),quoteAuthor=String(d.get('quoteAuthor')||'').trim(),day=String(d.get('day')),file=d.get('photo');if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||day>dayKey())return alert('Choose today or an earlier holiday date.');if(diaryKind==='photo'&&(!(file instanceof File)||!file.size))return alert('Choose a photo first.');if(diaryKind==='quote'&&!text)return alert('Add the quote first.');if(diaryKind==='quote'&&!quoteAuthor)return alert('Tell us who said it. The family lawyers insist.');try{await window.CircusApi.addPost({kind:diaryKind,day,caption:text,quoteAuthor,file});diaryDay=day;sharedDiary=await window.CircusApi.loadPosts();sharedError='';renderDiary(false);}catch(error){alert(error.message||'Could not add that family memory.');}}
  });
  select.addEventListener('change',()=>{if(window.CircusApi?.user){state.profileId=window.CircusApi.user.id;render();}});
  window.addEventListener('circus-auth-change',()=>{sharedError='';if(window.CircusApi?.member)connectAccount();else{accountReady=false;loadedUserId=null;renderLogin();}});
  if('serviceWorker'in navigator&&/^https?:$/.test(location.protocol))navigator.serviceWorker.register('./sw.js').catch(()=>{});
  window.CircusApi.init().then(()=>{if(window.CircusApi.member)connectAccount();else render();}).catch(error=>{sharedError=error.message||'Could not connect to the family account. Try refreshing.';renderLogin();});
  setInterval(async()=>{
    if(!window.CircusApi?.member||!accountReady||document.hidden||document.activeElement?.closest('form')||remoteWriteInFlight)return;
    try{
      if(state.tab==='diary'){sharedDiary=await window.CircusApi.loadPosts();renderDiary(false);}
      else if(state.tab==='competition'){sharedCompetitions=await window.CircusApi.loadCompetitions();renderCompetition(false);}
      const stamp=await window.CircusApi.passportStamp();
      if(stamp&&stamp!==lastPassportUpdatedAt){const remote=await window.CircusApi.loadPassport();if(remote){applyRemotePassport(remote);render();}}
    }catch{}
  },15000);
})();
