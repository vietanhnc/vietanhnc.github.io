# 📋 TÀI LIỆU CẤU TRÚC GAME - VOLAMIDLE (CLIENT SOURCE)

## 1. TỔNG QUAN

Dự án là một game idle/MMORPG theo phong cách võ thuật Trung cổ (Võ lâm), được phát triển bằng JavaScript thuần, chạy trên trình duyệt web. Mã nguồn client nằm trong thư mục:

```
client/volamidle.pages.dev/volamidle.pages.dev/
```

### Các tệp chính đã xác định:
- `data.js` - Dữ liệu cốt lõi của game (thuộc tính, kỹ năng, môn phái, NPC, vật phẩm...)
- `setvi.js` - Dịch tên bộ trang thiết bị từ Trung sang Việt
- `vlidle-dev-console.js` - Console phát triển cho game

---

## 2. CẤU TRÚC DỮ LIỆU CỐT LÕI (data.js)

Tệp `data.js` định nghĩa đối tượng global `window.JX` chứa toàn bộ dữ liệu game. Cấu trúc chính bao gồm:

### 2.1. Ngũ Hành (series)
```javascript
series: ["Kim", "Mộc", "Thủy", "Hỏa", "Thổ"]
```
- 0: Kim (Kim)
- 1: Mộc (Wood)
- 2: Thủy (Water)
- 3: Hỏa (Fire)
- 4: Thổ (Earth)

### 2.2. Thuộc tính (attr)
Danh sách hơn 300 thuộc tính game, mỗi thuộc tính có:
- **Tên mã**: ví dụ `weapondamagemin_v`, `lifemax_v`, `physicsenhance_p`
- **Mô tả (attrDesc)**: Cú pháp hiển thị bằng tiếng Việt, ví dụ:
  - `"Sát thương nhỏ nhất: #d1- điểm"`
  - `"Sinh lực tối đa: #d1+ điểm"`
  - `"Tốc độ đánh - ngoại công: #d1+%"`

**Nhóm thuộc tính chính:**
| Nhóm | Mô tả |
|------|-------|
| `skill_*` | Thuộc tính kỹ năng |
| `missle_*` | Thuộc tính tên lửa/dân |
| `item_*` | Thuộc tính vật phẩm |
| `damage_*` | Thuộc tính sát thương |
| `normal_*` | Thuộc tính cơ bản (máu, nội, thể, công...) |
| `missle_exp_*` | Thuộc tính tên lửa mở rộng |

### 2.3. Môn phái (factions)
Có 11 môn phái, mỗi môn có:
- `id`: Mã số
- `key`: Mã khóa (shaolin, tianwang, tangmen, wudu, emei, cuiyan, gaibang, tianren, wudang, kunlun, huashan)
- `n`: Tên môn phái (tiếng Việt)
- `series`: Ngũ hành thuộc về (0-4 hoặc -1)
- `camp`: Phe (C_JUSTICE, C_BALANCE, C_EVIL)
- `skills`: Danh sách ID kỹ năng của môn

**Danh sách môn phái:**
| ID | Key | Tên | Ngũ hành | Phe |
|----|-----|-----|----------|-----|
| 0 | shaolin | Thiếu Lâm phái | 0 | C_JUSTICE |
| 1 | tianwang | Thiên Vương Bang | 0 | C_BALANCE |
| 2 | tangmen | Đường Môn | 1 | C_BALANCE |
| 3 | wudu | Ngũ Độc Giáo | 1 | C_EVIL |
| 4 | emei | Nga My phái | 2 | C_JUSTICE |
| 5 | cuiyan | Thúy Yên môn | 2 | C_BALANCE |
| 6 | gaibang | Cái Bang | 3 | C_JUSTICE |
| 7 | tianren | Thiên Nhẫn Giáo | 3 | C_EVIL |
| 8 | wudang | Võ Đang phái | 4 | C_JUSTICE |
| 9 | kunlun | Côn Lôn phái | 4 | C_BALANCE |
| 10 | huashan | Hoa Sơn phái | 2 | C_BALANCE |

### 2.4. Kỹ năng (skills)
Dùng hàng trăm kỹ năng, mỗi kỹ năng có cấu trúc:

```javascript
{
  id: number,           // Mã kỹ năng
  n: string,            // Tên kỹ năng
  d: string,            // Mô tả
  prop: string,         // Loại kỹ năng (Công kích ngoại công, Hỗ trợ bị động, etc.)
  f: string,            // Môn phái sở hữu
  series: number,       // Ngũ hành (-1 = trung lập)
  req: number,          // Cấp yêu cầu
  max: number,          // Cấp tối đa
  style: number,        // Kiểu kỹ năng
  melee: number,        // Cận chiến (1) hay tầm xa (0)
  phys: number,         // Ngoại công (1) hay nội công (0)
  aura: number,         // Halo/Aura (1/0)
  radius: number,       // Bán kính tác động
  child: number,        // ID skill con
  childN: number,       // Số lượng skill con
  form: number,         // Hình thức triển khai
  hurt: number,         // Tỷ lệ sát thương cơ bản
  enemy: number,        // Tác động vào địch (1/0)
  self: number,         // Tác động vào bản thân (1/0)
  weapon: number,       // Yêu cầu vũ khí (1/0)
  eqt: number,          // Loại vũ khí yêu cầu
  cost: number,         // Chi phí triển khai
  wait: number,         // Thời gian hồi chiêu
  attr: object,         // Thuộc tính kỹ năng tăng theo cấp
  learn: string,        // Điều kiện học
  ic: string            // Biểu tượng kỹ năng
}
```

**Các loại kỹ năng (prop):**
- Công kích ngoại công
- Công kích nội công
- Hỗ trợ bị động
- Hỗ trợ phòng ngự - bị động
- Hỗ trợ phòng ngự - chủ động
- Chủ động hỗ trợ công kích
- Chủ động hỗ trợ chiến đấu
- Vòng tròn hỗ trợ chiến đấu
- Vòng tròn hồi phục thuộc tính
- Vòng tròn tăng cường thuộc tính

**Ví dụ kỹ năng Thiếu Lâm (ID 4 - Thiếu Lâm Côn pháp):**
- Tăng sát thương vật lý, độ chính xác, chí mạng theo cấp
- Yêu cầu trang bị côn (eqt: 2)
- Cấp tối đa 20

### 2.5. NPC (npcs)
Dùng hàng trăm NPC, mỗi NPC có:
- `id`: Mã số
- `n`: Tên NPC
- `res`: Tài nguyên hình ảnh/animation
- `Camp`: Phe (5 = quái vật, 6 = shi enemy, 1 = Tống, 2 = Kim...)
- `Treasure`: Mức độ rơi đồ
- `LifeParam`, `ARParam`, `DefenseParam`, `MinDamageParam`, `MaxDamageParam`: Tham số chỉ số
- `WalkSpeed`, `RunSpeed`: Tốc độ di chuyển
- `AttackSpeed`, `CastSpeed`: Tốc độ tấn công, triển khai chiêu
- `AIMode`: Chế độ AI (1, 2, 3, 4, 6, 7, 8, 11, 12, 13, 14, 15, 16, 17, 700...)
- `Stature`: Kích thước
- `FireResistMax`, `ColdResistMax`, `LightResistMax`, `PoisonResistMax`, `PhysicsResistMax`: Kháng tính tối đa
- `sk`: Danh sách kỹ năng NPC sử dụng `[[skillId, level], ...]`

**Loại NPC chính:**
- Quái vật tự nhiên (hổ, báo, sói, rắn, côn trùng...)
- NPC phe Tống/Kim (quân đội, quan viên)
- Boss môn phái (Thiếu Lâm, Võ Đang, Nga Mi, Côn Lôn, Cái Bang, Thiên Vương, Ngũ Độc, Thiên Nhẫn)
- NPC thương mại (thợ rèn, dược sĩ, chủ sòng bạc, chủ tửu điếm...)
- NPC sự kiện (Giáng Sinh, boss đặc biệt...)

---

## 3. DỊCH DỮ LIỆU (setvi.js)

Tệp `setvi.js` chứa đối tượng `window.SET_VI` dùng để dịch tên bộ trang thiết bị từ tiếng Trung sang tiếng Việt.

**Cấu trúc:**
```javascript
window.SET_VI = {
  "Tên Trung": "Tên Việt",
  ...
}
```

**Các bộ trang thiết bị được dịch:**
- Phục Ma (伏魔)
- Tứ Không (四空)
- Hám Thiên (撼天)
- Kế Nghiệp (继业)
- Ngự Long (御龙)
- Vô Gian (无间)
- Vô Ma (无魇)
- Tê Hoàng (栖凰)
- Bích Hải (碧海)
- U Lung (幽胧)
- Minh Ảo (冥幻)
- Băng Hàn (冰寒)
- Thiên Quang (天光)
- Sâm Hoang (森荒)
- Đồng Cừu (同仇)
- Địch Khái (敌忾)
- Ma Sát (魔煞)
- Ma Thị (魔嗜)
- Lăng Nhạc (凌岳)
- Cập Phong (及丰)
- Sương Tinh (霜晶)
- Lôi Khung (雷穹)
- Vụ Ảo (雾幻)
- Vô Trần (无尘)
- Chú Phược (咒缚)
- Địa Phách (地魄)
- Ma Hoàng (魔煌)
- Vô Cực (无极)
- Hạn Thời Bạch Kim (限时白金) - Bộ bạch kim hạn thời
- Tống Kim (宋金) - Bộ Tống Kim

**Hàm dịch:**
```javascript
window.setNameVi = function(h) {
  const n = /^(\[(?:Thiên Tứ|Bạch Kim)\]\s*)?(.*)$/.exec(h);
  return n && SET_VI[n[2]] ? (n[1] || "") + SET_VI[n[2]] : h;
};
```

Sau đó áp dụng dịch cho tất cả tên bộ trang thiết bị trong `JX.sets.gold` và `JX.sets.platina`.

---

## 4. KIẾN TRÚC GAME

### 4.1. Luồng dữ liệu
```
window.JX (dữ liệu cốt lõi)
  ├── series (ngũ hành)
  ├── attr (thuộc tính + mô tả)
  ├── factions (môn phái + kỹ năng)
  ├── skills (chi tiết từng kỹ năng)
  ├── npcs (danh sách NPC)
  └── sets (bộ trang thiết bị - được dịch bởi setvi.js)
```

### 4.2. Hệ thống chiến đấu
- Kỹ năng có loại: ngoại công, nội công, hỗ trợ, phòng ngự
- Mỗi kỹ năng có cấp độ (1-20 hoặc 1-30)
- Thuộc tính kỹ năng tăng theo cấp (mảng giá trị)
- Chi phí triển khai (cost) và thời gian hồi (wait)
- Hỗ trợ skill con (child) và skill liên kết (addskilldamage)

### 4.3. Hệ thống nhân vật
- Thuộc tính cơ bản: Sinh lực, Nội lực, Thể lực, Sức mạnh, Thân pháp, Sinh khí, Nội công
- Kháng tính: Băng, Hỏa, Lôi, Độc, Vật lý, Tất cả
- Sát thương: Vật lý, Băng, Hỏa, Lôi, Độc, Ngũ hành
- Tấn công chí mạng, chí tử, choáng, đẩy lùi...
- Tốc độ di chuyển, tấn công, triển khai chiêu

### 4.4. Hệ thống môn phái
- 11 môn phái với kỹ năng riêng
- Mỗi môn thuộc một ngũ hành và một phe (Chính đạo, Cân bằng, Tà đạo)
- Yêu cầu trang bị vũ khí phù hợp với môn phái

---

## 5. CÁC THUỘT TÍNH QUAN TRỌNG

| Thuộc tính | Mô tả |
|------------|-------|
| `weapondamagemin_v` / `weapondamagemax_v` | Sát thương vũ khí min/max |
| `armordefense_v` | Né tránh |
| `lifemax_v` / `lifemax_p` | Sinh lực tối đa |
| `manamax_v` / `manamax_p` | Nội lực tối đa |
| `staminamax_v` / `staminamax_p` | Thể lực tối đa |
| `strength_v` | Sức mạnh |
| `dexterity_v` | Thân pháp |
| `vitality_v` | Sinh khí |
| `energy_v` | Nội công |
| `physicsenhance_p` | Tăng sát thương vật lý % |
| `physicsdamage_v` | Sát thương vật lý |
| `colddamage_v` | Băng sát |
| `firedamage_v` | Hỏa sát |
| `lightingdamage_v` | Lôi sát |
| `poisondamage_v` | Độc sát |
| `attackrating_v` / `attackrating_p` | Độ chính xác |
| `deadlystrike_p` | Tấn công chí mạng % |
| `fatallystrike_p` | Tấn công chí tử % |
| `stun_p` | Làm choáng % |
| `allres_p` | Kháng tất cả % |
| `attackspeed_v` | Tốc độ đánh ngoại công |
| `castspeed_v` | Tốc độ đánh nội công |
| `fastwalkrun_p` | Tốc độ di chuyển |

---

## 6. KẾT LUẬN

Game "Võ Lâm Idle" có cấu trúc dữ liệu tập trung trong `window.JX` với:
- **Dữ liệu tĩnh**: Thuộc tính, môn phái, kỹ năng, NPC
- **Hệ thống dịch**: Dùng `setvi.js` để bản địa hóa tên vật phẩm
- **Kiến trúc**: JavaScript thuần, chạy trên trình duyệt, không cần framework nặng

Tất cả dữ liệu game được định nghĩa sẵn trong `data.js`, giúp dễ dàng mở rộng và bảo trì nội dung game.

---
*Tài liệu được tạo tự động từ phân tích mã nguồn client tại `client/volamidle.pages.dev/volamidle.pages.dev/`*