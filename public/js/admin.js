// لوحة السكرتيرة: عرض الحجوزات، فلترة، إلغاء، وتحديث تلقائي
(() => {
  const $ = (id) => document.getElementById(id);
  const rowsEl = $('rows'), dateFilter = $('dateFilter'), hideCancelled = $('hideCancelled');
  const DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  const cell = (text, cls) => {
    const td = document.createElement('td');
    if (cls) td.className = cls;
    td.textContent = text;
    return td;
  };

  async function load() {
    const q = dateFilter.value ? `?date=${dateFilter.value}` : '';
    // نفس بيانات Basic Auth تُرسل تلقائيًا من المتصفح
    const r = await fetch(`/api/appointments${q}`, { credentials: 'same-origin' });
    if (!r.ok) { rowsEl.innerHTML = '<tr><td colspan="8">تعذّر التحميل</td></tr>'; return; }
    const { appointments } = await r.json();
    const list = hideCancelled.checked ? appointments.filter((a) => a.status === 'booked') : appointments;

    rowsEl.innerHTML = '';
    if (!list.length) rowsEl.innerHTML = '<tr><td colspan="8">لا توجد حجوزات</td></tr>';
    for (const a of list) {
      const tr = document.createElement('tr');
      if (a.status === 'cancelled') tr.className = 'cancelled';
      const day = DAYS[new Date(`${a.date}T00:00:00Z`).getUTCDay()];
      tr.append(cell(a.id), cell(a.name), cell(a.phone, 'ltr'), cell(`${day} ${a.date}`), cell(a.time, 'ltr'));

      const st = document.createElement('td');
      st.innerHTML = `<span class="badge ${a.status}">${a.status === 'booked' ? 'محجوز' : 'ملغى'}</span>`;
      tr.append(st, cell(a.created_at, 'ltr'));

      const act = document.createElement('td');
      act.className = 'actions';
      if (a.status === 'booked') {
        const btn = document.createElement('button');
        btn.className = 'cancel-btn';
        btn.textContent = 'إلغاء';
        btn.onclick = () => cancel(a);
        act.appendChild(btn);
      }
      tr.appendChild(act);
      rowsEl.appendChild(tr);
    }
    $('count').textContent = `العدد: ${list.length}`;
    $('lastUpdate').textContent = `آخر تحديث: ${new Date().toLocaleTimeString('ar')}`;
  }

  async function cancel(a) {
    if (!confirm(`إلغاء حجز ${a.name} يوم ${a.date} الساعة ${a.time}؟`)) return;
    const r = await fetch(`/api/appointments/${a.id}`, { method: 'DELETE', credentials: 'same-origin' });
    const data = await r.json();
    if (!data.ok) alert(data.message);
    load();
  }

  $('todayBtn').onclick = async () => {
    const c = await (await fetch('/api/clinic')).json();
    dateFilter.value = c.todayDate;
    load();
  };
  $('clearBtn').onclick = () => { dateFilter.value = ''; load(); };
  dateFilter.onchange = load;
  hideCancelled.onchange = load;

  load();
  setInterval(load, 15000);
})();
