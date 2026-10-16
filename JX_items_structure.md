# Cấu trúc `JX.items` (Võ Lâm Idle) + tham chiếu `addItem`

Nguồn: `window.JX` nạp từ `data.js`. Dùng cho `listItems()` / `addItem()` trong `console_script.js`.

---

## 1. `JX.items` — danh mục template theo slot

`JX.items` là **mảng danh mục**, chỉ số của mảng = `d` (slot id):

```js
JX.items[d] = {
  detail: 0,
  file:   "helm",            // tên nhóm file sprite
  n:      "Mũ",              // tên hiển thị danh mục
  list:   [ /* các template */ ]
}
```

### Bảng `d` → slot (`SLOT[d]` trong script)

| d | file         | slot (nội bộ) | nghĩa        |
|---|--------------|---------------|--------------|
| 0 | meleeweapon  | `weapon`      | Vũ khí cận chiến |
| 1 | rangeweapon  | `weapon`      | Ám khí (vũ khí tầm xa) |
| 2 | armor        | `armor`       | Áo giáp |
| 3 | ring         | `ring`        | Nhẫn |
| 4 | amulet       | `amulet`      | Dây chuyền |
| 5 | boot         | `boot`        | Giày |
| 6 | belt         | `belt`        | Đai lưng |
| 7 | helm         | `helm`        | Mũ |
| 8 | cuff         | `cuff`        | Hộ uyển |
| 9 | pendant      | `pendant`     | Ngọc bội |
| 10| horse        | `horse`       | Ngựa |

### Template trong `JX.items[d].list[]`

```js
{
  p:    0,                       // chỉ số variant trong list (dùng cho id "d:k:p")
  n:    "Thiết Trủy thủ",        // tên item
  k:    0,                       // KHÓA loại (vũ khí: loại kiếm/đao/... ; slot khác thường = 0)
  spr:  "\\spr\\...obj-sword01.spr",
  d:    "Loại kiếm nhỏ...",      // MÔ TẢ (chuỗi) — KHÁC với d-slot ở trên
  s:    -1,                      // hệ/nguyên tố: -1=không hệ, 0..4 = Kim/Mộc/Thủy/Hỏa/Thổ
  price:100,
  lvl:  1,                       // cấp yêu cầu
  base: [[28,4,4],[29,7,7],[167,0,0],[31,20,20]],  // [ [statId, min, max], ... ]
  req:  [[36,0],[32,20],[33,0]],                   // [ [statId, value], ... ] yêu cầu
  ic:   "img/i/0_0.png"          // icon
}
```

- `base`: mỗi phần tử `[statId, min, max]`. Instance giữ nguyên dạng range; giá trị hiển thị tính từ min/max.
- `req`: điều kiện trang bị `[statId, value]` (vd `[36,0]` = yêu cầu cấp 0, `[32,20]` = cần 20 sức mạnh).

> Lưu ý: trong template, trường `d` là **mô tả (string)**. Còn `d` dùng làm slot id là **chỉ số của `JX.items`** (bảng trên). Trong instance tạo ra, `item.d = slot id (số)`.

---

## 2. Item **instance** (phần tử trong `D.inv`)

Hàm lõi game `Z0(d,k,lvl,rarity,series)` sinh ra:

```js
{
  uid:  12345,                   // id duy nhất, lấy từ bộ đếm D.uid++
  d:    7,                       // slot id (số)
  k:    0,                       // khóa loại
  p:    3,                       // variant
  n:    "Mộng Long ... Tăng Mão",
  ic:   "img/i/g0.png",
  lvl:  10,                      // cấp yêu cầu
  s:    4,                       // hệ 0..4 (hoặc -1)
  base: [[30,360,360]],          // [[statId,min,max],...]
  req:  [[36,90],[32,160]],      // [[statId,value],...]
  price:49999,
  mag:  [ {a:56, p:[200], n:"...", pre:1}, ... ],  // affix (xem mục 4)
  r:    1,                       // phẩm/màu (xem mục 5)
  enh:  9                        // (tùy chọn) mức cường hóa +N
}
```

---

## 3. Bảng `JX.attr` — `statId` → tên nội bộ

`JX.attr[id]` ánh xạ **statId → tên** (dùng cho `base`, `req`, affix `.a`). Các id hay dùng cho item:

| id | tên nội bộ            | ý nghĩa |
|----|-----------------------|---------|
| 28 | weapondamagemin_v     | Sát thương vũ khí (min) |
| 29 | weapondamagemax_v     | Sát thương vũ khí (max) |
| 30 | armordefense_v        | Phòng ngự giáp |
| 31 | durability_v          | Độ bền |
| 32 | requirestr            | Yêu cầu Sức mạnh |
| 33 | requiredex            | Yêu cầu Thân pháp |
| 34 | requirevit            | Yêu cầu Sinh khí |
| 35 | requireeng            | Yêu cầu Nội công |
| 36 | requirelevel          | Yêu cầu cấp |
| 37 | requireseries         | Yêu cầu hệ |
| 38 | requiresex            | Yêu cầu giới tính |
| 39 | requiremenpai         | Yêu cầu môn phái |
| 40 | weapondamageenhance_p | Tăng % sát thương vũ khí |
| 41 | armordefenseenhance_p | Tăng % phòng ngự |
| 43 | indestructible_b      | Không thể phá hủy |
| 50 | item_purple           | (cờ item tím) |
| 51 | add_damage_p          | Tăng % sát thương |
| 53 | add_boss_damage       | Tăng sát thương lên Boss |
| 56 | attackrating_v        | Chính xác (điểm) |
| 57 | attackrating_p        | Chính xác (%) |
| 160| allresmax_p           | Giới hạn kháng tất cả |
| 161| coldenhance_p         | Tăng % băng |
| 162| fireenhance_p         | Tăng % hỏa |
| 163| lightingenhance_p     | Tăng % lôi |
| 164| poisonenhance_p       | Tăng % độc |
| 167| attackratingenhance_p | Tăng % chính xác |
| 168| metalskill_v          | Kỹ năng hệ Kim |
| 169| woodskill_v           | Kỹ năng hệ Mộc |
| 170| waterskill_v          | Kỹ năng hệ Thủy |
| 171| fireskill_v           | Kỹ năng hệ Hỏa |
| 172| earthskill_v          | Kỹ năng hệ Thổ |

> Tổng cộng ~305 stat. Để tra id bất kỳ: `JX.attr[id]` (số→tên) hoặc `JX.attr.indexOf("tên")` (tên→số). Hậu tố `_v`=giá trị tuyệt đối, `_p`=phần trăm, `_b`=cờ bật/tắt.

### Hệ / nguyên tố (`s`, và `JX.series`)

| s | hệ |
|---|-----|
| -1| Không hệ |
| 0 | Kim |
| 1 | Mộc |
| 2 | Thủy |
| 3 | Hỏa |
| 4 | Thổ |

---

## 4. `JX.affix` — bảng affix (phụ lục)

```js
JX.affix[idx] = {
  n:   "Thanh Đồng",     // tên affix
  pre: 1,                // 1 = tiền tố (prefix), 0 = hậu tố (suffix)
  s:   -1,               // giới hạn hệ (-1 = mọi hệ)
  lvl: 1,                // cấp affix
  a:   126,              // statId mà affix cộng (tra JX.attr[126])
  p:   [[5,10],[-1,-1],[6,6]],  // range tham số: mỗi [min,max]; [-1,-1] = bỏ
  d:   "Tăng hiệu quả sát thương",
  w:   [1e5, 1e5, 0, ...]        // trọng số roll theo slot d (w[d])
}
```

- Instance affix (trong `item.mag`): `{a: statId, p: [giá trị đã roll], n: tên, pre: 0/1}`.
- `p` của instance là **giá trị cụ thể** (roll từ range `p` của bảng); `-1` giữ nguyên nếu range là `[-1,-1]`.

---

## 5. Phẩm/màu `r` (`TA` colors)

| r | màu | ghi chú |
|---|-----|---------|
| 0 | trắng | thường (0 affix) |
| 1 | lam  | có affix |
| 2 | cam  | |
| 3 | tím  | |
| 4 | vàng | |
| 5 | lục lam | |

Game mặc định đặt `r = (số affix >= 1 ? 1 : 0)`. Có thể ép `r` qua `addItem(..., {r:4})`.

---

## 6. Tham số `addItem(id, opts)`

### `id` — chọn template, dạng `"d:k:p"` (hoặc `{d,k,p}`)
- Lấy trực tiếp từ cột **`id`** của `listItems()`.
- `d` = slot id (0–10, bảng mục 1); `k` = khóa loại; `p` = variant.
- Nếu `p` sai/thiếu → tự chọn template cùng `k` có `lvl` gần nhất (giống `pn` của game).

### `opts`
| key | kiểu | mặc định | giá trị / lấy ở đâu |
|-----|------|----------|---------------------|
| `s` | số | template.s, hoặc 0 | Hệ 0–4 (mục 3). Vũ khí template thường `-1` → truyền `s` để gán hệ. |
| `lvl` | số | template.lvl | Cấp yêu cầu hiển thị. |
| `enh` | số | (không) | Mức cường hóa `+N`. |
| `r` | số | 1 nếu có affix, else 0 | Phẩm/màu 0–5 (mục 5). |
| `max` | bool | `true` | `true`: base lấy giá trị **max**, affix roll **max**. `false`: giữ range / roll ngẫu nhiên. |
| `affix` | mảng số | `[]` | Danh sách **idx** của `JX.affix`. Lấy từ cột `idx` của `listItems({affix:true})`. Mỗi phần tử roll từ `JX.affix[idx]`. |
| `mag` | mảng obj | `null` | Gắn affix **thủ công**, mỗi phần tử `{a: statId, p: [giá trị], pre?: 0/1, n?: tên}`. `statId` tra `JX.attr` / cột `a` của `listItems({affix:true})`. Nếu truyền `mag` thì bỏ qua `affix`. |

### Nguồn tra cứu nhanh
- `id` (`d:k:p`): `listItems()` / `listItems({slot:'helm'})` / `listItems({q:'tên'})`
- `affix` idx và `a` (statId): `listItems({affix:true})`
- `statId` cho `mag.a` hoặc đọc `base`/`req`: bảng mục 3, hoặc `JX.attr[id]`
- `s` (hệ): mục 3 / `JX.series`

### Ví dụ
```js
listItems({ slot:'helm' })                 // tìm id, vd "7:0:3"
listItems({ affix:true, q:'sát thương' })  // tìm idx affix

addItem('7:0:3')                                   // mão, base max, không affix
addItem('7:0:3', { s:4, affix:[12,40] })           // hệ Thổ + 2 affix (idx 12, 40)
addItem('0:0:5', { enh:9, r:4, mag:[{a:56,p:[200]},{a:51,p:[35]}] }) // vũ khí +9, vàng, 2 affix tay
commit()                                           // BẮT BUỘC để ghi + reload
```

> `addItem` chỉ sửa state trong bộ nhớ — phải `commit()` để ký lại + ghi + đẩy cloud. Hàm hỗ trợ **đồ cơ bản trong `JX.items`**; đồ bộ/platina/vĩnh cửu (`JX.sets`, cờ `set`/`vio`/`ktc`) chưa hỗ trợ.


Giải thích tham số addItem(id, opts) — truyền gì, lấy ở đâu:

id — chọn template, dạng chuỗi "d:k:p" (hoặc object {d,k,p}).

Lấy ở đâu: cột id khi chạy listItems().
d = slot (0–10): 0/1 vũ khí, 2 giáp, 3 nhẫn, 4 dây chuyền, 5 giày, 6 đai, 7 mũ, 8 hộ uyển, 9 ngọc bội, 10 ngựa.
k = khóa loại (vũ khí phân theo loại kiếm/đao…; slot khác thường k=0).
p = variant trong list. Nếu p sai/thiếu, hàm tự chọn template cùng k có lvl gần nhất.
opts (đều tùy chọn):

key	giá trị truyền	lấy ở đâu
s	hệ 0–4 (Kim/Mộc/Thủy/Hỏa/Thổ), hoặc -1 không hệ	JX.series / bảng trong .md. Vũ khí template thường s=-1 nên truyền s để gán hệ
lvl	cấp yêu cầu (số)	tùy ý; mặc định = template.lvl
enh	mức cường hóa +N (số)	tùy ý
r	phẩm/màu 0–5 (0 trắng,1 lam,2 cam,3 tím,4 vàng,5 lục lam)	mặc định 1 nếu có affix, else 0
max	true/false	true (mặc định): base lấy max, affix roll max
affix	mảng idx của JX.affix, vd [12,40]	cột idx của listItems({affix:true})
mag	gắn affix thủ công: [{a: statId, p: [giá trị], pre?:0/1}]	statId tra cột a của listItems({affix:true}) hoặc JX.attr[id]
Thứ tự ưu tiên affix: nếu truyền mag thì dùng mag (bỏ qua affix); không thì roll theo affix; không có cả hai thì item 0 affix.

Nguồn tra cứu gọn:

id → listItems() (lọc {slot:'helm'} hoặc {q:'tên'})
affix idx + a (statId) → listItems({affix:true})
statId cho mag.a, đọc base/req → JX.attr[id] hoặc bảng mục 3 trong .md
s (hệ) → JX.series
Ví dụ:

js

listItems({ slot:'helm' })            // lấy id, vd "7:0:3"
listItems({ affix:true, q:'sát thương' })
addItem('7:0:3', { s:4, affix:[12,40] })
commit()                              // bắt buộc để ghi + reload
Nhớ: addItem chỉ đổi state trong bộ nhớ, phải commit() mới ghi. Hàm hỗ trợ đồ cơ bản trong JX.items; đồ bộ/platina/vĩnh cửu (JX.sets, cờ set/vio/ktc) chưa hỗ trợ.