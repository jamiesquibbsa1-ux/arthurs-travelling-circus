(() => {
  const config = window.HOLIDAY_PASSPORT_CONFIG || {};
  const library = window.supabase;
  const api = { configured: false, client: null, user: null, member: null, members: [] };
  const aliasFor = name => {
    const key = String(name || '').trim().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/\s+/g, '.').replace(/[^a-z0-9._-]/g, '').replace(/^[._-]+|[._-]+$/g, '');
    if (key.length < 2 || key.length > 32) throw new Error('Use a name between 2 and 32 letters or numbers.');
    return `${key}@players.arthurscircus.invalid`;
  };
  const check = (result) => { if (result.error) throw result.error; return result.data; };

  api.init = async () => {
    if (!library?.createClient || !config.supabaseUrl || !config.supabasePublishableKey) return false;
    api.client = library.createClient(config.supabaseUrl, config.supabasePublishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    api.configured = true;
    const { data } = await api.client.auth.getSession();
    if (data.session?.user) await api.acceptSession(data.session.user);
    api.client.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) { api.user = null; api.member = null; api.members = []; window.dispatchEvent(new CustomEvent('circus-auth-change')); }
    });
    return true;
  };
  api.acceptSession = async user => {
    api.user = user;
    const mine = await api.client.from('circus_members').select('user_id,family_id,username,display_name,role,emoji').eq('user_id', user.id).maybeSingle();
    if (mine.error || !mine.data) {
      await api.client.auth.signOut();
      throw mine.error || new Error('This login is not on the family account list. Ask the admin to add you.');
    }
    api.member = mine.data;
    const roster = await api.client.from('circus_members').select('user_id,family_id,username,display_name,role,emoji').eq('family_id', mine.data.family_id).order('created_at');
    api.members = check(roster) || [];
    window.dispatchEvent(new CustomEvent('circus-auth-change'));
    return mine.data;
  };
  api.signIn = async (name, password) => {
    const { data, error } = await api.client.auth.signInWithPassword({ email: aliasFor(name), password });
    if (error) throw error;
    await api.acceptSession(data.user);
    return data;
  };
  api.bootstrapAdmin = async values => {
    const result = await api.client.functions.invoke('circus-admin', { body: { action: 'bootstrap-admin', ...values } });
    if (result.error) throw result.error;
    if (result.data?.error) throw new Error(result.data.error);
    return result.data;
  };
  api.admin = async (action, body = {}) => {
    const result = await api.client.functions.invoke('circus-admin', { body: { action, ...body } });
    if (result.error) throw result.error;
    if (result.data?.error) throw new Error(result.data.error);
    return result.data;
  };
  api.signOut = () => api.client.auth.signOut();
  api.memberName = id => api.members.find(member => member.user_id === id)?.display_name || 'Family player';
  api.memberEmoji = id => api.members.find(member => member.user_id === id)?.emoji || '🙂';
  api.upload = async (file, area, ownerId) => {
    if (!file || !file.type?.startsWith('image/')) throw new Error('Choose an image first.');
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader(); reader.onerror = reject; reader.onload = () => {
        const image = new Image(); image.onerror = reject; image.onload = () => {
          const scale = Math.min(1, 1400 / Math.max(image.width, image.height));
          const canvas = document.createElement('canvas'); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
          canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height); resolve(canvas.toDataURL('image/jpeg', .76));
        }; image.src = reader.result;
      }; reader.readAsDataURL(file);
    });
    const blob = await (await fetch(dataUrl)).blob();
    const photoId = crypto.randomUUID();
    const folder = area === 'competitions'
      ? `${api.member.family_id}/competitions`
      : area === 'passport'
        ? `${api.member.family_id}/passport/${api.user.id}`
        : `${api.member.family_id}/posts/${api.user.id}`;
    const path = `${folder}/${ownerId || photoId}-${photoId}.jpg`;
    const { error } = await api.client.storage.from('circus-media').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    if (error) throw error;
    return path;
  };
  api.signedUrl = async path => {
    if (!path) return '';
    const { data, error } = await api.client.storage.from('circus-media').createSignedUrl(path, 3600);
    if (error) throw error;
    return data.signedUrl;
  };
  api.loadPassport = async () => {
    const { data, error } = await api.client.from('circus_passport_state').select('state,updated_at').eq('family_id', api.member.family_id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const state = data.state || {};
    state.places = await Promise.all((state.places || []).map(async place => ({ ...place, photoUri: place.photoPath ? await api.signedUrl(place.photoPath) : '' })));
    state.updatedAt = data.updated_at;
    return state;
  };
  api.passportStamp = async () => {
    const { data, error } = await api.client.from('circus_passport_state').select('updated_at').eq('family_id', api.member.family_id).maybeSingle();
    if (error) throw error;
    return data?.updated_at || null;
  };
  api.savePassport = async localState => {
    const safeState = {
      trip: structuredClone(localState.trip), profiles: structuredClone(localState.profiles),
      places: structuredClone(localState.places), reviews: structuredClone(localState.reviews),
      lastArea: String(localState.lastArea || ''), lastLocation: null,
    };
    for (const place of safeState.places) {
      if (!place.photoPath && place.photoUri?.startsWith('data:image/')) {
        const fileBlob = await (await fetch(place.photoUri)).blob();
        const file = new File([fileBlob], 'place-photo.jpg', { type: 'image/jpeg' });
        place.photoPath = await api.upload(file, 'passport', place.id);
        const original = localState.places.find(item => item.id === place.id);
        if (original) { original.photoPath = place.photoPath; original.photoUri = await api.signedUrl(place.photoPath); }
      }
      delete place.photoUri;
    }
    safeState.places = safeState.places.map(place => ({...place, photoUri:undefined}));
    const result = await api.client.from('circus_passport_state').upsert({
      family_id: api.member.family_id, state: safeState, updated_by: api.user.id, updated_at: new Date().toISOString(),
    }, { onConflict: 'family_id' }).select('updated_at').single();
    return check(result).updated_at;
  };
  api.loadPosts = async () => {
    const familyId = api.member.family_id;
    const [postData, commentData, reactionData] = await Promise.all([
      api.client.from('circus_posts').select('*').eq('family_id', familyId).order('day', { ascending: false }).order('created_at', { ascending: false }).limit(100),
      api.client.from('circus_comments').select('*').eq('family_id', familyId).order('created_at'),
      api.client.from('circus_reactions').select('*').eq('family_id', familyId),
    ]);
    const posts = check(postData) || [], comments = check(commentData) || [], reactions = check(reactionData) || [];
    return Promise.all(posts.map(async post => ({
      ...post, profileId: post.author_id, kind: post.kind, text: post.caption, quoteAuthor: post.quote_author,
      createdAt: post.created_at, photoUri: post.photo_path ? await api.signedUrl(post.photo_path) : '',
      author: api.memberName(post.author_id), authorEmoji: api.memberEmoji(post.author_id),
      comments: comments.filter(comment => comment.post_id === post.id).map(comment => ({ ...comment, author: api.memberName(comment.author_id), authorEmoji: api.memberEmoji(comment.author_id) })),
      reactions: reactions.filter(reaction => reaction.post_id === post.id),
    })));
  };
  api.addPost = async ({ kind, day, caption, quoteAuthor, file }) => {
    const id = crypto.randomUUID();
    const photoPath = kind === 'photo' ? await api.upload(file, 'posts', id) : null;
    return check(await api.client.from('circus_posts').insert({
      id, family_id: api.member.family_id, author_id: api.user.id, kind, day,
      caption: caption || '', quote_author: quoteAuthor || '', photo_path: photoPath,
    }));
  };
  api.importLegacyDiary = async entries => {
    if (!entries?.length) return 0;
    const existing = await api.client.from('circus_posts').select('id', { count: 'exact', head: true }).eq('family_id', api.member.family_id);
    if (existing.error) throw existing.error;
    if (existing.count) return 0;
    let imported = 0;
    for (const entry of entries) {
      let file = null;
      if (entry.kind === 'photo' && entry.photoUri?.startsWith('data:image/')) {
        const blob = await (await fetch(entry.photoUri)).blob();
        file = new File([blob], 'holiday-memory.jpg', { type: 'image/jpeg' });
      }
      if (entry.kind === 'photo' && !file) continue;
      await api.addPost({ kind: entry.kind === 'quote' ? 'quote' : 'photo', day: entry.day, caption: entry.text || '', quoteAuthor: entry.quoteAuthor || '', file });
      imported++;
    }
    return imported;
  };
  api.addComment = async (postId, body) => check(await api.client.from('circus_comments').insert({ family_id: api.member.family_id, post_id: postId, author_id: api.user.id, body }));
  api.removeComment = async commentId => check(await api.client.from('circus_comments').delete().eq('id', commentId).eq('author_id', api.user.id));
  api.toggleReaction = async (postId, reaction) => {
    const existing = await api.client.from('circus_reactions').select('id,reaction').eq('post_id', postId).eq('author_id', api.user.id).maybeSingle();
    check(existing);
    if (existing.data?.reaction === reaction) return check(await api.client.from('circus_reactions').delete().eq('id', existing.data.id));
    if (existing.data) return check(await api.client.from('circus_reactions').update({ reaction }).eq('id', existing.data.id));
    return check(await api.client.from('circus_reactions').insert({ family_id: api.member.family_id, post_id: postId, author_id: api.user.id, reaction }));
  };
  api.loadCompetitions = async () => {
    const { data: comps, error } = await api.client.from('circus_competitions').select('*').eq('family_id', api.member.family_id).order('created_at', { ascending: false });
    check({ data: comps, error });
    const competitions = await Promise.all((comps || []).map(async competition => {
      const [questionsResult, submissionsResult] = await Promise.all([
        api.client.from('circus_questions').select('*').eq('competition_id', competition.id).order('question_no'),
        api.client.from('circus_submissions').select('question_id,player_id,answer,updated_at').eq('competition_id', competition.id),
      ]);
      const questions = check(questionsResult) || [], submissions = check(submissionsResult) || [];
      const signedQuestions = await Promise.all(questions.map(async question => ({ ...question, photoUri: await api.signedUrl(question.photo_path) })));
      const result = { ...competition, questions: signedQuestions, submissions };
      if (competition.status === 'revealed') {
        result.results = await api.admin('competition-results', { competitionId: competition.id });
        result.results.questions = await Promise.all((result.results.questions || []).map(async question => ({ ...question, photoUri: await api.signedUrl(question.photo_path) })));
      }
      return result;
    }));
    return competitions;
  };
  api.createCompetition = async ({ title, questions }) => {
    const prepared = [];
    for (const question of questions) prepared.push({ prompt: question.prompt, answer: question.answer, photoPath: await api.upload(question.file, 'competitions') });
    return api.admin('create-competition', { title, questions: prepared });
  };
  api.submitAnswers = async (competitionId, questions, formData) => {
    const rows = questions.map(question => ({
      family_id: api.member.family_id, competition_id: competitionId, question_id: question.id, player_id: api.user.id,
      answer: String(formData.get(`answer-${question.id}`) || '').trim(),
    }));
    if (rows.some(row => !row.answer)) throw new Error('Answer every photo before you submit.');
    return check(await api.client.from('circus_submissions').upsert(rows, { onConflict: 'question_id,player_id' }));
  };
  window.CircusApi = api;
})();
