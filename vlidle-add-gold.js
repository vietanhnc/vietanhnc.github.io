/* =============================================================================
 * Võ Lâm Idle — addGold ĐỘC LẬP (không cần vlidle-dev-console.js)
 * -----------------------------------------------------------------------------
 * Dán vào F12 → Console khi đang ở trong game. Hàm có sẵn ở global, KHÔNG cần await:
 *
 *   listGold()                      xem đồ Hoàng Kim (index + tên + bộ) để lấy i
 *   addGold(0)                      thêm theo index, affix random trong khoảng như game
 *   addGold('Phục Ma Tử Kim Côn')   thêm theo tên (tên phải duy nhất)
 *   addGold(0, { max: true })       mọi affix lấy giá trị cao nhất
 *   addGold(0, { enh: 9 })          thêm và gắn cường hóa +9
 *   addGold(0, { count: 3 })        3 món, mỗi món roll affix riêng
 *   commit()                        ký lại + ghi local + đẩy cloud + reload
 *
 * Thứ tự thuộc tính item bám đúng P4(...) trong client app.js (build 826):
 *   uid, mk, d, k, n, ic, lvl, s, price, base, req, r,
 *   set { kind, grp, n1, n2, sid }, mag, ext [, enh]
 *
 * mk do client tự sinh (dl() trong app.js) — KHÔNG lấy từ server. Chữ ký 'sm' thì
 * CHỈ server cấp được, qua RPC hk_mint. commit() tự gọi hk_mint cho món HK thiếu sm
 * (đúng thứ tự el() trong app.js: pushCloud → hk_mint → pushCloud), vì đồ HK thiếu sm
 * sẽ bị chợ từ chối: P0001 "Món đồ không có trong túi (theo bản lưu trên máy chủ)".
 *
 * Lưu ý: SALT/FMT phải khớp app.js (biến Ay / Za). Đổi salt trong app.js ⇒ sửa 2 hằng này.
 * ========================================================================== */
(function () {
  "use strict";

  // Phải khớp salt/format trong app.js (biến Ay / Za, build 826).
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
  // S.state = bản nháp đang sửa; S.raw = chuỗi localStorage lúc nạp; S.dirty = đã sửa chưa commit.
  const S = { slot: activeSlot(), state: null, raw: null, base: null, dirty: false, get key() { return keyOf(this.slot); } };
  const readRaw = () => { try { return localStorage.getItem(S.key); } catch { return null; } };
  const changed = () => !!S.state && (S.dirty || JSON.stringify(S.state) !== S.base);
  function load() {
    const raw = readRaw();
    if (!raw) throw new Error("Không có save ở " + S.key + " — vào game tới nhân vật trước.");
    const r = unpack(raw);
    if (!r.ok) console.warn("[vgold] Hash save hiện tại không khớp SALT/FMT — salt trong app.js có thể đã đổi, commit() sẽ ký sai.");
    S.state = r.state; S.raw = raw; S.dirty = false; S.base = JSON.stringify(r.state);
    return S.state;
  }
  // Chưa có sửa dở ⇒ bám theo save mới nhất (game autosave liên tục), tránh commit đè bằng bản cũ.
  function data() {
    if (S.state && !changed()) {
      S.slot = activeSlot();
      if (readRaw() !== S.raw) return load();
    }
    return S.state || load();
  }
  const edit = () => { const d = data(); S.dirty = true; return d; };

  // Game tự lưu đè save khi reload (pagehide). commit() đăng ký thêm listener để ghi lại
  // bản đã sửa SAU lượt autosave của game, tránh bị mất.
  function guardReload(raw, key, slot) {
    const rewrite = () => { try { localStorage.setItem(key, raw); localStorage.setItem("jxidle_slot", String(slot)); } catch {} };
    const hooks = [[window, "pagehide"], [document, "visibilitychange"]];
    hooks.forEach(([t, ev]) => t.addEventListener(ev, rewrite));
    setTimeout(() => hooks.forEach(([t, ev]) => t.removeEventListener(ev, rewrite)), 10000);
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
  async function pushCloud(state) {
    const { sub } = authInfo();
    if (!sub) throw new Error("Không đọc được user id.");
    state.netOwner = sub;
    const updated = new Date().toISOString();
    state.cloudAt = Date.parse(updated);          // tạm — sẽ chỉnh theo server bên dưới
    let stash = null; try { stash = localStorage.getItem("jxidle_stash"); } catch {}
    const row = { owner: sub, slot: S.slot, name: state.name || "", lvl: state.lvl | 0, fac: state.fac, data: JSON.stringify({ v: 2, d: pack(state), k: stash }), updated };
    const av = clientVer(); if (av) row.av = av;
    // return=representation để ĐỌC LẠI 'updated' server thật sự lưu → đồng bộ cloudAt.
    const post = () => sbFetch("/rest/v1/saves?on_conflict=owner,slot&select=updated", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=representation",
      body: [row],
    });
    let res;
    try { res = await post(); }
    catch (e) { if (row.av && /'av' column|"av"|column av\b/i.test(e.message)) { delete row.av; res = await post(); } else throw e; }
    const srv = Array.isArray(res) && res[0] && res[0].updated;
    if (srv) state.cloudAt = Date.parse(srv);
    console.log("[vgold] pushCloud OK — cloudAt", state.cloudAt, srv ? "(theo server)" : "(theo client, không đọc lại được)");
    return state.cloudAt;
  }

  // --- MINT: xin chữ ký 'sm' cho đồ Hoàng Kim (RPC hk_mint) -----------------
  // Payload/thứ tự bám đúng _Q() → KB() trong app.js (build 826):
  //   { q: [{ mk, u, kind, grp, sid, n, o }], sl: <slot> }  → [{ mk, sm }]
  // Điều kiện: bản lưu trên máy chủ PHẢI đã có món (server đối chiếu túi) ⇒ luôn
  // pushCloud trước khi mint, và pushCloud lần nữa sau khi gán sm.
  async function hkMint(items, slot) {
    const q = items.map(it => ({
      mk: it.mk, u: it.uid, kind: it.set.kind, grp: it.set.grp, sid: it.set.sid,
      n: String(it.n || "").slice(0, 80), o: it.hko ? "1" : "0",
    }));
    const res = await sbFetch("/rest/v1/rpc/hk_mint", { body: { q, sl: slot } });
    const map = new Map((Array.isArray(res) ? res : []).map(r => [r && r.mk, r && r.sm]));
    const out = { granted: 0, missed: [] };
    for (const it of items) {
      const sm = map.get(it.mk);
      if (sm != null) { it.sm = sm; delete it.hko; out.granted++; } else out.missed.push(it.mk);
    }
    return out;
  }

  // --- ITEM: đọc bảng JX của game (window.JX) ------------------------------
  const SLOT = ["weapon", "weapon", "armor", "ring", "amulet", "boot", "belt", "helm", "cuff", "pendant", "horse"];
  const JX = () => { const J = (typeof window !== "undefined") && window.JX; if (!J || !J.sets) throw new Error("Chưa thấy window.JX (vào game rồi hãy chạy)."); return J; };
  const statName = (id) => { try { return JX().attr[id] || ("#" + id); } catch { return "#" + id; } };

  // mk (mint key) — chuẩn 12 ký tự ngẫu nhiên, y hệt dl() của app.js. Sinh ở client, không lấy từ server.
  const mkDl = () => (Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4))
    .replace(/[^a-z0-9]/g, "0")
    .padEnd(12, "0");

  // roll 1 affix JX.ge, giống O8 (random trong khoảng) / Pi (lấy max) của app.js.
  function mkGe(id, max) {
    const g = JX().ge[id]; if (!g) return null;
    const p = g.p.map(([lo, hi]) => (lo === -1 && hi === -1) ? -1 :
      max ? Math.max(lo, hi) : Math.min(lo, hi) + Math.floor(Math.random() * (Math.abs(hi - lo) + 1)));
    return { a: g.a, p, pre: 1 };
  }

  // --- ĐỒ HOÀNG KIM (JX.sets.gold) -----------------------------------------
  const goldList = () => JX().sets.gold || [];

  // ref: số (chỉ số i trong JX.sets.gold), tên (khớp chính xác hoặc duy nhất một phần), hoặc { grp, d }.
  function findGold(ref) {
    const list = goldList();
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

  // Liệt kê để lấy i cho addGold.
  //   listGold()        cả danh sách (index, tên, slot, bộ)
  //   listGold('Mộng')  lọc theo từ khóa
  function listGold(q) {
    const s = String(q || "").toLowerCase();
    const rows = goldList().map((t, i) => ({ i, ten: t.n, slot: SLOT[t.d] || t.d, grp: t.grp, sid: t.sid }))
      .filter(r => !s || String(r.ten).toLowerCase().includes(s));
    console.table(rows);
    return rows;
  }

  // uid dùng bộ đếm state.uid như game (o.uid++).
  function nextUid() {
    const d = edit();
    let uid = d.uid | 0;
    if (uid <= 0) uid = (d.inv || []).reduce((m, x) => Math.max(m, (x && x.uid) | 0), 0) + 1;
    d.uid = uid + 1;
    return uid;
  }
  function pushInv(item) {
    const d = edit();
    d.inv = d.inv || []; d.inv.push(item);
    return item;
  }

  // Tạo 1 món Hoàng Kim. Thứ tự key giữ ĐÚNG như P4(...) trong app.js.
  function mkGold(t, o) {
    const item = {
      uid: nextUid(), mk: mkDl(), d: t.d, k: t.k, n: t.n, ic: t.ic || "", lvl: t.lvl, s: t.s, price: t.price,
      base: (t.base || []).map(b => b.slice()), req: (t.req || []).map(r => r.slice()),
      r: 4, set: { kind: "gold", grp: t.grp, n1: t.n1 || 99, n2: t.n2 || 99, sid: t.sid },
    };
    item.mag = (t.mag || []).map(id => mkGe(id, o.max)).filter(Boolean);
    item.ext = (t.ext || []).map(id => mkGe(id, o.max)).filter(Boolean);
    if (o.enh != null) item.enh = o.enh | 0;
    return item;
  }

  // Thêm đồ Hoàng Kim vào hành trang. CÒN PHẢI commit() để ghi.
  // opts: max (false = random trong khoảng min..max như game, MẶC ĐỊNH; true = luôn lấy max), enh, count
  function addGold(ref, opts) {
    const o = Object.assign({ max: false, enh: null, count: 1 }, opts || {});
    const t = findGold(ref); const added = [];
    for (let c = 0; c < Math.max(1, o.count | 0); c++) added.push(pushInv(mkGold(t, o)));
    const it = added[0];
    console.log("[vgold] +gold", it.n, "x" + added.length, "(" + (SLOT[it.d] || it.d) + ", bộ grp " + it.set.grp + ", " + it.mag.length + " mag + " + it.ext.length + " ext) uid=" + added.map(x => x.uid).join(","), "mk=" + added.map(x => x.mk).join(","), "→ commit() để ghi.");
    console.log("  mag:", it.mag.map(a => statName(a.a) + "=" + a.p.filter(v => v !== -1).join("/")).join(", "),
      it.ext.length ? "\n  ext:" : "", it.ext.map(a => statName(a.a) + "=" + a.p.filter(v => v !== -1).join("/")).join(", "));
    return added.length === 1 ? it : added;
  }

  // --- ghi save ------------------------------------------------------------
  // commit({ cloud:false }) = chỉ ghi local, không đẩy cloud.
  async function commit(opts) {
    if (!changed()) { console.warn("[vgold] Chưa có thay đổi nào (addGold) để commit."); return; }
    const o = Object.assign({ cloud: true }, opts || {});
    const d = S.state, key = S.key, slot = S.slot;

    // Mọi trang bị Hoàng Kim (có cờ set) phải có mã mk chuẩn — bù nếu thiếu.
    // hko = mk vừa do client sinh (giống KB trong app.js) → gửi kèm 'o:"1"' khi mint.
    const all = [];
    const take = (it) => {
      if (!it || typeof it !== "object" || !it.set || typeof it.set !== "object") return;
      if (!it.mk) { it.mk = mkDl(); it.hko = 1; }
      all.push(it);
    };
    (d.inv || []).forEach(take);
    Object.values(d.eq || {}).forEach(take);
    (d.chest || []).forEach(take);
    (d.epBox || []).forEach(take);

    d.cloudAt = Date.now();
    const sub = authInfo().sub; if (sub) d.netOwner = sub;

    let cloud = "local";
    const needMint = all.filter(it => !it.sm).slice(0, 100);   // KB() giới hạn 100 món/lượt
    if (o.cloud) {
      try {
        await pushCloud(d);                                  // (1) server phải có bản lưu chứa món trước
        cloud = "ok";
        if (needMint.length) {
          const r = await hkMint(needMint, slot);
          console.log("[vgold] hk_mint: " + r.granted + "/" + needMint.length + " món được cấp sm" +
            (r.missed.length ? " — server bỏ qua: " + r.missed.join(", ") : ""));
          if (r.granted) await pushCloud(d);                  // (2) lưu sm vào bản lưu trên server
        }
      } catch (e) {
        cloud = "fail";
        console.warn("[vgold] Cloud KHÔNG nhận: " + cloudWhy(e.message) + "\n  → chỉ ghi local; game có thể tải lại bản server khi khởi động và làm mất thay đổi.");
      }
    } else if (needMint.length) {
      console.warn("[vgold] " + needMint.length + " món HK còn thiếu sm nhưng commit({cloud:false}) nên không mint được — chợ sẽ từ chối bán (P0001).");
    }
    const noSm = needMint.filter(it => !it.sm).length;
    if (noSm) console.warn("[vgold] Còn " + noSm + " món HK thiếu sm (mint thất bại). Sau reload, game tự mint lại trong ~20s; nếu vẫn thiếu, mở F12 → Network lọc 'hk_mint' để xem lỗi.");

    const raw = pack(d);
    if (!unpack(raw).ok) throw new Error("Hash vừa ký không khớp — KHÔNG ghi.");
    try {
      const old = localStorage.getItem(key);
      if (old) localStorage.setItem(key + "_bak", old);
      localStorage.setItem(key, raw);
      localStorage.setItem("jxidle_slot", String(slot));
      const back = localStorage.getItem(key);
      if (back !== raw) throw new Error("đọc lại không khớp");
    } catch (e) { throw new Error("Không ghi được localStorage: " + e.message); }

    guardReload(raw, key, slot);
    console.log("[vgold] Đã ghi + ký lại (cloud: " + (cloud === "ok" ? "OK" : cloud === "fail" ? "LỖI, chỉ local" : "bỏ qua") + "). Reload…");
    S.dirty = false;
    location.reload();
  }

  // --- expose global -------------------------------------------------------
  const api = { addGold, listGold, commit, _state: () => S.state };
  for (const k of ["addGold", "listGold", "commit"]) { try { window[k] = api[k]; } catch {} }
  try { window.vgold = api; } catch {}

  console.log("%c[vgold] addGold độc lập sẵn sàng:", "color:#7fe08a;font-weight:bold",
    "\n  listGold()                   xem index + tên đồ Hoàng Kim" +
    "\n  addGold(0)                   random affix trong khoảng (như game)" +
    "\n  addGold(0, { max:true })     mọi affix lấy max" +
    "\n  addGold('tên đồ')            theo tên (phải duy nhất)" +
    "\n  addGold(0, { enh:9, count:3 })" +
    "\n  commit()                     ghi local + cloud + reload");
  try { load(); } catch (e) { console.warn("[vgold]", e.message); }
})();
