/* =============================================================================
* Võ Lâm Idle — console helper (bản gọn): set / attr / knb / commit
* -----------------------------------------------------------------------------
* Dán vào F12 → Console. Hàm có sẵn ở global, KHÔNG cần gõ "await":
*   set({ gold:1e9, lvl:99 })   sửa trường gốc trong save (nhớ commit())
*   set({ "rw.stat.reborn":1 }) khóa có dấu chấm = đi sâu vào object/array ("inv.0.enh" hoặc "inv[0].enh")
*   attr({ str:500 })           sửa điểm thuộc tính (nhớ commit())
*   commit()                    ký lại + đẩy cloud + ghi local + reload
*                               (set/attr/add* chỉ sửa bản nháp trong console, PHẢI commit() mới có tác dụng)
*   knb(100000)                 nạp KNB qua knb_sync (cộng thẳng)
*   knb(50,'bkh')               bịa 50 boss thế giới → server quay số ra KNB
*
* Lưu ý: game tự lưu đè save khi reload (pagehide). commit() đăng ký thêm listener
* ghi lại bản đã sửa SAU lượt autosave của game để bản sửa không bị mất.
* Chỉ dùng trên tài khoản/môi trường đã được chủ game cho phép.
* ========================================================================== */
(function () {
  "use strict";
  // Phải khớp salt/format trong app.js (biến Ay / Za, build 826). Đổi salt ⇒ sửa 2 hằng này.
  const SALT = "vlidle#f2|2026-10-13:", FMT = 2;

  // --- ký / mở save {f,d,h} ------------------------------------------------
  function og(A) {
    let n = 3735928559, t = 1103547991;
    const e = SALT + A;
    for (let a = 0; a < e.length; a++) {
      const s = e.charCodeAt(a);
      n = Math.imul(n ^ s, 2654435761);
      t = Math.imul(t ^ s, 1597334677);
    }
    n = Math.imul(n ^ (n >>> 16), 2246822507) ^ Math.imul(t ^ (t >>> 13), 3266489909);
    t = Math.imul(t ^ (t >>> 16), 2246822507) ^ Math.imul(n ^ (n >>> 13), 3266489909);
    return (4294967296 * (2097151 & t) + (n >>> 0)).toString(36);
  }
  const pack = (state) => { const d = JSON.stringify(state); return JSON.stringify({ f: FMT, d, h: og(FMT + "|" + d) }); };
  function unpack(raw) {
    const w = JSON.parse(raw);
    if (!w || w.f !== FMT || typeof w.d !== "string") throw new Error("Save sai định dạng f=" + FMT);
    return { state: JSON.parse(w.d), ok: og(FMT + "|" + w.d) === w.h };
  }

  // --- auth (lấy token + user id của phiên Supabase) -----------------------
  function subFromJwt(tok) {
    if (typeof tok !== "string" || tok.split(".").length !== 3) return null;
    try {
      let s = tok.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      while (s.length % 4) s += "=";
      return JSON.parse(decodeURIComponent(escape(atob(s)))).sub || null;
    } catch { return null; }
  }
  function parseAuth(raw) {
    let o = null; try { o = JSON.parse(raw); } catch {}
    if (o) {
      const sess = o.currentSession || o.session || (o.data && o.data.session) || o;
      const token = sess && sess.access_token;
      const sub = (sess && sess.user && sess.user.id) || subFromJwt(token);
      if (token || sub) return { token: token || null, sub: sub || null };
    }
    if (/^ey[\w-]+\.[\w-]+\.[\w-]+$/.test(raw)) { const sub = subFromJwt(raw); if (sub) return { token: raw, sub }; }
    return null;
  }
  function authInfo() {
    const cand = [];
    for (const store of [sessionStorage, localStorage]) {
      let keys = []; try { keys = Object.keys(store); } catch {}
      for (const k of keys) { let raw; try { raw = store.getItem(k); } catch { continue; } if (raw) { const a = parseAuth(raw); if (a) cand.push(a); } }
    }
    return cand.find(a => a.token && a.sub) || cand.find(a => a.sub) || { token: null, sub: null };
  }

  // --- REST Supabase -------------------------------------------------------
  async function sbFetch(path, { method = "POST", body = null, prefer = null } = {}) {
    const cfg = (typeof window !== "undefined" && window.CHAT_CFG) || {};
    if (!cfg.url || !cfg.key) throw new Error("Không thấy CHAT_CFG (offline?).");
    const { token } = authInfo();
    if (!token) throw new Error("Chưa đăng nhập (không có access_token).");
    const headers = { apikey: cfg.key, Authorization: "Bearer " + token, "Content-Type": "application/json" };
    if (prefer) headers.Prefer = prefer;
    const res = await fetch(cfg.url.replace(/\/+$/, "") + path, { method, headers, body: body != null ? JSON.stringify(body) : null });
    const txt = await res.text().catch(() => "");
    if (!res.ok) throw new Error("REST " + res.status + ": " + String(txt).slice(0, 300));
    try { return txt ? JSON.parse(txt) : null; } catch { return txt; }
  }
  const rpc = (fn, args) => sbFetch("/rest/v1/rpc/" + fn, { body: args || {} });

  // --- slot & nạp save -----------------------------------------------------
  const keyOf = (slot) => (slot === 0 ? "jxidle" : "jxidle_" + (slot + 1));
  function activeSlot() {
    let s = null; try { s = localStorage.getItem("jxidle_slot"); } catch {}
    if (s && /^\d+$/.test(s)) return +s;
    let i = null; try { i = sessionStorage.getItem("jxidle_in"); } catch {}
    if (i && /^\d+$/.test(i)) return +i;
    for (let n = 0; n < 3; n++) { try { if (localStorage.getItem(keyOf(n))) return n; } catch {} }
    return 0;
  }
  // S.state = bản nháp đang sửa; S.raw = chuỗi localStorage lúc nạp; S.dirty = đã có sửa chưa commit.
  // S.state = bản nháp; S.raw = chuỗi localStorage lúc nạp; S.base = JSON của bản nháp lúc nạp;
  // S.dirty = đã sửa qua set/attr/add*. Sửa TẠI CHỖ qua tham chiếu từ dump() không bật S.dirty,
  // nên "đã sửa dở" còn được nhận ra bằng cách so JSON bản nháp với S.base.
  const S = { slot: activeSlot(), state: null, raw: null, base: null, dirty: false, get key() { return keyOf(this.slot); } };
  const readRaw = () => { try { return localStorage.getItem(S.key); } catch { return null; } };
  const changed = () => !!S.state && (S.dirty || JSON.stringify(S.state) !== S.base);
  function load() {
    const raw = readRaw();
    if (!raw) throw new Error("Không có save ở " + S.key + " — vào game tới nhân vật trước.");
    const r = unpack(raw);
    if (!r.ok) console.warn("[vldev] Hash save hiện tại không khớp với SALT/FMT của script — salt trong app.js có thể đã đổi, commit() sẽ ký sai.");
    S.state = r.state; S.raw = raw; S.dirty = false; S.base = JSON.stringify(r.state);
    return S.state;
  }
  // Chưa có sửa dở ⇒ bám theo save mới nhất (game autosave liên tục), tránh commit đè bằng bản cũ.
  // Đã có sửa dở (kể cả sửa tại chỗ qua dump()) ⇒ giữ nguyên bản nháp, KHÔNG nạp lại.
  function data() {
    if (S.state && !changed()) {
      S.slot = activeSlot();
      if (readRaw() !== S.raw) return load();
    }
    return S.state || load();
  }
  const edit = () => { const d = data(); S.dirty = true; return d; };

  // --- các hàm chính -------------------------------------------------------
  // --- đường dẫn lồng nhau cho set(): "rw.stat.reborn", "inv.0.enh", "mats.misc.bk90", "inv[0].enh" ---
  const BAD_KEY = new Set(["__proto__", "constructor", "prototype"]);
  const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  function splitPath(p) {
    const parts = String(p).replace(/\[(\w+)\]/g, ".$1").split(".");
    if (parts.some(s => s === "")) throw new Error("Đường dẫn không hợp lệ: '" + p + "'");
    const bad = parts.find(s => BAD_KEY.has(s));
    if (bad) throw new Error("Khóa không được phép trong đường dẫn '" + p + "': " + bad);
    return parts;
  }
  // Kiểm tra trước (không sửa gì): các nút trung gian đã tồn tại phải là object/array.
  function checkPath(d, parts, full) {
    let cur = d;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!hasOwn(cur, parts[i]) || cur[parts[i]] == null) return; // phần còn lại sẽ được tự tạo
      cur = cur[parts[i]];
      if (typeof cur !== "object") throw new Error("'" + parts.slice(0, i + 1).join(".") + "' là " + typeof cur + ", không đi sâu tiếp được tới '" + full + "'");
    }
  }
  function getPath(d, parts) {
    let cur = d;
    for (const k of parts) { if (cur == null || typeof cur !== "object" || !hasOwn(cur, k)) return undefined; cur = cur[k]; }
    return cur;
  }
  function assignPath(d, parts, value) {
    let cur = d;
    for (let i = 0; i < parts.length - 1; i++) {
      const k = parts[i];
      if (!hasOwn(cur, k) || cur[k] == null) cur[k] = /^\d+$/.test(parts[i + 1]) ? [] : {}; // số ⇒ mảng, còn lại ⇒ object
      cur = cur[k];
    }
    cur[parts[parts.length - 1]] = value;
  }

  // set({ gold:1e9, lvl:99 })                       khóa thường: ghi đè cả giá trị (nông)
  // set({ "rw.stat.reborn":1, "mats.misc.bk90":5 })  khóa có dấu chấm: đi sâu vào object/array, tự tạo nút còn thiếu
  // set({ "inv.0.enh":9 }) hoặc "inv[0].enh"          chỉ số mảng
  function set(patch) {
    if (!patch || typeof patch !== "object") throw new Error('set({ gold:1e9, lvl:99 }) hoặc set({ "rw.stat.reborn":1 })');
    const cur = data();
    // Pass 1: kiểm tra toàn bộ trước, lỗi thì không đổi gì cả.
    const plan = Object.entries(patch).map(([key, value]) => {
      if (!/[.[\]]/.test(key) || hasOwn(cur, key)) return { key, parts: [key], value, direct: true };
      const parts = splitPath(key); checkPath(cur, parts, key);
      return { key, parts, value, direct: false };
    });
    plan.forEach(p => { if (p.direct && BAD_KEY.has(p.key)) throw new Error("Khóa không được phép: " + p.key); });
    // Pass 2: áp dụng.
    const d = edit();
    const diff = {};
    for (const p of plan) {
      if (!p.direct) diff[p.key] = [getPath(d, p.parts), p.value];
      assignPath(d, p.parts, p.value);
    }
    console.log("[vldev] set", patch, "→ gọi commit() để ghi.");
    for (const [k, [a, b]] of Object.entries(diff)) console.log("  " + k + ":", a, "→", b);
    return d;
  }
  function attr(patch) {
    const d = edit();
    d.attr = Object.assign({ str: 0, dex: 0, vit: 0, eng: 0 }, d.attr || {}, patch || {});
    console.log("[vldev] attr =", d.attr, "→ gọi commit() để ghi.");
    return d.attr;
  }

  // Xem nhanh save để biết tên trường truyền vào set()/attr().
  //   - "trường vô hướng" (số/chuỗi/bool) = dùng trực tiếp cho set({...}).
  //   - "trường phức" = object/array, chỉ liệt kê tên + tóm tắt (vd attr, inv, eq).
  //   dump('attr')  → in sâu một trường object cụ thể.
  //   dump() / dump('<tên>') trả về THAM CHIẾU vào bản nháp: sửa tại chỗ (vd dump('inv')[3].ktc.c = 500)
  //   rồi commit() là được. Hoặc dùng set({ "inv.3.ktc.c": 500 }).
  function dump(key) {
    const d = data();
    if (key != null) { console.log("[vldev]", key, "=", d[key]); return d[key]; }
    const scal = {}, other = {};
    for (const [k, v] of Object.entries(d)) {
      if (v === null || ["number", "string", "boolean"].includes(typeof v)) scal[k] = v;
      else if (Array.isArray(v)) other[k] = "Array(" + v.length + ")";
      else if (typeof v === "object") other[k] = "{ " + Object.keys(v).join(", ") + " }";
    }
    console.log("[vldev] slot", S.slot, "(" + S.key + ") — trường vô hướng (truyền vào set):");
    console.table(scal);
    console.log("[vldev] trường phức (object/array) — dump('<tên>') để xem sâu:", other);
    console.log("[vldev] attr (dùng cho attr()):", d.attr);
    return d;
  }

  async function pushCloud(state) {
    const { sub } = authInfo();
    if (!sub) throw new Error("Không đọc được user id.");
    state.netOwner = sub;
    const updated = new Date().toISOString();
    state.cloudAt = Date.parse(updated);          // tạm — sẽ chỉnh theo server bên dưới
    let stash = null; try { stash = localStorage.getItem("jxidle_stash"); } catch {}
    const row = { owner: sub, slot: S.slot, name: state.name || "", lvl: state.lvl | 0, fac: state.fac, data: JSON.stringify({ v: 2, d: pack(state), k: stash }), updated };
    // Giống upsert của game (ZA): gửi kèm av = số build client (lấy từ app.js?v=NNN đang chạy).
    // 'sid' nằm trong closure của app.js nên không lấy được → bỏ qua (cột giữ nguyên giá trị cũ khi upsert).
    const av = clientVer(); if (av) row.av = av;
    // return=representation để ĐỌC LẠI 'updated' server thật sự lưu → đồng bộ cloudAt,
    // tránh lệch giờ máy (client chậm hơn server > 5s) khiến game tải cloud & reload lần 2.
    const post = () => sbFetch("/rest/v1/saves?on_conflict=owner,slot&select=updated", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=representation",
      body: [row],
    });
    let res;
    try { res = await post(); }
    catch (e) { if (row.av && /'av' column|"av"|column av\b/i.test(e.message)) { delete row.av; res = await post(); } else throw e; }
    const srv = Array.isArray(res) && res[0] && res[0].updated;
    if (srv) state.cloudAt = Date.parse(srv);     // cloudAt local == updated server ⇒ Vr()=false
    console.log("[vldev] pushCloud OK — cloudAt", state.cloudAt, srv ? "(theo server)" : "(theo client, không đọc lại được)");
    return state.cloudAt;
  }

  // Build client = tham số ?v=NNN của <script src="app.js?v=NNN"> (game gửi cùng số này làm 'av').
  function clientVer() {
    try {
      const el = document.querySelector('script[src*="app.js"]');
      const m = el && /[?&]v=(\d+)/.exec(el.src);
      return m ? +m[1] : null;
    } catch { return null; }
  }

  // Lý do server từ chối upsert, dịch ra dạng dễ hiểu.
  function cloudWhy(msg) {
    if (/JX_OLD/.test(msg)) return "JX_OLD — server coi client là bản cũ (thiếu/sai av), hãy tải lại trang game rồi thử lại";
    if (/JX_SRV/.test(msg)) return "JX_SRV — tài khoản đang ở chế độ máy chủ game (view); sửa save trình duyệt không có tác dụng";
    if (/JX_SESS/.test(msg)) return "JX_SESS — phiên khác đang giữ nhân vật này";
    if (/cấp cao hơn ở ô này/.test(msg)) return "server đang có nhân vật cấp cao hơn ở ô này, không cho ghi đè bằng cấp thấp hơn";
    return msg;
  }

  // Game luôn autosave (pagehide / visibilitychange) bằng nhân vật đang chạy trong bộ nhớ ngay khi
  // reload ⇒ ghi đè bản vừa sửa. Listener đăng ký SAU listener của game nên chạy sau nó và ghi lại
  // bản đã ký. Chỉ dùng addEventListener + localStorage.setItem trên khóa save của chính nó.
  function guardReload(raw, key, slot) {
    const rewrite = () => { try { localStorage.setItem(key, raw); localStorage.setItem("jxidle_slot", String(slot)); } catch {} };
    const hooks = [[window, "pagehide"], [document, "visibilitychange"]];
    hooks.forEach(([t, ev]) => t.addEventListener(ev, rewrite));
    // Nếu reload không xảy ra thì gỡ, tránh đè tiến trình sau này.
    setTimeout(() => hooks.forEach(([t, ev]) => t.removeEventListener(ev, rewrite)), 10000);
  }

  // mk (mint key) dùng chuẩn 12 ký tự ngẫu nhiên như Dl() của app.js
  const mkDl = () => (Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4))
    .replace(/[^a-z0-9]/g, "0")
    .padEnd(12, "0");

  // commit({ cloud:false }) = chỉ ghi local, không đẩy cloud.
  async function commit(opts) {
    if (!changed()) { console.warn("[vldev] Chưa có thay đổi nào (set/attr/add* hoặc sửa tại chỗ qua dump()) để commit."); return; }
    const o = Object.assign({ cloud: true }, opts || {});
    const d = S.state, key = S.key, slot = S.slot;
    // Đồng bộ tên ô Kỳ Trân Các với số lượng ("Tên ×c") như game (x3), phòng khi ktc.c được sửa tay.
    for (const it of d.inv || []) {
      const def = it && it.ktc && KTC.find(x => x[0] === it.ktc.k);
      if (def) it.n = ktcName(def, it.ktc.c | 0);
    }
    // Đảm bảo mọi trang bị Hoàng Kim / Bạch Kim (có cờ set) đều có mã mk chuẩn như client Dl()
    const ensureMk = (it) => {
      if (it && typeof it === "object" && it.set && !it.mk) it.mk = mkDl();
    };
    (d.inv || []).forEach(ensureMk);
    Object.values(d.eq || {}).forEach(ensureMk);
    (d.chest || []).forEach(ensureMk);
    (d.epBox || []).forEach(ensureMk);

    d.cloudAt = Date.now();
    const sub = authInfo().sub; if (sub) d.netOwner = sub;

    let cloud = "local";
    if (o.cloud) {
      try { await pushCloud(d); cloud = "ok"; }
      catch (e) {
        cloud = "fail";
        console.warn("[vldev] Cloud KHÔNG nhận: " + cloudWhy(e.message) + "\n  → chỉ ghi local; game có thể tải lại bản server khi khởi động và làm mất thay đổi.");
      }
    }

    const raw = pack(d);
    if (!unpack(raw).ok) throw new Error("Hash vừa ký không khớp — KHÔNG ghi.");
    try {
      const old = localStorage.getItem(key);
      if (old) localStorage.setItem(key + "_bak", old);
      localStorage.setItem(key, raw);
      localStorage.setItem("jxidle_slot", String(slot));
      // đọc lại để chắc chắn đã ghi đúng
      const back = localStorage.getItem(key);
      if (back !== raw) throw new Error("đọc lại không khớp");
    } catch (e) { throw new Error("Không ghi được localStorage: " + e.message); }

    guardReload(raw, key, slot);
    console.log("[vldev] Đã ghi + ký lại (cloud: " + (cloud === "ok" ? "OK" : cloud === "fail" ? "LỖI, chỉ local" : "bỏ qua") + "). Reload…");
    S.dirty = false;
    location.reload();
  }

  // source: "boss" cộng thẳng amount KNB | "bk"/"bkh" = số lượt boss (server quay số)
  async function knb(amount, source = "boss") {
    const n = Math.max(0, Math.floor(+amount || 0));
    if (!n) throw new Error("knb(amount[, source])");
    const b0 = +(((await rpc("knb_sync", { e: {} })) || {}).bal || 0);
    const r = (await rpc("knb_sync", { e: { [source]: n } })) || {};
    const b1 = +(r.bal || 0);
    console.log("[vldev] knb_sync {" + source + ":" + n + "}  bal", b0, "→", b1, "(Δ " + (b1 - b0) + ")",
      b1 - b0 <= 0 ? "⚠ không tăng (trần ngày?)" : "");
    return b1;
  }

  // --- ITEM: liệt kê template & tạo đồ (replicate Z0/pn/Sf từ window.JX) ---
  const SLOT = ["weapon", "weapon", "armor", "ring", "amulet", "boot", "belt", "helm", "cuff", "pendant", "horse"];
  const JX = () => { const J = (typeof window !== "undefined") && window.JX; if (!J || !J.items) throw new Error("Chưa thấy window.JX (vào game rồi hãy chạy)."); return J; };
  const statName = (id) => { try { return JX().attr[id] || ("#" + id); } catch { return "#" + id; } };

  // Liệt kê item hoặc affix để lấy tham số cho addItem().
  //   listItems()                       tất cả template (id = "d:k:p")
  //   listItems({ slot:'helm', q:'long' })  lọc theo slot / tên
  //   listItems({ affix:true })         bảng affix (idx + stat id + range)
  function listItems(opts) {
    const J = JX(); const o = Object.assign({ slot: null, k: null, q: null, affix: false, limit: 300 }, opts || {});
    if (o.affix) {
      const rows = (J.affix || []).map((a, idx) => ({
        idx, a: a.a, stat: statName(a.a), ten: a.n, loai: a.pre ? "prefix" : "suffix",
        s: a.s, lvl: a.lvl, p: JSON.stringify(a.p), mota: a.d,
      })).filter(r => o.q ? (r.ten + r.stat + r.mota).toLowerCase().includes(String(o.q).toLowerCase()) : true);
      console.log("[vldev] " + rows.length + " affix. 'idx' hoặc 'a'(stat id) dùng cho addItem({affix:[...]}).");
      console.table(rows.slice(0, o.limit));
      return rows;
    }
    const out = [];
    (J.items || []).forEach((cat, d) => (cat.list || []).forEach(it => {
      if (o.slot != null && SLOT[d] !== o.slot) return;
      if (o.k != null && it.k !== o.k) return;
      if (o.q && !(it.n || "").toLowerCase().includes(String(o.q).toLowerCase())) return;
      out.push({
        id: d + ":" + it.k + ":" + it.p, slot: SLOT[d], ten: it.n, lvl: it.lvl, he: it.s,
        base: (it.base || []).map(b => statName(b[0]) + "=" + b[1] + (b[2] !== b[1] ? ".." + b[2] : "")).join(", "),
      });
    }));
    console.log("[vldev] " + out.length + " item. id = \"d:k:p\" → addItem(\"d:k:p\", {...}).");
    console.table(out.slice(0, o.limit));
    return out;
  }

  function findTpl(id) {
    const J = JX(); let d, k, p;
    if (typeof id === "string") [d, k, p] = id.split(":").map(Number);
    else if (id && typeof id === "object") ({ d, k, p } = id);
    const cat = J.items[d]; if (!cat) throw new Error("Không có slot d=" + d);
    const same = cat.list.filter(x => x.k === k);
    if (!same.length) throw new Error("Không có template d=" + d + " k=" + k);
    let t = (p != null && !isNaN(p)) ? same.find(x => x.p === p) : null;
    if (!t) t = same.reduce((a, b) => Math.abs(b.lvl - (p || 1)) < Math.abs(a.lvl - (p || 1)) ? b : a);
    return { d, t };
  }

  // roll 1 affix từ entry bảng JX.affix (max = giá trị cao nhất).
  function mkAffix(entry, max) {
    const p = (entry.p || []).map(([lo, hi]) =>
      (lo === -1 && hi === -1) ? -1 :
      max ? Math.max(lo, hi) : (Math.min(lo, hi) + Math.floor(Math.random() * (Math.abs(hi - lo) + 1))));
    return { a: entry.a, p, n: entry.n, pre: entry.pre };
  }

  // Tạo & thêm đồ vào hành trang. CÒN PHẢI commit() để ghi.
  //   addItem("7:0:3")                              mão k=0 variant p=3, không affix
  //   addItem("7:0:3", { s:4, max:true, affix:[12,40] })  hệ Thổ, base max, 2 affix theo idx bảng affix
  //   addItem("2:0:5", { enh:9, r:4, mag:[{a:56,p:[200]}] }) tự gắn affix thủ công {a:statId,p:[val]}
  //   addItem("7:0:3", { affix:[12,40], affixMax:false })  base max, affix random trong khoảng p
  //   max     : base lấy max (true) hay giữ range (false)
  //   affixMax: affix lấy max (true) hay random trong khoảng (false); bỏ trống = theo max
  function addItem(id, opts) {
    const o = Object.assign({ s: null, lvl: null, enh: null, r: null, max: true, affixMax: null, affix: [], mag: null }, opts || {});
    const affixMax = o.affixMax != null ? !!o.affixMax : !!o.max;
    const { d: slotD, t } = findTpl(id);
    const J = JX();
    const item = {
      uid: 0, d: slotD, k: t.k, p: t.p, n: t.n, ic: t.ic || "", lvl: o.lvl != null ? o.lvl : t.lvl,
      s: t.s >= 0 ? t.s : (o.s != null ? o.s : 0),
      base: (t.base || []).map(b => o.max ? [b[0], b[2], b[2]] : [b[0], b[1], b[2]]),
      req: (t.req || []).map(r => r.slice()), price: t.price || 0,
      mag: [],
    };
    // affix: ưu tiên mag thủ công, nếu không thì roll theo idx bảng affix
    if (Array.isArray(o.mag) && o.mag.length) {
      item.mag = o.mag.map(x => ({ a: x.a, p: Array.isArray(x.p) ? x.p : [x.p], n: x.n || statName(x.a), pre: x.pre | 0 }));
    } else if (Array.isArray(o.affix) && o.affix.length) {
      item.mag = o.affix.map((ix, i) => { const e = J.affix[ix]; if (!e) throw new Error("affix idx không hợp lệ: " + ix); const a = mkAffix(e, affixMax); a.pre = i % 2 === 0 ? 1 : 0; return a; }).filter(Boolean);
    }
    if (o.enh != null) item.enh = o.enh | 0;
    item.r = o.r != null ? o.r : (item.mag.length ? 1 : 0);
    pushInv(item);
    console.log("[vldev] +item", item.n, "(" + SLOT[slotD] + ", lvl " + item.lvl + ", " + item.mag.length + " affix) uid=" + item.uid, "→ commit() để ghi.");
    console.log("  base:", item.base.map(b => statName(b[0]) + "=" + b[1]).join(", "),
      item.mag.length ? "\n  affix: " + item.mag.map(a => statName(a.a) + "=" + a.p.filter(v => v !== -1).join("/")).join(", ") : "");
    return item;
  }

  // --- ĐỒ HOÀNG KIM (JX.sets.gold) — replicate un("gold", tpl) của app.js ---
  // Game tạo đồ hoàng kim từ template cố định trong JX.sets.gold:
  //   item = { uid, d, k, n, ic, lvl, s, price, base(copy), req(copy), r:4,
  //            set:{kind:"gold", grp, n1:n1||99, n2:n2||99, sid},
  //            mag: tpl.mag.map(W8), ext: tpl.ext.map(W8) }
  //   W8(id) = JX.ge[id] → { a, p:[random trong từng khoảng, -1 giữ nguyên], pre:1 }
  // Đồ có cờ `set` được lưu nguyên dạng (không nén _c) nên ghi thẳng vào D.inv là hợp lệ.
  const GOLD_SLOT = (d) => SLOT[d] || (d === 12 ? "cloak" : "d" + d);
  const reqVal = (t, stat) => { const r = (t.req || []).find(x => x[0] === stat); return r ? r[1] : null; };

  // fac: id (0..10), key ("wudu") hoặc một phần tên môn phái.
  function findFaction(v) {
    if (v == null) return null;
    const F = JX().factions || [];
    const s = String(v).toLowerCase();
    const f = F.find(x => String(x.id) === s || x.key === s) || F.find(x => (x.n || "").toLowerCase().includes(s));
    if (!f) throw new Error("Không có môn phái '" + v + "'. Dùng: " + F.map(x => x.id + "=" + x.key).join(", "));
    return f;
  }

  // roll 1 phần tử JX.ge (mag/ext). max=true lấy giá trị cao nhất, false random như game.
  function mkGe(id, max) {
    const g = JX().ge[id]; if (!g) return null;
    const p = g.p.map(([lo, hi]) => (lo === -1 && hi === -1) ? -1 :
      max ? Math.max(lo, hi) : Math.min(lo, hi) + Math.floor(Math.random() * (Math.abs(hi - lo) + 1)));
    return { a: g.a, p, pre: 1 };
  }

  const geText = (ids) => (ids || []).map(id => {
    const g = JX().ge[id]; if (!g) return "?" + id;
    const [lo, hi] = g.p[0] || [0, 0];
    return statName(g.a) + "=" + (lo === hi ? lo : lo + ".." + hi);
  }).join(", ");

  // Liệt kê đồ hoàng kim. i = chỉ số trong JX.sets.gold, dùng cho addGold(i).
  //   listGold({ q:'Mộng Long' })            lọc theo tên
  //   listGold({ fac:'wudu', slot:'weapon' })  lọc theo môn phái / slot
  //   listGold({ grp:1 })                      cả bộ (grp) số 1
  function listGold(opts) {
    const J = JX(); const o = Object.assign({ q: null, slot: null, d: null, fac: null, grp: null, lvl: null, limit: 300 }, opts || {});
    const fac = findFaction(o.fac);
    const out = [];
    (J.sets.gold || []).forEach((t, i) => {
      if (o.d != null && t.d !== o.d) return;
      if (o.slot != null && GOLD_SLOT(t.d) !== o.slot) return;
      if (o.grp != null && t.grp !== o.grp) return;
      if (o.lvl != null && t.lvl !== o.lvl) return;
      if (fac && reqVal(t, 39) !== fac.id) return;
      if (o.q && !(t.n || "").toLowerCase().includes(String(o.q).toLowerCase())) return;
      const f = (J.factions || []).find(x => x.id === reqVal(t, 39));
      out.push({
        i, grp: t.grp, sid: t.sid, d: t.d, slot: GOLD_SLOT(t.d), ten: t.n, lvl: t.lvl,
        he: (J.series || [])[t.s] || t.s, fac: f ? f.key : "-", bo: (t.n1 || 99) + "/" + (t.n2 || 99),
        mag: geText(t.mag), ext: geText(t.ext),
      });
    });
    console.log("[vldev] " + out.length + " đồ hoàng kim. i → addGold(i) · grp → addGoldSet(grp).");
    console.table(out.slice(0, o.limit));
    return out;
  }

  // ref: số (chỉ số i), tên (khớp chính xác hoặc duy nhất một phần), hoặc { grp, d }.
  function findGold(ref) {
    const list = JX().sets.gold || [];
    if (typeof ref === "number") { if (!list[ref]) throw new Error("Không có đồ hoàng kim i=" + ref); return list[ref]; }
    if (ref && typeof ref === "object") {
      const t = list.find(x => x.grp === ref.grp && (ref.d == null || x.d === ref.d));
      if (!t) throw new Error("Không có đồ hoàng kim grp=" + ref.grp + (ref.d != null ? " d=" + ref.d : ""));
      return t;
    }
    const s = String(ref || "").toLowerCase(); if (!s) throw new Error("addGold(i | 'tên' | {grp,d}[, opts])");
    const exact = list.filter(x => (x.n || "").toLowerCase() === s);
    const hits = exact.length ? exact : list.filter(x => (x.n || "").toLowerCase().includes(s));
    if (!hits.length) throw new Error("Không thấy đồ hoàng kim tên '" + ref + "'");
    if (hits.length > 1) throw new Error(hits.length + " kết quả cho '" + ref + "', dùng chỉ số i. Ví dụ: " +
      hits.slice(0, 5).map(x => list.indexOf(x) + "=" + x.n).join(" | "));
    return hits[0];
  }

  // uid dùng bộ đếm state.uid như game (D.uid++).
  function pushInv(item) {
    const d = edit();
    let uid = d.uid | 0; if (uid <= 0) uid = (d.inv || []).reduce((m, x) => Math.max(m, (x && x.uid) | 0), 0) + 1;
    item.uid = uid; d.uid = uid + 1;
    if (item && item.set && !item.mk) item.mk = mkDl();
    d.inv = d.inv || []; d.inv.push(item);
    return item;
  }

  function mkGold(t, o) {
    const item = {
      uid: 0, mk: mkDl(), d: t.d, k: t.k, n: t.n, ic: t.ic || "", lvl: t.lvl, s: t.s, price: t.price,
      base: (t.base || []).map(b => b.slice()), req: (t.req || []).map(r => r.slice()),
      r: 4, set: { kind: "gold", grp: t.grp, n1: t.n1 || 99, n2: t.n2 || 99, sid: t.sid },
    };
    item.mag = (t.mag || []).map(id => mkGe(id, o.max)).filter(Boolean);
    item.ext = (t.ext || []).map(id => mkGe(id, o.max)).filter(Boolean);
    if (o.enh != null) item.enh = o.enh | 0;
    return item;
  }

  // Thêm đồ hoàng kim vào hành trang. CÒN PHẢI commit() để ghi.
  //   addGold(0)                         theo chỉ số i từ listGold()
  //   addGold('Phục Ma Tử Kim Côn')      theo tên (phải duy nhất)
  //   addGold(0, { max:true, enh:9 })    affix luôn lấy giá trị cao nhất, +9
  //   addGold(0, { count:3 })            thêm 3 món, mỗi món roll affix riêng
  // opts: max (false = random trong khoảng min..max như game, MẶC ĐỊNH; true = luôn lấy giá trị cao nhất), enh, count
  function addGold(ref, opts) {
    const o = Object.assign({ max: false, enh: null, count: 1 }, opts || {});
    const t = findGold(ref); const added = [];
    for (let c = 0; c < Math.max(1, o.count | 0); c++) added.push(pushInv(mkGold(t, o)));
    const it = added[0];
    console.log("[vldev] +gold", it.n, "x" + added.length, "(" + GOLD_SLOT(it.d) + ", bộ grp " + it.set.grp + ", " + it.mag.length + " mag + " + it.ext.length + " ext) uid=" + added.map(x => x.uid).join(","), "mk=" + added.map(x => x.mk).join(","), "→ commit() để ghi.");
    console.log("  mag:", it.mag.map(a => statName(a.a) + "=" + a.p.filter(v => v !== -1).join("/")).join(", "),
      it.ext.length ? "\n  ext:" : "", it.ext.map(a => statName(a.a) + "=" + a.p.filter(v => v !== -1).join("/")).join(", "));
    return added.length === 1 ? it : added;
  }

  // Thêm đủ một bộ hoàng kim theo grp (có thể lọc d hoặc môn phái).
  //   addGoldSet(1)                 cả bộ Mộng Long (grp 1)
  //   addGoldSet(1, { max:true })       mặc định random trong khoảng như game, max:true để lấy giá trị cao nhất
  function addGoldSet(grp, opts) {
    const o = Object.assign({ max: false, enh: null }, opts || {});
    const list = (JX().sets.gold || []).filter(x => x.grp === grp);
    if (!list.length) throw new Error("Không có bộ hoàng kim grp=" + grp);
    const items = list.map(t => pushInv(mkGold(t, o)));
    console.log("[vldev] +gold set grp " + grp + ": " + items.length + " món — " + items.map(x => x.n).join(" | "), "→ commit() để ghi.");
    return items;
  }

  // --- VẬT PHẨM CHUNG: Kỳ Trân Các (hành trang) & nguyên liệu (D.mats) -----
  // Kỳ Trân Các: replicate b6(key, n) của app.js. Mỗi ô tối đa 999, tên "Tên ×c".
  //   { uid, n, d:99, k:0, lvl:1, s:-1, r:2, ic, price:0, base:[], req:[], mag:[], ext:[], ktc:{k, c} }
  // Bỏ "knb" (Kim Nguyên Bảo thật phải qua máy chủ, dùng knb()).
  const KTC_MAX = 999;
  const KTC = [
    ["tt", "Tiên Thảo Lộ", "img/ep/tt.png"],
    ["tsbl", "Thiên Sơn Bảo Lộ", "img/ep/tsbl.png"],
    ["bch", "Bạch Câu Hoàn", "img/ep/bch.png"],
    ["ttsp", "Tiên Thảo Lộ Đặc Biệt", "img/ep/ttsp.png"],
    ["hb", "Hồng Bao", "img/ep/hb.png"],
    ["dhb", "Đại Hồng Bao", "img/ep/dhb.png"],
    ["qht", "Quế Hoa Tửu", "img/ep/qht.png"],
    ["rht", "Rương Huyền Tinh", "img/ep/box2.png"],
    ["rda", "Rương Đá Thuộc Tính", "img/ep/box3.png"],
    ["mt90", "Bí Kíp 90", "img/ep/mt90.png"],
    ["vlmt", "Võ Lâm Mật Tịch", "img/ep/mt90.png"],
    ["ttk", "Tẩy Tủy Kinh", "img/ep/dtbk.png"],
    ["ldt", "Lệnh Bài Dã Tẩu", "img/ep/ldt.png"],
    ["ldp", "Lệnh Bài Đổi Phái", "img/ep/ldp.png"],
    ["dgt", "Thẻ Đổi Giới Tính", "img/ep/ldp.png"],
    ["rngua", "Rương Ngựa", "img/ep/box2.png"],
    ["dtbk", "Đại Thành Bí Kíp", "img/ep/dtbk.png"],
  ];
  const ktcName = (def, c) => def[1] + (c > 1 ? " ×" + c : "");

  function findKtc(key) {
    const k = String(key == null ? "" : key).toLowerCase();
    const def = KTC.find(x => x[0] === k) || KTC.find(x => x[1].toLowerCase() === k);
    if (!def) throw new Error("Không có vật phẩm Kỳ Trân Các '" + key + "'. Dùng: " + KTC.map(x => x[0]).join(", "));
    return def;
  }

  //   listKtc()                         danh sách key
  //   addKtc("qht", 20)                 thêm 20 Quế Hoa Tửu vào hành trang
  // Hành trang đầy (INV_MAX) thì dừng như game; trả về số lượng thực thêm.
  function listKtc() {
    const rows = KTC.map(x => ({ key: x[0], ten: x[1], ic: x[2] }));
    console.log("[vldev] " + rows.length + " vật phẩm Kỳ Trân Các. addKtc(key, số lượng) → commit().");
    console.table(rows);
    return rows;
  }

  function addKtc(key, count) {
    const n = count == null ? 1 : Math.floor(+count);
    if (!(n > 0)) throw new Error("addKtc(key[, count > 0])");
    const def = findKtc(key);
    const d = edit(); d.inv = d.inv || [];
    const cap = typeof globalThis.INV_MAX === "number" ? globalThis.INV_MAX : Infinity;
    let left = n;
    const top = d.inv.find(a => a && a.ktc && a.ktc.k === def[0] && a.ktc.c < KTC_MAX);
    if (top) { const a = Math.min(left, KTC_MAX - top.ktc.c); top.ktc.c += a; top.n = ktcName(def, top.ktc.c); left -= a; }
    while (left > 0) {
      if (d.inv.length >= cap) break;
      const a = Math.min(left, KTC_MAX);
      pushInv({ uid: 0, n: ktcName(def, a), d: 99, k: 0, lvl: 1, s: -1, r: 2, ic: def[2], price: 0, base: [], req: [], mag: [], ext: [], ktc: { k: def[0], c: a } });
      left -= a;
    }
    const added = n - left;
    console.log("[vldev] +ktc " + def[1] + " ×" + added + (left ? " (hành trang đầy " + d.inv.length + "/" + cap + ", còn thiếu " + left + ")" : "") + " → commit() để ghi.");
    return added;
  }

  // Nguyên liệu nằm trong D.mats, không phải ô hành trang. Replicate U(kind, key, n) của app.js.
  //   ht    Huyền Tinh cấp 1..10                 addMat("ht", 5, 10)
  //   ore   đá thuộc tính "vị trí:stat:cấp[:hệ]"  addMat("ore", "1:101:3:2", 5)  hoặc {place,a,lvl,s}
  //         vị trí chẵn (0,2,4) là tiền tố, lẻ (1,3,5) là hậu tố và BẮT BUỘC có hệ 0..4
  //   shard Mảnh Hoàng Kim theo tên món           addMat("shard", "Phục Ma Tử Kim Côn", 9)
  //   misc  mys, ttt, ltt, lmt, lb, bk90, ldt, ldp, dgt, dtbk, rngua, vlmt, ttk
  // count âm = trừ bớt, về 0 thì xóa khóa.
  const ORE_PLACES = ["Huyền Thiết Khoáng", "Khổng Tước Thạch", "Mật Ngân Khoáng", "Phù Dung Thạch", "Chu Sa Khoáng", "Chung Nhũ Thạch"];
  const MISC = {
    mys: "Thần Bí Khoáng Thạch", ttt: "Tử Thủy Tinh", ltt: "Lục Thủy Tinh", lmt: "Lam Thủy Tinh", lb: "Lệnh Bài Sát Thủ",
    bk90: "Bí Kíp 90", ldt: "Lệnh Bài Dã Tẩu", ldp: "Lệnh Bài Đổi Phái", dgt: "Thẻ Đổi Giới Tính",
    dtbk: "Đại Thành Bí Kíp", rngua: "Rương Ngựa", vlmt: "Võ Lâm Mật Tịch", ttk: "Tẩy Tủy Kinh",
  };
  const oreStats = (place) => [...new Set((JX().affixLevel || [])
    .filter(a => a.pre === (place % 2 === 0 ? 1 : 0) && a.lvl === 1).map(a => a.a))];

  function shardNames() {
    const gold = new Set((JX().sets.gold || []).map(g => g.n));
    const rcp = typeof window !== "undefined" && window.RCP && window.RCP.shards;
    return rcp ? Object.keys(rcp).filter(n => gold.has(n)) : [...gold];
  }

  // Chuẩn hóa (kind, key) thành { k, label } theo đúng khóa mà game dùng.
  function matKey(kind, key) {
    if (kind === "ht") {
      const lvl = Math.floor(+key);
      if (!(lvl >= 1 && lvl <= 10)) throw new Error("Huyền Tinh: cấp phải từ 1 đến 10");
      return { k: String(lvl), label: "Huyền Tinh cấp " + lvl };
    }
    if (kind === "ore") {
      let place, a, lvl, s;
      if (key && typeof key === "object") ({ place, a, lvl, s } = key);
      else [place, a, lvl, s] = String(key).split(":").map(x => (x === "" || x == null ? NaN : Number(x)));
      place = +place; a = +a; lvl = +lvl;
      if (!Number.isInteger(place) || place < 0 || place >= ORE_PLACES.length) throw new Error("Đá: vị trí phải từ 0 đến " + (ORE_PLACES.length - 1));
      if (!oreStats(place).includes(a)) throw new Error("Đá: stat " + a + " không hợp lệ cho " + ORE_PLACES[place] + ". Hợp lệ: " + oreStats(place).map(x => x + "=" + statName(x)).join(", "));
      if (!Number.isInteger(lvl) || lvl < 1 || lvl > 10) throw new Error("Đá: cấp phải từ 1 đến 10");
      let k = place + ":" + a + ":" + lvl, se = "";
      if (place % 2) {
        s = +s;
        if (!Number.isInteger(s) || s < 0 || s > 4) throw new Error("Đá hậu tố (vị trí lẻ) cần hệ 0..4, ví dụ \"" + k + ":2\"");
        k += ":" + s; se = " (" + ((JX().series || [])[s] || s) + ")";
      }
      return { k, label: ORE_PLACES[place] + se + " cấp " + lvl + " · " + statName(a) };
    }
    if (kind === "shard") {
      const s = String(key == null ? "" : key).toLowerCase();
      const name = shardNames().find(n => n.toLowerCase() === s);
      if (!name) throw new Error("Không có Mảnh '" + key + "'. Dùng listMat({kind:'shard'}) để xem tên hợp lệ.");
      return { k: name, label: "Mảnh " + name };
    }
    if (kind === "misc") {
      const k = String(key == null ? "" : key).toLowerCase();
      if (!MISC[k]) throw new Error("Không có '" + key + "' trong misc. Dùng: " + Object.keys(MISC).join(", "));
      return { k, label: MISC[k] };
    }
    throw new Error("kind phải là ht | ore | shard | misc");
  }

  function addMat(kind, key, count) {
    const n = count == null ? 1 : Math.trunc(+count);
    if (!Number.isFinite(n) || n === 0) throw new Error("addMat(kind, key[, count])  — count khác 0");
    const { k, label } = matKey(kind, key);
    const d = edit(); const m = d.mats || (d.mats = {});
    for (const g of ["ht", "ore", "shard", "misc"]) m[g] = m[g] || {};
    m[kind][k] = (m[kind][k] || 0) + n;
    if (m[kind][k] <= 0) delete m[kind][k];
    console.log("[vldev] " + (n > 0 ? "+" : "") + n + " " + label + " [" + kind + ":" + k + "] → còn " + (m[kind][k] || 0) + " → commit() để ghi.");
    return m[kind][k] || 0;
  }

  //   listMat({ kind:'ore', q:'sức mạnh' })   liệt kê nguyên liệu hợp lệ
  function listMat(opts) {
    const o = Object.assign({ kind: null, q: null, limit: 300 }, opts || {});
    const rows = [];
    if (!o.kind || o.kind === "ht") for (let l = 1; l <= 10; l++) rows.push({ kind: "ht", key: String(l), ten: "Huyền Tinh cấp " + l });
    if (!o.kind || o.kind === "ore") ORE_PLACES.forEach((nm, place) => oreStats(place).forEach(a => {
      const af = (JX().affixLevel || []).find(x => x.a === a && x.lvl === 1);
      rows.push({ kind: "ore", key: place + ":" + a + ":<cấp>" + (place % 2 ? ":<hệ>" : ""), ten: nm + " · " + (af ? af.n : statName(a)) + " (" + statName(a) + ")" });
    }));
    if (!o.kind || o.kind === "shard") shardNames().forEach(n => rows.push({ kind: "shard", key: n, ten: "Mảnh " + n }));
    if (!o.kind || o.kind === "misc") Object.keys(MISC).forEach(k => rows.push({ kind: "misc", key: k, ten: MISC[k] }));
    const out = o.q ? rows.filter(r => (r.key + " " + r.ten).toLowerCase().includes(String(o.q).toLowerCase())) : rows;
    console.log("[vldev] " + out.length + " nguyên liệu. addMat(kind, key, số lượng) → commit().");
    console.table(out.slice(0, o.limit));
    return out;
  }

  // --- expose global -------------------------------------------------------
  const api = { dump, set, attr, knb, listItems, addItem, listGold, addGold, addGoldSet, listKtc, addKtc, listMat, addMat, commit, load, _state: () => S.state };
  for (const k of ["dump", "set", "attr", "knb", "listItems", "addItem", "listGold", "addGold", "addGoldSet", "listKtc", "addKtc", "listMat", "addMat", "commit"]) { try { window[k] = api[k]; } catch {} }
  try { window.vldev = api; } catch {}

  console.log("%c[vldev] sẵn sàng (không cần await):", "color:#7fe08a;font-weight:bold",
    "\n  dump()                       xem các trường để build set()/attr()" +
    "\n  commit()                     ghi tất cả thay đổi (commit({cloud:false}) = chỉ local)" +
    "\n  set({gold:1e9, lvl:99})      →  commit()" +
    "\n  set({'rw.stat.reborn':1})    khóa có dấu chấm đi sâu vào object/array (inv.0.enh, inv[0].enh)" +
    "\n  attr({str:500})              →  commit()" +
    "\n  knb(100000) / knb(50,'bkh')" +
    "\n  listItems({slot:'helm'})     liệt kê item (id = d:k:p)" +
    "\n  listItems({affix:true})      liệt kê affix (idx / stat id)" +
    "\n  addItem('7:0:3',{s:4,max:true,affix:[12,40]})  →  commit()" +
    "\n  listGold({fac:'wudu',slot:'weapon'})  liệt kê đồ hoàng kim (i / grp)" +
    "\n  addGold(0) random trong khoảng · addGold(0,{max:true}) luôn max / addGoldSet(1)  →  commit()" +
    "\n  listKtc() / addKtc('qht',20)          vật phẩm Kỳ Trân Các vào hành trang" +
    "\n  listMat({kind:'ore'}) / addMat('ht',5,10)  nguyên liệu (ht | ore | shard | misc)");
  try { load(); } catch (e) { console.warn("[vldev]", e.message); }
})();
 