// صفحة المريض: بدء المكالمة مع Agent ElevenLabs وتعريف الـ Client Tools
(() => {
  const $ = (id) => document.getElementById(id);
  const callBtn = $('callBtn'), endBtn = $('endBtn');
  const statusEl = $('status'), statusText = $('statusText'), transcript = $('transcript');
  let conversation = null;
  let clinic = null;

  const STATUS_LABELS = {
    idle: 'جاهز للاتصال', connecting: 'جاري الاتصال...', connected: 'متصل',
    speaking: 'سارة تتكلم...', listening: 'سارة تستمع إليك...', error: 'حدث خطأ',
  };

  function setStatus(state, text) {
    statusEl.className = `status ${state}`;
    statusText.textContent = text || STATUS_LABELS[state];
  }

  function addMessage(role, text) {
    const empty = transcript.querySelector('.empty');
    if (empty) empty.remove();
    const div = document.createElement('div');
    div.className = `msg ${role}`;
    if (role !== 'system') {
      const who = document.createElement('span');
      who.className = 'who';
      who.textContent = role === 'agent' ? 'سارة' : 'أنت';
      div.appendChild(who);
    }
    div.appendChild(document.createTextNode(text));
    transcript.appendChild(div);
    transcript.scrollTop = transcript.scrollHeight;
  }

  // يجلب معلومات العيادة وتاريخ اليوم بتوقيت غزة من السيرفر
  async function loadClinic() {
    const r = await fetch('/api/clinic');
    clinic = await r.json();
    $('clinicName').textContent = clinic.name;
    $('clinicDoctor').textContent = clinic.doctor;
    $('clinicHours').textContent = clinic.hoursText;
    $('clinicPrice').textContent = `${clinic.price} ${clinic.currency}`;
    $('clinicToday').textContent = clinic.today;
    document.title = clinic.name;
  }

  // يحوّل رد الـ API لنص JSON بسيط يفهمه الـ AI
  async function callApi(url, options) {
    try {
      const r = await fetch(url, options);
      const data = await r.json();
      return JSON.stringify(data);
    } catch (e) {
      return JSON.stringify({ ok: false, message: 'تعذّر الوصول لنظام المواعيد، اعتذر من المريض واطلب منه المحاولة لاحقًا' });
    }
  }

  const clientTools = {
    get_available_slots: async ({ date }) => {
      addMessage('system', `🔎 فحص المواعيد ليوم ${date}`);
      return callApi(`/api/slots?date=${encodeURIComponent(date || '')}`);
    },
    book_appointment: async ({ name, phone, date, time }) => {
      addMessage('system', `📝 محاولة حجز ${date} الساعة ${time}`);
      const result = await callApi('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, date, time }),
      });
      try { addMessage('system', JSON.parse(result).ok ? '✅ تم الحجز' : '⚠️ لم يتم الحجز'); } catch {}
      return result;
    },
  };

  async function startCall() {
    callBtn.disabled = true;
    setStatus('connecting');
    try {
      // نطلب إذن المايك أولًا حتى تظهر رسالة واضحة إذا رفضه المستخدم
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const r = await fetch('/api/signed-url');
      const data = await r.json();
      if (!data.ok) throw new Error(data.message);
      if (!clinic) await loadClinic();

      conversation = await ElevenLabsClient.Conversation.startSession({
        signedUrl: data.signedUrl,
        dynamicVariables: { today: clinic.today },
        clientTools,
        onConnect: () => { setStatus('connected'); endBtn.disabled = false; addMessage('system', 'بدأت المكالمة'); },
        onDisconnect: () => { conversation = null; resetUi(); addMessage('system', 'انتهت المكالمة'); },
        onMessage: ({ message, role, source }) => {
          const who = (role || source) === 'user' ? 'user' : 'agent';
          if (message) addMessage(who, message);
        },
        onModeChange: ({ mode }) => setStatus(mode === 'speaking' ? 'speaking' : 'listening'),
        onError: (msg) => { console.error(msg); setStatus('error', `خطأ: ${msg}`); },
      });
    } catch (e) {
      console.error(e);
      const msg = e && e.name === 'NotAllowedError' ? 'لازم تسمح باستخدام المايكروفون' : (e.message || 'تعذّر بدء المكالمة');
      setStatus('error', msg);
      callBtn.disabled = false;
      endBtn.disabled = true;
    }
  }

  function resetUi() {
    setStatus('idle');
    callBtn.disabled = false;
    endBtn.disabled = true;
  }

  async function endCall() {
    endBtn.disabled = true;
    if (conversation) await conversation.endSession();
    conversation = null;
    resetUi();
  }

  callBtn.addEventListener('click', startCall);
  endBtn.addEventListener('click', endCall);
  loadClinic().catch(() => {});
})();
