/* 民宿 受付ご案内アプリ
   データはすべて、このタブレット（ブラウザ）の中だけに保存されます。 */
'use strict';

const KEY = 'minshuku-uketsuke-v1';
const VERSION = '3'; // 直すたびに数字を上げる。はじめの画面の右下に出るので、反映されたか見分けられる
const IDLE_MS = 3 * 60 * 1000; // お客さま画面は3分さわらないと最初の画面に戻る

/* ---------- 小さな道具 ---------- */
const uid = () => Math.random().toString(36).slice(2, 10);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nl = s => esc(s).replace(/\n/g, '<br>');
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => ymd(new Date());
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return ymd(d); };
const jdate = s => { const d = new Date(s + 'T00:00:00'); return `${d.getMonth() + 1}月${d.getDate()}日（${'日月火水木金土'[d.getDay()]}）`; };
const hm = iso => { const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
const nights = r => Math.max(1, parseInt(r.nights, 10) || 1);
const lastDay = r => addDays(r.date, nights(r));           // チェックアウト日
const staying = r => r.date <= today() && today() < lastDay(r); // 今日お泊まりの予約か
const getPath = (o, p) => p.split('.').reduce((a, k) => a[k], o);
const setPath = (o, p, v) => { const ks = p.split('.'); const last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; };

/* ---------- 見本データ（宿に合わせて管理画面で書き換える） ---------- */
function sample() {
  const t = today();
  const p1 = uid(), p2 = uid();
  return {
    inn: {
      name: '民宿 〇〇（見本）',
      phone: '090-0000-0000',
      checkout: '10:00',
      pin: '0000',
      payment: PAYMENT_SAMPLE,
      help: 'お困りのときは、下の番号にお電話ください。\n営業中ですぐに出られないことがあります。そのときは折り返しお電話します。\n\n急病や火事のときは、まず 119 番へ。'
    },
    common: [
      { id: uid(), title: 'ようこそ', body: '【見本】本日はお越しいただき、ありがとうございます。\nこれから、お泊まりのご案内を順番にお伝えします。\n画面下の「次へ」を押して進んでください。' },
      { id: uid(), title: 'お時間について', body: '【見本】チェックアウトは 朝10時 までです。\n門限はありませんが、夜10時以降はお静かにお願いします。' },
      { id: uid(), title: '鍵について', body: '【見本】お部屋の鍵は、お部屋の机の上に置いてあります。\n外出のときは玄関の鍵もお持ちください。\nお帰りの際は、鍵を受付の箱にお返しください。' },
      { id: uid(), title: 'お風呂・洗面', body: '【見本】お風呂は 夕方4時〜夜11時 にご利用いただけます。\nタオルはお部屋にご用意しています。' },
      { id: uid(), title: 'お食事について', body: '【見本】素泊まりのため、お食事のご用意はありません。\n近くのお店は、この画面の「館内・周辺のご案内」からご覧いただけます。' },
      { id: uid(), title: 'お願い', body: '【見本】館内は禁煙です。\nゴミは台所の分別箱へお願いします。\n火の元には十分ご注意ください。' }
    ],
    plans: [
      { id: p1, name: '素泊まり（1泊）', items: [
        { id: uid(), title: 'お布団', body: '【見本】お布団は押し入れにあります。お手数ですが、ご自身で敷いてください。' }
      ] },
      { id: p2, name: '素泊まり（連泊）', items: [
        { id: uid(), title: 'お布団', body: '【見本】お布団は押し入れにあります。お手数ですが、ご自身で敷いてください。' },
        { id: uid(), title: '連泊中のお掃除', body: '【見本】連泊中のお部屋のお掃除・タオルの交換は、ご希望の方のみ行います。\nご希望の場合は、朝9時までに受付の札を掛けてください。' }
      ] }
    ],
    faqs: [
      { id: uid(), q: 'Wi-Fi は使えますか', a: '【見本】使えます。\nネットワーク名：xxxx\nパスワード：xxxx' },
      { id: uid(), q: '近くにコンビニはありますか', a: '【見本】歩いて5分のところにあります。玄関を出て右へまっすぐです。' },
      { id: uid(), q: '駐車場はどこですか', a: '【見本】建物の裏に3台分あります。空いているところにお停めください。' },
      { id: uid(), q: '荷物を預けられますか', a: '【見本】チェックアウトの後も、当日中は玄関横の棚でお預かりできます。' }
    ],
    reservations: [
      { id: uid(), date: t, nights: 1, name: '山田', people: 2, planId: p1, room: '2階「松」', note: '', checkedInAt: null },
      { id: uid(), date: t, nights: 2, name: '佐藤', people: 1, planId: p2, room: '1階「竹」', note: 'お車は、建物裏の駐車場の一番奥にお停めください。', checkedInAt: null }
    ]
  };
}

/* ---------- 保存と読み込み ---------- */
let db;
function load() {
  try { db = JSON.parse(localStorage.getItem(KEY)); } catch (e) { db = null; }
  if (!db || !db.inn) { db = sample(); save(); }
  if (db.inn.payment === undefined) { db.inn.payment = PAYMENT_SAMPLE; save(); } // 前の版から使っている場合の追加
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch (e) { alert('保存できませんでした。タブレットの空き容量や、ブラウザの設定をご確認ください。'); }
}

/* ---------- 画面の状態 ---------- */
let view = { name: 'home' };
let adminOpen = false;
const app = document.getElementById('app');
function go(v) { stopSpeak(); view = v; render(); window.scrollTo(0, 0); }

/* ---------- 読み上げ ---------- */
const canSpeak = 'speechSynthesis' in window;
function speak(text) {
  if (!canSpeak) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/【見本】/g, ''));
  u.lang = 'ja-JP'; u.rate = 0.95;
  speechSynthesis.speak(u);
}
function stopSpeak() { if (canSpeak) speechSynthesis.cancel(); }

/* ---------- 説明の組み立て（共通 → プラン別） ----------
   お部屋とそのお客さまへの伝言は、最初の「お部屋」画面と最後の画面に出す */
function stepsFor(planId) {
  const plan = db.plans.find(p => p.id === planId);
  const s = db.common.map(x => ({ ...x, tag: 'みなさまへのご案内' }));
  if (plan) plan.items.forEach(x => s.push({ ...x, tag: `「${plan.name}」のご案内` }));
  return s.filter(x => (x.title || x.body));
}

const PAYMENT_SAMPLE = 'お支払いは現地でお願いします。現金または PayPay（ペイペイ）がご利用いただけます。\n\n■ 現金の方\n・お急ぎの方は、お部屋のテーブルの上に置いておいてください。\n・または、チェックアウトのときにフロントでお支払いください。\n\n■ PayPay の方\n・フロントまでお越しください。';

const roomBlock = r => `
    <section class="card roomcard">
      <p class="tag">お部屋</p>
      ${r.room ? `<p class="roombig">${esc(r.room)}</p>` : '<p class="body">お部屋は、宿の者からご案内します。</p>'}
      ${r.note ? `<p class="roomnote">${nl(r.note)}</p>` : ''}
    </section>`;

function markCheckedIn(id) {
  const r = db.reservations.find(x => x.id === id);
  if (r && !r.checkedInAt) { r.checkedInAt = new Date().toISOString(); save(); }
}

/* ====================================================================
   お客さま向けの画面
   ==================================================================== */
const header = (title, back) => `
  <header class="bar">
    ${back ? `<button class="btn ghost" data-act="go" data-to="${back}">← もどる</button>` : '<span></span>'}
    <h1>${esc(title)}</h1>
    <button class="btn ghost" data-act="go" data-to="home">はじめの画面</button>
  </header>`;

function vHome() {
  return `
  <main class="home">
    <p class="welcome">ようこそ</p>
    <h1 class="inn">${esc(db.inn.name)}</h1>
    <p class="date">${jdate(today())}</p>
    <button class="btn primary huge" data-act="go" data-to="pick">チェックイン<small>ご到着のお客さまはこちら</small></button>
    <div class="row2">
      <button class="btn big" data-act="go" data-to="faq">館内・周辺のご案内<small>よくあるご質問</small></button>
      <button class="btn big" data-act="go" data-to="help">お困りのとき<small>宿の者に連絡する</small></button>
    </div>
    <button class="gear" data-act="go" data-to="pin" aria-label="管理画面">管理（版 ${VERSION}）</button>
  </main>`;
}

function vPick() {
  const list = db.reservations.filter(staying).sort((a, b) => (a.checkedInAt ? 1 : 0) - (b.checkedInAt ? 1 : 0));
  return header('ご予約のお名前をお選びください', 'home') + `
  <main class="narrow">
    ${list.length ? '' : '<p class="empty">本日のご予約が、まだ登録されていません。<br>下の「名前が見つからない」からお進みください。</p>'}
    <div class="picks">
      ${list.map(r => `
        <button class="pick" data-act="start" data-id="${r.id}">
          <span class="pname">${esc(r.name)} 様</span>
          <span class="pmeta">${esc(r.people || '')}${r.people ? '名様・' : ''}${nights(r)}泊${r.checkedInAt ? '　<b class="done">受付済み（もう一度見る）</b>' : ''}</span>
        </button>`).join('')}
    </div>
    <button class="btn" data-act="go" data-to="noname">名前が見つからない</button>
  </main>`;
}

function vNoName() {
  return header('ご予約のプランをお選びください', 'pick') + `
  <main class="narrow">
    <p class="lead">お名前が見つからない場合は、ご予約のプランを選ぶとご案内をご覧いただけます。<br>あわせて、宿の者にもご連絡ください。</p>
    <div class="picks">
      ${db.plans.map(p => `<button class="pick" data-act="start-plan" data-id="${p.id}"><span class="pname">${esc(p.name)}</span></button>`).join('')}
    </div>
    <button class="btn" data-act="go" data-to="help">宿の者に連絡する</button>
  </main>`;
}

/* 名前を選んだ直後：まずお部屋を出し、常連の方はここで終われるようにする */
function vRoom() {
  const r = db.reservations.find(x => x.id === view.resId);
  if (!r) return vPick();
  return header(`${r.name} 様`, 'pick') + `
  <main class="narrow center">
    <h2 class="thanks">ようこそ、${esc(r.name)} 様</h2>
    ${roomBlock(r)}
    <div class="row2">
      <button class="btn primary big tall" data-act="skip">いつもご利用の方<small>このままお部屋へどうぞ</small></button>
      <button class="btn primary big tall" data-act="first">初めての方<small>お泊まりのご案内を見る</small></button>
    </div>
  </main>`;
}

function vGuide() {
  const r = db.reservations.find(x => x.id === view.resId);
  const steps = stepsFor(view.planId);
  const n = steps.length;
  const i = Math.min(view.i, n);
  const dots = `<div class="progress"><div style="width:${Math.round((i) / n * 100)}%"></div></div>`;
  if (i >= n) { // 最後の確認
    return header('ご確認', null) + dots + `
    <main class="narrow">
      <section class="card step">
        <p class="tag">さいごに</p>
        <h2>ご案内は以上です</h2>
        <p class="body">内容をご確認いただけましたら、下のボタンを押してください。<br>ご案内は、あとからいつでも見返すことができます。</p>
      </section>
      <div class="nav">
        <button class="btn big" data-act="step" data-d="-1">← 前へ</button>
        <button class="btn primary big" data-act="finish">確認しました</button>
      </div>
    </main>`;
  }
  const s = steps[i];
  return header(r ? `${r.name} 様` : 'ご案内', null) + dots + `
  <main class="narrow">
    <section class="card step">
      <p class="tag">${esc(s.tag)}　${i + 1} / ${n}</p>
      <h2>${esc(s.title)}</h2>
      <p class="body">${nl(s.body)}</p>
      ${canSpeak ? `<button class="btn ghost speak" data-act="speak">🔊 声で聞く</button>` : ''}
    </section>
    <div class="nav">
      <button class="btn big" data-act="step" data-d="-1" ${i === 0 ? 'disabled' : ''}>← 前へ</button>
      <button class="btn primary big" data-act="step" data-d="1">次へ →</button>
    </div>
  </main>`;
}

function vDone() {
  const r = db.reservations.find(x => x.id === view.resId);
  return header('受付が終わりました', null) + `
  <main class="narrow center">
    <div class="check">✓</div>
    <h2 class="thanks">${r ? esc(r.name) + ' 様、' : ''}ごゆっくりお過ごしください</h2>
    ${r ? roomBlock(r) : ''}
    ${db.inn.payment ? `<section class="card pay"><p class="tag">お支払いについて</p><p class="body">${nl(db.inn.payment)}</p></section>` : ''}
    <section class="card facts">
      ${r ? `<div><span>チェックアウト</span><b>${jdate(lastDay(r))} ${esc(db.inn.checkout)} まで</b></div>` : `<div><span>チェックアウト</span><b>${esc(db.inn.checkout)} まで</b></div>`}
      <div><span>宿の連絡先</span><b>${esc(db.inn.phone)}</b></div>
    </section>
    <div class="row2">
      <button class="btn big" data-act="review">ご案内をもう一度見る</button>
      <button class="btn big" data-act="go" data-to="faq">館内・周辺のご案内</button>
    </div>
    <button class="btn primary big" data-act="go" data-to="home">おわる</button>
  </main>`;
}

function vFaq() {
  const q = (view.q || '').trim();
  const hit = x => !q || (x.q + x.a).includes(q);
  const guides = [...(db.inn.payment ? [{ q: 'お支払いについて', a: db.inn.payment }] : []), ...db.common.map(x => ({ q: x.title, a: x.body }))].filter(hit);
  const faqs = db.faqs.filter(hit);
  const block = (title, arr) => arr.length ? `<h2 class="sec">${title}</h2>` + arr.map(x => `
      <details class="card qa"><summary>${esc(x.q)}</summary><p class="body">${nl(x.a)}</p></details>`).join('') : '';
  return header('館内・周辺のご案内', 'home') + `
  <main class="narrow">
    <input class="search" type="search" placeholder="ことばで探す（例：Wi-Fi、駐車場）" value="${esc(q)}" data-search>
    <div id="faqlist">
      ${block('よくあるご質問', faqs)}${block('お泊まりのご案内', guides)}
      ${faqs.length + guides.length ? '' : '<p class="empty">見つかりませんでした。「お困りのとき」から宿の者にご連絡ください。</p>'}
    </div>
    <button class="btn" data-act="go" data-to="help">お困りのとき（宿の者に連絡する）</button>
  </main>`;
}

function vHelp() {
  const tel = String(db.inn.phone || '').replace(/[^\d+]/g, '');
  return header('お困りのとき', 'home') + `
  <main class="narrow center">
    <section class="card">
      <p class="body">${nl(db.inn.help)}</p>
      <p class="phone">${esc(db.inn.phone)}</p>
      ${tel ? `<a class="btn primary big" href="tel:${esc(tel)}">この番号に電話をかける</a><p class="hint">※ 電話ができない端末では、お手持ちの電話からおかけください。</p>` : ''}
    </section>
  </main>`;
}

function vPin() {
  return header('管理画面', 'home') + `
  <main class="narrow center">
    <form class="card" data-form="pin">
      <label>暗証番号<input name="pin" type="password" inputmode="numeric" autocomplete="off" autofocus></label>
      ${view.err ? '<p class="err">暗証番号がちがいます。</p>' : ''}
      <button class="btn primary big">ひらく</button>
    </form>
  </main>`;
}

/* ====================================================================
   管理画面（宿の方が使う）
   ==================================================================== */
const TABS = [['res', '予約'], ['common', '共通の説明'], ['plans', 'プランごとの説明'], ['faq', 'よくある質問'], ['inn', '宿の設定']];

function vAdmin() {
  const tab = view.tab || 'res';
  const body = { res: aRes, common: aCommon, plans: aPlans, faq: aFaq, inn: aInn }[tab]();
  return `
  <header class="bar admin">
    <h1>管理画面</h1>
    <button class="btn primary" data-act="lock">お客さま画面にもどる</button>
  </header>
  <nav class="tabs">${TABS.map(([k, l]) => `<button class="${k === tab ? 'on' : ''}" data-act="tab" data-tab="${k}">${l}</button>`).join('')}</nav>
  <main class="wide">${body}</main>`;
}

/* --- 予約 --- */
function resForm(r) {
  const v = r || { date: today(), nights: 1, people: 2, planId: db.plans[0] ? db.plans[0].id : '', name: '', room: '', note: '' };
  return `
  <form class="card form" data-form="res">
    <h2>${r ? '予約を直す' : '予約を追加する'}</h2>
    <input type="hidden" name="id" value="${esc(v.id || '')}">
    <div class="grid">
      <label>お泊まりの日<input type="date" name="date" value="${esc(v.date)}" required></label>
      <label>泊数<input type="number" name="nights" min="1" max="30" value="${esc(v.nights)}" required></label>
      <label>お名前（画面に出ます）<input name="name" value="${esc(v.name)}" placeholder="例：山田" required></label>
      <label>人数<input type="number" name="people" min="1" max="50" value="${esc(v.people)}"></label>
      <label>プラン<select name="planId">${db.plans.map(p => `<option value="${p.id}" ${p.id === v.planId ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
      <label>お部屋<input name="room" value="${esc(v.room)}" placeholder="例：2階「松」"></label>
    </div>
    <label>このお客さまだけに伝えること（お部屋と一緒に出ます。なければ空のまま）<textarea name="note" rows="3">${esc(v.note)}</textarea></label>
    <div class="actions">
      <button class="btn primary">保存する</button>
      <button type="button" class="btn" data-act="res-cancel">やめる</button>
    </div>
  </form>`;
}

function aRes() {
  const t = today();
  const all = [...db.reservations].sort((a, b) => a.date.localeCompare(b.date));
  const groups = [
    ['今日お泊まり', all.filter(staying)],
    ['これから', all.filter(r => r.date > t)],
    ['おわった予約', all.filter(r => lastDay(r) <= t).reverse()]
  ];
  const row = r => {
    const plan = db.plans.find(p => p.id === r.planId);
    return `
    <div class="card resrow">
      <div class="rmain">
        <b>${jdate(r.date)}　${esc(r.name)} 様</b>
        <span>${esc(r.people || '-')}名・${nights(r)}泊・${esc(plan ? plan.name : 'プラン未設定')}${r.room ? '・' + esc(r.room) : ''}</span>
        ${r.note ? `<span class="note">伝えること：${esc(r.note)}</span>` : ''}
      </div>
      <div class="rstate">${r.checkedInAt ? `<span class="badge ok">受付済み ${hm(r.checkedInAt)}</span>` : '<span class="badge">まだ</span>'}</div>
      <div class="ractions">
        <button class="btn sm" data-act="res-edit" data-id="${r.id}">直す</button>
        ${r.checkedInAt ? `<button class="btn sm" data-act="res-uncheck" data-id="${r.id}">受付を取り消す</button>` : ''}
        <button class="btn sm danger" data-act="res-del" data-id="${r.id}">消す</button>
      </div>
    </div>`;
  };
  const editing = view.edit ? (view.edit === 'new' ? resForm(null) : resForm(db.reservations.find(r => r.id === view.edit))) : '';
  return `
    ${editing || '<button class="btn primary" data-act="res-new">＋ 予約を追加する</button>'}
    ${groups.map(([title, arr]) => `<h2 class="sec">${title}（${arr.length}件）</h2>${arr.length ? arr.map(row).join('') : '<p class="empty sm">ありません</p>'}`).join('')}`;
}

/* --- 説明文の編集（共通・プラン・質問で同じ部品を使う） --- */
function itemsEditor(path, k1, k2, l1, l2) {
  const arr = getPath(db, path);
  return arr.map((x, i) => `
    <div class="card item">
      <div class="itemhead">
        <span class="num">${i + 1}</span>
        <input data-bind="${path}.${i}.${k1}" value="${esc(x[k1])}" placeholder="${l1}">
        <button class="btn sm" data-act="item-move" data-path="${path}" data-i="${i}" data-d="-1" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button class="btn sm" data-act="item-move" data-path="${path}" data-i="${i}" data-d="1" ${i === arr.length - 1 ? 'disabled' : ''}>↓</button>
        <button class="btn sm danger" data-act="item-del" data-path="${path}" data-i="${i}">消す</button>
      </div>
      <textarea data-bind="${path}.${i}.${k2}" rows="4" placeholder="${l2}">${esc(x[k2])}</textarea>
    </div>`).join('') + `<button class="btn" data-act="item-add" data-path="${path}" data-k1="${k1}" data-k2="${k2}">＋ 追加する</button>`;
}

function aCommon() {
  return `<p class="lead">すべてのお客さまに、この順番でお見せする説明です。書いた内容はすぐに保存されます。</p>` +
    itemsEditor('common', 'title', 'body', '見出し', '説明の文章');
}

function aPlans() {
  return `<p class="lead">共通の説明のあとに、予約のプランに合わせてお見せする説明です。</p>` +
    db.plans.map((p, pi) => `
    <section class="plan">
      <div class="planhead">
        <label>プランの名前<input data-bind="plans.${pi}.name" value="${esc(p.name)}"></label>
        <button class="btn sm danger" data-act="plan-del" data-i="${pi}">このプランを消す</button>
      </div>
      ${itemsEditor(`plans.${pi}.items`, 'title', 'body', '見出し', '説明の文章')}
    </section>`).join('') +
    `<button class="btn primary" data-act="plan-add">＋ プランを追加する</button>`;
}

function aFaq() {
  return `<p class="lead">「館内・周辺のご案内」に出る質問と答えです。Wi-Fi、駐車場、近くのお店など。</p>` +
    itemsEditor('faqs', 'q', 'a', '質問', '答え');
}

function aInn() {
  return `
  <section class="card form">
    <h2>宿の情報</h2>
    <div class="grid">
      <label>宿の名前<input data-bind="inn.name" value="${esc(db.inn.name)}"></label>
      <label>連絡先の電話番号<input data-bind="inn.phone" value="${esc(db.inn.phone)}" inputmode="tel"></label>
      <label>チェックアウトの時刻<input data-bind="inn.checkout" value="${esc(db.inn.checkout)}" placeholder="例：10:00"></label>
      <label>管理画面の暗証番号<input data-bind="inn.pin" value="${esc(db.inn.pin)}" inputmode="numeric"></label>
    </div>
    <label>お支払いの案内（受付が終わった画面に出ます。空にすると出ません）<textarea data-bind="inn.payment" rows="9">${esc(db.inn.payment)}</textarea></label>
    <label>「お困りのとき」に出す文章<textarea data-bind="inn.help" rows="5">${esc(db.inn.help)}</textarea></label>
  </section>
  <section class="card form">
    <h2>控え（バックアップ）</h2>
    <p class="lead">内容はこのタブレットの中だけに保存されています。ときどき控えを取っておくと安心です。</p>
    <div class="actions">
      <button class="btn" data-act="export">控えをファイルに書き出す</button>
      <label class="btn filebtn">控えのファイルから戻す<input type="file" accept=".json,application/json" data-import hidden></label>
      <button class="btn danger" data-act="reset">すべて見本の状態に戻す</button>
    </div>
  </section>`;
}

/* ====================================================================
   描画と操作
   ==================================================================== */
function render() {
  const v = { home: vHome, pick: vPick, room: vRoom, noname: vNoName, guide: vGuide, done: vDone, faq: vFaq, help: vHelp, pin: vPin, admin: vAdmin }[view.name] || vHome;
  app.innerHTML = v();
  document.body.className = view.name === 'admin' ? 'is-admin' : 'is-guest';
}

const acts = {
  go(el) {
    const to = el.dataset.to;
    if (to === 'pin' && adminOpen) return go({ name: 'admin' });
    go({ name: to });
  },
  start(el) {
    const r = db.reservations.find(x => x.id === el.dataset.id);
    if (r) go({ name: 'room', resId: r.id, planId: r.planId });
  },
  skip() { markCheckedIn(view.resId); go({ name: 'done', resId: view.resId, planId: view.planId }); },
  first() { go({ name: 'guide', resId: view.resId, planId: view.planId, i: 0 }); },
  'start-plan'(el) { go({ name: 'guide', resId: null, planId: el.dataset.id, i: 0 }); },
  step(el) { go({ ...view, i: Math.max(0, view.i + Number(el.dataset.d)) }); },
  speak() {
    const s = stepsFor(view.planId)[view.i];
    if (s) speak(`${s.title}。${s.body}`);
  },
  finish() {
    markCheckedIn(view.resId);
    go({ name: 'done', resId: view.resId, planId: view.planId });
  },
  review() { go({ name: 'guide', resId: view.resId, planId: view.planId, i: 0 }); },

  lock() { adminOpen = false; go({ name: 'home' }); },
  tab(el) { go({ name: 'admin', tab: el.dataset.tab }); },
  'res-new'() { go({ name: 'admin', tab: 'res', edit: 'new' }); },
  'res-edit'(el) { go({ name: 'admin', tab: 'res', edit: el.dataset.id }); },
  'res-cancel'() { go({ name: 'admin', tab: 'res' }); },
  'res-del'(el) {
    const r = db.reservations.find(x => x.id === el.dataset.id);
    if (r && confirm(`${jdate(r.date)} ${r.name} 様 の予約を消します。よろしいですか？`)) {
      db.reservations = db.reservations.filter(x => x !== r); save(); render();
    }
  },
  'res-uncheck'(el) {
    const r = db.reservations.find(x => x.id === el.dataset.id);
    if (r) { r.checkedInAt = null; save(); render(); }
  },
  'item-add'(el) {
    getPath(db, el.dataset.path).push({ id: uid(), [el.dataset.k1]: '', [el.dataset.k2]: '' }); save(); render();
  },
  'item-del'(el) {
    if (!confirm('この項目を消します。よろしいですか？')) return;
    getPath(db, el.dataset.path).splice(Number(el.dataset.i), 1); save(); render();
  },
  'item-move'(el) {
    const arr = getPath(db, el.dataset.path), i = Number(el.dataset.i), j = i + Number(el.dataset.d);
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]]; save(); render();
  },
  'plan-add'() { db.plans.push({ id: uid(), name: '新しいプラン', items: [] }); save(); render(); },
  'plan-del'(el) {
    const p = db.plans[Number(el.dataset.i)];
    const used = db.reservations.filter(r => r.planId === p.id).length;
    if (!confirm(`「${p.name}」を消します。${used ? `このプランの予約が ${used} 件あります。` : ''}よろしいですか？`)) return;
    db.plans.splice(Number(el.dataset.i), 1); save(); render();
  },
  export() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' }));
    a.download = `受付アプリの控え_${today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  reset() {
    if (confirm('予約も説明文も、すべて消えて見本の状態に戻ります。本当によろしいですか？')) { db = sample(); save(); render(); }
  }
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (el && !el.disabled && acts[el.dataset.act]) acts[el.dataset.act](el);
});

document.addEventListener('submit', e => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  if (e.target.dataset.form === 'pin') {
    if (f.pin === String(db.inn.pin)) { adminOpen = true; go({ name: 'admin' }); }
    else go({ name: 'pin', err: true });
  }
  if (e.target.dataset.form === 'res') {
    const rec = { date: f.date, nights: Number(f.nights) || 1, name: f.name.trim(), people: Number(f.people) || '', planId: f.planId || '', room: f.room.trim(), note: f.note.trim() };
    const old = db.reservations.find(r => r.id === f.id);
    if (old) Object.assign(old, rec); else db.reservations.push({ id: uid(), ...rec, checkedInAt: null });
    save(); go({ name: 'admin', tab: 'res' });
  }
});

document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.bind) { setPath(db, t.dataset.bind, t.value); save(); }   // 書いたらすぐ保存
  if ('search' in t.dataset) {                                            // 入力中の文字を消さないよう一覧だけ描き直す
    view.q = t.value;
    const tmp = document.createElement('div'); tmp.innerHTML = vFaq();
    document.getElementById('faqlist').innerHTML = tmp.querySelector('#faqlist').innerHTML;
  }
});

document.addEventListener('change', e => {
  const t = e.target;
  if (!('import' in t.dataset) || !t.files[0]) return;
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const d = JSON.parse(fr.result);
      if (!d.inn || !Array.isArray(d.common) || !Array.isArray(d.plans) || !Array.isArray(d.reservations)) throw 0;
      d.faqs = d.faqs || [];
      if (confirm('いまの内容を、このファイルの内容に置き換えます。よろしいですか？')) { db = d; save(); render(); }
    } catch (err) { alert('このファイルは読み込めませんでした。'); }
  };
  fr.readAsText(t.files[0]);
});

/* さわらない時間が続いたら、お客さま画面を最初に戻す（前の人の画面を残さない） */
let idle;
function resetIdle() {
  clearTimeout(idle);
  idle = setTimeout(() => { if (view.name !== 'home' && view.name !== 'admin') go({ name: 'home' }); }, IDLE_MS);
}
['pointerdown', 'keydown', 'scroll'].forEach(ev => document.addEventListener(ev, resetIdle, { passive: true }));

/* 始める */
load();
render();
resetIdle();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
