import React, { useState, useMemo, useEffect } from "react";
import {
  Search, Plus, X, Truck, Car, Wrench, CircleDollarSign,
  ChevronLeft, Pencil, Trash2, ShieldCheck, FileText, Gauge, RotateCcw,
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";

// ---------- Supabase ----------
const supabase = (typeof window !== "undefined" && window.SB_URL && window.SB_ANON)
  ? createClient(window.SB_URL, window.SB_ANON)
  : null;

// ---------- ค่าคงที่ ----------
const CATEGORIES = [
  "เครื่องยนต์", "ช่วงล่าง", "เบรก", "ยาง/ล้อ", "ไฟฟ้า/แบตเตอรี่",
  "แอร์/หม้อน้ำ", "เกียร์/คลัตช์", "ตัวถัง/สี", "บำรุงตามระยะ", "อื่นๆ",
];
const REPEAT_WINDOW_DAYS = 180; // ซ่อมหมวดเดิมภายในกี่วัน = "ซ่อมซ้ำ"
const DUE_SOON_DAYS = 30;       // เตือนครบกำหนดล่วงหน้ากี่วัน
const FARMS = ["บ้านเจ้", "บ้านคุณพร", "เบิกไพร", "วันครู", "ปากท่อ", "ท่าม่วง", "โรงงาน"]; // ที่ตั้ง/ฟาร์ม/กลุ่ม

// ---------- ตัวช่วย ----------
const THB = (n) => (Number(n) || 0).toLocaleString("th-TH", { maximumFractionDigits: 0 });
const fmtDate = (d) => {
  if (!d) return "-";
  const dt = new Date(d + (d.length === 10 ? "T00:00:00" : ""));
  if (isNaN(dt)) return "-";
  return dt.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
};
const todayStr = () => {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
};
const daysUntil = (d) => {
  if (!d) return null;
  const a = new Date(todayStr() + "T00:00:00");
  const b = new Date(d + "T00:00:00");
  if (isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
};
const monthKey = (d) => (d || "").slice(0, 7); // "2026-07"
const fmtMonth = (mk) => {
  if (!mk) return "-";
  const dt = new Date(mk + "-01T00:00:00");
  return dt.toLocaleDateString("th-TH", { month: "long", year: "numeric" });
};

// ---------- รูปรถ 4 มุม ----------
const PHOTO_SLOTS = [["photo_front", "หน้า", "🚘"], ["photo_back", "หลัง", "🔙"], ["photo_left", "ซ้าย", "⬅️"], ["photo_right", "ขวา", "➡️"]];

// ย่อรูปก่อนอัปโหลด (ยาวสุด 1280px, JPEG) — ประหยัดพื้นที่และอัปเร็วบนมือถือ
function shrinkImage(file, maxDim = 1280) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width: w, height: h } = img;
      if (Math.max(w, h) > maxDim) {
        const k = maxDim / Math.max(w, h);
        w = Math.round(w * k); h = Math.round(h * k);
      }
      const cv = document.createElement("canvas");
      cv.width = w; cv.height = h;
      cv.getContext("2d").drawImage(img, 0, 0, w, h);
      cv.toBlob((b) => (b ? resolve(b) : reject(new Error("แปลงรูปไม่สำเร็จ"))), "image/jpeg", 0.85);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error("อ่านไฟล์รูปไม่สำเร็จ"));
    img.src = URL.createObjectURL(file);
  });
}

// ช่องรูป 4 มุมของรถ — กดเพื่ออัปโหลด/เปลี่ยน, กดรูปเพื่อดูเต็ม
function VehiclePhotos({ veh, onSaved }) {
  const [busy, setBusy] = useState("");   // slot ที่กำลังอัปโหลด
  async function upload(slot, file) {
    if (!file) return;
    setBusy(slot);
    try {
      const blob = await shrinkImage(file);
      const path = veh.id + "/" + slot + ".jpg";
      const up = await supabase.storage.from("vehicle-photos").upload(path, blob, { upsert: true, contentType: "image/jpeg" });
      if (up.error) throw up.error;
      const { data } = supabase.storage.from("vehicle-photos").getPublicUrl(path);
      const url = data.publicUrl + "?v=" + Date.now();   // กันเบราว์เซอร์จำรูปเก่า
      const res = await supabase.from("vehicles").update({ [slot]: url }).eq("id", veh.id);
      if (res.error) throw res.error;
      await onSaved();
    } catch (e) { alert("อัปโหลดรูปไม่สำเร็จ: " + (e.message || e)); }
    setBusy("");
  }
  async function removePhoto(slot) {
    if (!confirm("ลบรูปนี้?")) return;
    setBusy(slot);
    try {
      await supabase.storage.from("vehicle-photos").remove([veh.id + "/" + slot + ".jpg"]);
      const res = await supabase.from("vehicles").update({ [slot]: null }).eq("id", veh.id);
      if (res.error) throw res.error;
      await onSaved();
    } catch (e) { alert("ลบรูปไม่สำเร็จ: " + (e.message || e)); }
    setBusy("");
  }
  return (
    <div style={S.card}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#9b917f", marginBottom: 8 }}>📷 รูปรถ 4 มุม (กดช่องเพื่อถ่าย/เลือกรูป · กดรูปเพื่อดูเต็ม)</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 8 }}>
        {PHOTO_SLOTS.map(([slot, label, icon]) => {
          const url = veh[slot];
          return (
            <div key={slot} style={{ position: "relative" }}>
              {url ? (
                <>
                  <img src={url} alt={label} onClick={() => window.open(url.split("?")[0], "_blank")}
                    style={{ width: "100%", height: 110, objectFit: "cover", borderRadius: 10, border: "1px solid #e5dbc9", cursor: "zoom-in", display: "block", opacity: busy === slot ? .4 : 1 }} />
                  <span style={{ position: "absolute", top: 6, left: 6, background: "rgba(60,50,35,.75)", color: "#fff", borderRadius: 6, padding: "1px 8px", fontSize: 12, fontWeight: 700 }}>{label}</span>
                  <label style={{ position: "absolute", bottom: 6, right: 6, background: "rgba(255,255,255,.92)", borderRadius: 7, padding: "2px 8px", fontSize: 12, fontWeight: 700, color: "#7a6f5c", cursor: "pointer", border: "1px solid #e5dbc9" }}>
                    เปลี่ยน
                    <input type="file" accept="image/*" style={{ display: "none" }}
                      onChange={(e) => { upload(slot, e.target.files[0]); e.target.value = ""; }} />
                  </label>
                  <button onClick={() => removePhoto(slot)}
                    style={{ position: "absolute", bottom: 6, left: 6, background: "rgba(255,255,255,.92)", borderRadius: 7, padding: "2px 8px", fontSize: 12, fontWeight: 700, color: "#b4451f", cursor: "pointer", border: "1px solid #e5dbc9" }}>ลบ</button>
                </>
              ) : (
                <label style={{ display: "grid", placeItems: "center", height: 110, borderRadius: 10, border: "2px dashed #e0d5c0", color: "#b0a691", cursor: "pointer", background: "#fdfaf4", textAlign: "center" }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>
                    <div style={{ fontSize: 22 }}>{busy === slot ? "⏳" : icon}</div>
                    {busy === slot ? "กำลังอัปโหลด…" : "+ รูปด้าน" + label}
                  </div>
                  <input type="file" accept="image/*" style={{ display: "none" }}
                    onChange={(e) => { upload(slot, e.target.files[0]); e.target.value = ""; }} />
                </label>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 🚗 กรอบป้ายทะเบียน — โชว์เฉพาะส่วนเลขทะเบียนในกรอบ ข้อความอื่น (วงเล็บ/คำอธิบาย) อยู่นอกกรอบ
function Plate({ text, size }) {
  if (!text) return null;
  const i = text.search(/[\(（\/]/);          // ตัดตรงวงเล็บหรือ /
  const plate = (i > 0 ? text.slice(0, i) : text).trim();
  const rest = i > 0 ? " " + text.slice(i).trim() : "";
  const big = size === "big";
  return (
    <>
      <span style={{
        display: "inline-block", background: "#fff", color: "#2b2b2b",
        border: "2px solid #2b2b2b", borderRadius: big ? 8 : 6,
        boxShadow: "inset 0 0 0 1.5px #fff, inset 0 0 0 2.5px #d9d2c2",
        padding: big ? "2px 12px" : "0px 8px", fontWeight: 800,
        fontSize: big ? "inherit" : "0.95em", lineHeight: 1.5, whiteSpace: "nowrap", verticalAlign: -1,
      }}>{plate}</span>
      {rest && <span style={{ fontWeight: 600, color: "#7a6f5c", fontSize: "0.9em" }}>{rest}</span>}
    </>
  );
}

// ป้ายเตือนวันครบกำหนด
function DueBadge({ label, date }) {
  const dd = daysUntil(date);
  if (dd === null) return null;
  let bg = "#eef7ee", fg = "#3d7a3d", txt = label + " " + fmtDate(date);
  if (dd < 0) { bg = "#fdecea"; fg = "#b4451f"; txt = label + "เลยกำหนด " + Math.abs(dd) + " วัน"; }
  else if (dd <= DUE_SOON_DAYS) { bg = "#fff4e2"; fg = "#b46a1f"; txt = label + "อีก " + dd + " วัน"; }
  else return null; // ยังไกล ไม่ต้องโชว์
  return <span style={{ background: bg, color: fg, borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>{txt}</span>;
}

// ---------- สไตล์กลาง ----------
const S = {
  page: { maxWidth: 1080, margin: "0 auto", padding: "0 14px 90px" },
  card: { background: "#fff", borderRadius: 14, border: "1px solid #eee4d5", padding: 14, boxShadow: "0 1px 2px rgba(0,0,0,.03)" },
  btn: { background: "#E8943A", color: "#fff", border: "none", borderRadius: 10, padding: "10px 16px", fontSize: 15, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 },
  btnGhost: { background: "#fff", color: "#7a6f5c", border: "1px solid #e5dbc9", borderRadius: 10, padding: "9px 14px", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 },
  input: { width: "100%", boxSizing: "border-box", border: "1px solid #e5dbc9", borderRadius: 10, padding: "10px 12px", fontSize: 15, fontFamily: "inherit", background: "#fff" },
  label: { fontSize: 13, fontWeight: 700, color: "#7a6f5c", marginBottom: 4, display: "block" },
  h2: { fontSize: 18, fontWeight: 800, color: "#4c4335", margin: "18px 0 10px" },
};

function Field({ label, children, style }) {
  return <div style={{ marginBottom: 10, ...style }}><label style={S.label}>{label}</label>{children}</div>;
}

// ============================================================
// แอปหลัก
// ============================================================
function App() {
  const [tab, setTab] = useState("fleet");        // fleet | repairs | costs | due
  const [vehicles, setVehicles] = useState([]);
  const [repairs, setRepairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [detailId, setDetailId] = useState(null);  // ดูรถรายคัน
  const [showVehForm, setShowVehForm] = useState(null);   // null | {} | vehicle
  const [showRepForm, setShowRepForm] = useState(null);   // null | {vehicle_id?} | repair
  const [q, setQ] = useState("");

  async function loadAll() {
    if (!supabase) { setErr("ยังไม่ได้ตั้งค่า Supabase (supabase-config.js)"); setLoading(false); return; }
    setLoading(true);
    const [v, r] = await Promise.all([
      supabase.from("vehicles").select("*").order("code", { ascending: true, nullsFirst: false }),
      supabase.from("vehicle_repairs").select("*").order("repair_date", { ascending: false }),
    ]);
    if (v.error) setErr("โหลดข้อมูลรถไม่สำเร็จ: " + v.error.message);
    else setVehicles(v.data || []);
    if (r.error) setErr("โหลดประวัติซ่อมไม่สำเร็จ: " + r.error.message);
    else setRepairs(r.data || []);
    setLoading(false);
  }
  useEffect(() => { loadAll(); }, []);

  // ประวัติซ่อมจัดกลุ่มตามรถ
  const repairsByVeh = useMemo(() => {
    const m = {};
    repairs.forEach((r) => { (m[r.vehicle_id] = m[r.vehicle_id] || []).push(r); });
    return m;
  }, [repairs]);

  // 🔁 ตรวจ "ซ่อมซ้ำ": ซ่อมหมวดเดิม ของรถคันเดิม ภายใน REPEAT_WINDOW_DAYS
  const repeatFlags = useMemo(() => {
    const flags = {}; // repair.id -> รายการครั้งก่อนๆ ในหมวดเดียวกัน
    Object.values(repairsByVeh).forEach((list) => {
      const sorted = [...list].sort((a, b) => (a.repair_date < b.repair_date ? -1 : 1));
      sorted.forEach((r, i) => {
        if (!r.category) return;
        const prev = sorted.slice(0, i).filter((p) =>
          p.category === r.category &&
          (new Date(r.repair_date) - new Date(p.repair_date)) / 86400000 <= REPEAT_WINDOW_DAYS
        );
        if (prev.length) flags[r.id] = prev;
      });
    });
    return flags;
  }, [repairsByVeh]);

  const vehById = useMemo(() => Object.fromEntries(vehicles.map((v) => [v.id, v])), [vehicles]);
  const vehLabel = (v) => (v.code ? v.code + " · " : "") + (v.plate || "") + (v.name ? " (" + v.name + ")" : "");

  // ---------- บันทึก/ลบ ----------
  async function saveVehicle(form) {
    const row = { ...form };
    ["tax_due", "act_due", "insurance_due"].forEach((k) => { if (!row[k]) row[k] = null; });
    row.year = row.year ? Number(row.year) : null;
    let res;
    if (row.id) res = await supabase.from("vehicles").update(row).eq("id", row.id);
    else { delete row.id; res = await supabase.from("vehicles").insert(row); }
    if (res.error) { alert("บันทึกไม่สำเร็จ: " + res.error.message); return false; }
    setShowVehForm(null); await loadAll(); return true;
  }
  async function saveRepair(form) {
    const row = { ...form };
    row.cost = Number(row.cost) || 0;
    row.mileage = row.mileage ? Number(row.mileage) : null;
    let res;
    if (row.id) res = await supabase.from("vehicle_repairs").update(row).eq("id", row.id);
    else { delete row.id; res = await supabase.from("vehicle_repairs").insert(row); }
    if (res.error) { alert("บันทึกไม่สำเร็จ: " + res.error.message); return false; }
    setShowRepForm(null); await loadAll(); return true;
  }
  async function delRepair(r) {
    if (!confirm("ลบรายการซ่อมนี้? (" + (r.parts || "") + ")")) return;
    const res = await supabase.from("vehicle_repairs").delete().eq("id", r.id);
    if (res.error) alert("ลบไม่สำเร็จ: " + res.error.message);
    await loadAll();
  }
  async function toggleVehicleActive(v) {
    const res = await supabase.from("vehicles").update({ active: !v.active }).eq("id", v.id);
    if (res.error) alert("บันทึกไม่สำเร็จ: " + res.error.message);
    await loadAll();
  }

  // ---------- หน้าจอ ----------
  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#8a8170" }}>กำลังโหลดข้อมูล…</div>;

  const detailVeh = detailId ? vehById[detailId] : null;

  return (
    <div style={S.page}>
      {/* หัวเรื่อง */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 0 6px", flexWrap: "wrap" }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: "#E8943A", display: "grid", placeItems: "center", color: "#fff" }}>
          <Truck size={24} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 19, fontWeight: 800, color: "#4c4335" }}>ระบบซ่อมบำรุงรถ · ฟาร์มสมบูรณ์</div>
          <div style={{ fontSize: 13, color: "#9b917f" }}>รถทั้งหมด {vehicles.filter((v) => v.active).length} คัน · มีเอกสาร {vehicles.filter((v) => v.active && v.has_docs !== false).length} · ใช้ภายใน {vehicles.filter((v) => v.active && v.has_docs === false).length}</div>
        </div>
      </div>

      {err && <div style={{ background: "#fdecea", color: "#b4451f", borderRadius: 10, padding: "10px 14px", marginBottom: 10, fontSize: 14 }}>{err}</div>}

      {/* แท็บ */}
      <div style={{ display: "flex", gap: 8, margin: "10px 0 16px", flexWrap: "wrap" }}>
        {[
          ["fleet", "🚚 รายการรถ"],
          ["repairs", "🔧 ประวัติซ่อม"],
          ["costs", "📊 ค่าใช้จ่าย"],
          ["due", "📅 ครบกำหนด"],
        ].map(([k, t]) => (
          <button key={k} onClick={() => { setTab(k); setDetailId(null); }}
            style={{ ...S.btnGhost, ...(tab === k ? { background: "#4c4335", color: "#fff", borderColor: "#4c4335" } : {}) }}>
            {t}
          </button>
        ))}
      </div>

      {detailVeh ? (
        <VehicleDetail veh={detailVeh} repairs={repairsByVeh[detailVeh.id] || []} repeatFlags={repeatFlags}
          onReload={loadAll}
          onBack={() => setDetailId(null)}
          onEdit={() => setShowVehForm(detailVeh)}
          onAddRepair={() => setShowRepForm({ vehicle_id: detailVeh.id })}
          onEditRepair={(r) => setShowRepForm(r)}
          onDelRepair={delRepair}
          onToggleActive={() => toggleVehicleActive(detailVeh)}
        />
      ) : tab === "fleet" ? (
        <FleetTab vehicles={vehicles} repairsByVeh={repairsByVeh} q={q} setQ={setQ}
          onOpen={(v) => setDetailId(v.id)} onAdd={() => setShowVehForm({})} />
      ) : tab === "repairs" ? (
        <RepairsTab repairs={repairs} vehById={vehById} vehLabel={vehLabel} repeatFlags={repeatFlags}
          onAdd={() => setShowRepForm({})} onEdit={(r) => setShowRepForm(r)} onDel={delRepair}
          onOpenVeh={(id) => setDetailId(id)} />
      ) : tab === "costs" ? (
        <CostsTab repairs={repairs} vehById={vehById} vehLabel={vehLabel} onOpenVeh={(id) => setDetailId(id)} />
      ) : (
        <DueTab vehicles={vehicles} onOpenVeh={(id) => setDetailId(id)} />
      )}

      {/* ฟอร์ม */}
      {showVehForm !== null && <VehicleForm init={showVehForm} onSave={saveVehicle} onClose={() => setShowVehForm(null)} />}
      {showRepForm !== null && <RepairForm init={showRepForm} vehicles={vehicles.filter((v) => v.active)} vehLabel={vehLabel}
        repairsByVeh={repairsByVeh} onSave={saveRepair} onClose={() => setShowRepForm(null)} />}
    </div>
  );
}

// ============================================================
// แท็บ: รายการรถ
// ============================================================
function FleetTab({ vehicles, repairsByVeh, q, setQ, onOpen, onAdd }) {
  const [farm, setFarm] = useState("all");
  // เรียงตามลำดับใน FARMS (รถบ้านเจ้ · บ้านคุณพร ขึ้นก่อน) กลุ่มอื่นที่ไม่รู้จักต่อท้าย
  const farmList = [...new Set(vehicles.map((v) => v.farm).filter(Boolean))]
    .sort((a, b) => {
      const ia = FARMS.indexOf(a), ib = FARMS.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  const list = vehicles.filter((v) => {
    if (farm !== "all" && v.farm !== farm) return false;
    if (!q) return true;
    const s = (v.code + " " + v.plate + " " + (v.name || "") + " " + (v.brand || "") + " " + (v.model || "") + " " +
      (v.vin || "") + " " + (v.owner_name || "") + " " + (v.vgroup || "") + " " + (v.farm || "")).toLowerCase();
    return s.includes(q.toLowerCase());
  });
  const active = list.filter((v) => v.active), inactive = list.filter((v) => !v.active);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: 12, color: "#b0a691" }} />
          <input style={{ ...S.input, paddingLeft: 36 }} placeholder="ค้นหา ทะเบียน / เบอร์รถ / ชื่อ / ยี่ห้อ…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button style={S.btn} onClick={onAdd}><Plus size={17} /> เพิ่มรถ</button>
      </div>
      {farmList.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          <button onClick={() => setFarm("all")}
            style={{ ...S.btnGhost, padding: "6px 12px", fontSize: 13.5, ...(farm === "all" ? { background: "#4c4335", color: "#fff", borderColor: "#4c4335" } : {}) }}>
            ทุกที่ ({vehicles.filter((v) => v.active).length})
          </button>
          {farmList.map((f) => (
            <button key={f} onClick={() => setFarm(f)}
              style={{ ...S.btnGhost, padding: "6px 12px", fontSize: 13.5, ...(farm === f ? { background: "#4c4335", color: "#fff", borderColor: "#4c4335" } : {}) }}>
              📍{f} ({vehicles.filter((v) => v.active && v.farm === f).length})
            </button>
          ))}
        </div>
      )}

      {active.length === 0 && <div style={{ ...S.card, textAlign: "center", color: "#9b917f", padding: 30 }}>
        ยังไม่มีรถในระบบ — กด "เพิ่มรถ" เพื่อเริ่มลงทะเบียนรถคันแรก 🚚
      </div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 10 }}>
        {active.map((v) => <VehicleCard key={v.id} v={v} reps={repairsByVeh[v.id] || []} onOpen={() => onOpen(v)} />)}
      </div>

      {inactive.length > 0 && <>
        <div style={S.h2}>รถที่เลิกใช้งาน ({inactive.length})</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 10, opacity: .6 }}>
          {inactive.map((v) => <VehicleCard key={v.id} v={v} reps={repairsByVeh[v.id] || []} onOpen={() => onOpen(v)} />)}
        </div>
      </>}
    </div>
  );
}

function VehicleCard({ v, reps, onOpen }) {
  const last = reps[0];
  const totalYear = reps.filter((r) => monthKey(r.repair_date).slice(0, 4) === todayStr().slice(0, 4))
    .reduce((s, r) => s + (Number(r.cost) || 0), 0);
  return (
    <div style={{ ...S.card, cursor: "pointer" }} onClick={onOpen}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {v.photo_front ? (
          <img src={v.photo_front} alt="" style={{ width: 38, height: 38, borderRadius: 10, objectFit: "cover", flexShrink: 0, border: "1px solid #e5dbc9" }} />
        ) : (
          <div style={{ width: 38, height: 38, borderRadius: 10, background: v.has_docs === false ? "#8fae72" : "#5a4b3a", display: "grid", placeItems: "center", color: "#fff", flexShrink: 0 }}>
            {v.has_docs === false ? <Car size={21} /> : <Truck size={21} />}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, color: "#4c4335", fontSize: 15.5 }}>
            {v.code && <span style={{ color: "#E8943A" }}>{v.code} · </span>}<Plate text={v.plate} />
          </div>
          <div style={{ fontSize: 13, color: "#9b917f", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {[v.farm && "📍" + v.farm, v.vgroup !== v.farm && v.vgroup, v.name, v.brand, v.model].filter(Boolean).join(" · ") || "-"}
          </div>
        </div>
        {v.has_docs === false && <span style={{ background: "#f3ecdf", color: "#9b917f", borderRadius: 999, padding: "2px 8px", fontSize: 11.5, fontWeight: 700, flexShrink: 0 }}>ใช้ภายใน</span>}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
        <DueBadge label="ทะเบียน" date={v.tax_due} />
        <DueBadge label="พ.ร.บ." date={v.act_due} />
        <DueBadge label="ประกัน" date={v.insurance_due} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 13, color: "#7a6f5c" }}>
        <span><Wrench size={13} style={{ verticalAlign: -2 }} /> {last ? "ซ่อมล่าสุด " + fmtDate(last.repair_date) : "ยังไม่มีประวัติซ่อม"}</span>
        <span style={{ fontWeight: 700 }}>ปีนี้ {THB(totalYear)} ฿</span>
      </div>
    </div>
  );
}

// ============================================================
// หน้ารถรายคัน
// ============================================================
function VehicleDetail({ veh, repairs, repeatFlags, onReload, onBack, onEdit, onAddRepair, onEditRepair, onDelRepair, onToggleActive }) {
  const total = repairs.reduce((s, r) => s + (Number(r.cost) || 0), 0);
  const byCat = {};
  repairs.forEach((r) => {
    const c = r.category || "อื่นๆ";
    byCat[c] = byCat[c] || { n: 0, cost: 0 };
    byCat[c].n++; byCat[c].cost += Number(r.cost) || 0;
  });
  const catRows = Object.entries(byCat).sort((a, b) => b[1].cost - a[1].cost);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <button style={S.btnGhost} onClick={onBack}><ChevronLeft size={16} /> กลับ</button>
        <div style={{ flex: 1, fontSize: 18, fontWeight: 800, color: "#4c4335" }}>
          {veh.code && <span style={{ color: "#E8943A" }}>{veh.code} · </span>}<Plate text={veh.plate} size="big" />
          {!veh.active && <span style={{ fontSize: 13, color: "#b4451f", marginLeft: 8 }}>(เลิกใช้งาน)</span>}
        </div>
        <button style={S.btnGhost} onClick={onEdit}><Pencil size={15} /> แก้ไขข้อมูลรถ</button>
        <button style={S.btn} onClick={onAddRepair}><Plus size={17} /> บันทึกซ่อม</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 10, marginBottom: 14 }}>
        <div style={S.card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#9b917f", marginBottom: 6 }}>ข้อมูลรถ</div>
          <table style={{ fontSize: 14, color: "#4c4335", lineHeight: 1.9 }}><tbody>
            <tr><td style={{ color: "#9b917f", paddingRight: 14 }}>เอกสาร</td><td>{veh.has_docs === false ? "🚜 ใช้ภายใน (ไม่มีเอกสาร)" : "📄 มีเอกสาร (จดทะเบียน)"}</td></tr>
            {veh.farm && <tr><td style={{ color: "#9b917f" }}>ที่ตั้ง/ฟาร์ม</td><td>📍{veh.farm}</td></tr>}
            {veh.vgroup && <tr><td style={{ color: "#9b917f" }}>หมวดรถ</td><td>{veh.vgroup}</td></tr>}
            <tr><td style={{ color: "#9b917f" }}>ชื่อเรียก</td><td>{veh.name || "-"}</td></tr>
            <tr><td style={{ color: "#9b917f" }}>ยี่ห้อ/รุ่น</td><td>{[veh.brand, veh.model, veh.year].filter(Boolean).join(" ") || "-"}</td></tr>
            {veh.owner_name && <tr><td style={{ color: "#9b917f" }}>จดนาม/ผู้ใช้</td><td>{veh.owner_name}</td></tr>}
            {veh.vin && <tr><td style={{ color: "#9b917f" }}>เลขตัวถัง</td><td style={{ fontSize: 12.5 }}>{veh.vin}</td></tr>}
            {veh.notes && <tr><td style={{ color: "#9b917f", verticalAlign: "top" }}>หมายเหตุ</td><td>{veh.notes}</td></tr>}
          </tbody></table>
        </div>
        <div style={S.card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#9b917f", marginBottom: 6 }}>ทะเบียน · พ.ร.บ. · ประกันภัย</div>
          <table style={{ fontSize: 14, color: "#4c4335", lineHeight: 1.9 }}><tbody>
            <tr><td style={{ color: "#9b917f", paddingRight: 14 }}><FileText size={14} style={{ verticalAlign: -2 }} /> ต่อทะเบียน</td><td>{fmtDate(veh.tax_due)} <DueBadge label="" date={veh.tax_due} /></td></tr>
            <tr><td style={{ color: "#9b917f" }}><ShieldCheck size={14} style={{ verticalAlign: -2 }} /> พ.ร.บ.</td><td>{fmtDate(veh.act_due)} <DueBadge label="" date={veh.act_due} /></td></tr>
            <tr><td style={{ color: "#9b917f" }}><ShieldCheck size={14} style={{ verticalAlign: -2 }} /> ประกันภัย</td><td>{fmtDate(veh.insurance_due)} <DueBadge label="" date={veh.insurance_due} />{veh.insurance_company ? " · " + veh.insurance_company : ""}{veh.insurance_phone ? " ☎" + veh.insurance_phone : ""}</td></tr>
            {(veh.renew_at || veh.insurance_renew_at) && <tr><td style={{ color: "#9b917f" }}>ต่อที่</td><td>{[veh.renew_at && "ภาษี/พรบ: " + veh.renew_at, veh.insurance_renew_at && "ประกัน: " + veh.insurance_renew_at].filter(Boolean).join(" · ")}</td></tr>}
          </tbody></table>
        </div>
        <div style={S.card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#9b917f", marginBottom: 6 }}>สรุปการซ่อม ({repairs.length} ครั้ง · รวม {THB(total)} ฿)</div>
          {catRows.length === 0 ? <div style={{ fontSize: 14, color: "#9b917f" }}>ยังไม่มีประวัติซ่อม</div> :
            catRows.map(([c, x]) => (
              <div key={c} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, lineHeight: 1.9 }}>
                <span style={{ color: "#4c4335" }}>{c} {x.n >= 3 && <span title="ซ่อมหมวดนี้บ่อย" style={{ color: "#b4451f" }}>⚠️×{x.n}</span>}{x.n < 3 && <span style={{ color: "#9b917f" }}>×{x.n}</span>}</span>
                <span style={{ fontWeight: 700 }}>{THB(x.cost)} ฿</span>
              </div>
            ))}
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <VehiclePhotos veh={veh} onSaved={onReload} />
      </div>

      <div style={S.h2}><Wrench size={17} style={{ verticalAlign: -3 }} /> ประวัติซ่อม (ล่าสุดขึ้นก่อน)</div>
      {repairs.length === 0 && <div style={{ ...S.card, color: "#9b917f", textAlign: "center" }}>ยังไม่มีประวัติซ่อม — กด "บันทึกซ่อม" เพื่อเพิ่มรายการแรก</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {repairs.map((r) => <RepairRow key={r.id} r={r} repeatPrev={repeatFlags[r.id]} onEdit={() => onEditRepair(r)} onDel={() => onDelRepair(r)} />)}
      </div>

      <div style={{ marginTop: 20, textAlign: "right" }}>
        <button style={{ ...S.btnGhost, color: veh.active ? "#b4451f" : "#3d7a3d" }} onClick={onToggleActive}>
          <RotateCcw size={14} /> {veh.active ? "ย้ายไป 'เลิกใช้งาน'" : "นำกลับมาใช้งาน"}
        </button>
      </div>
    </div>
  );
}

function RepairRow({ r, repeatPrev, vehName, onEdit, onDel, onOpenVeh }) {
  return (
    <div style={{ ...S.card, borderLeft: r.status === "pending" ? "4px solid #E8943A" : repeatPrev ? "4px solid #d9534f" : "4px solid #dfd6c4" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: "#4c4335" }}>
            {fmtDate(r.repair_date)}
            {r.category && <span style={{ background: "#f3ecdf", borderRadius: 999, padding: "2px 10px", fontSize: 12.5, fontWeight: 700, color: "#7a6f5c", marginLeft: 8 }}>{r.category}</span>}
            {r.status === "pending" && <span style={{ background: "#fff4e2", color: "#b46a1f", borderRadius: 999, padding: "2px 10px", fontSize: 12.5, fontWeight: 700, marginLeft: 6 }}>⏳ กำลังซ่อม</span>}
            {vehName && <span style={{ color: "#E8943A", marginLeft: 8, cursor: onOpenVeh ? "pointer" : "default", fontSize: 13.5 }} onClick={onOpenVeh}>{vehName}</span>}
          </div>
          <div style={{ fontSize: 14.5, color: "#4c4335", marginTop: 4 }}><b>ซ่อม/เปลี่ยน:</b> {r.parts}</div>
          {r.cause && <div style={{ fontSize: 13.5, color: "#7a6f5c", marginTop: 2 }}><b>สาเหตุ:</b> {r.cause}</div>}
          <div style={{ fontSize: 12.5, color: "#9b917f", marginTop: 3 }}>
            {r.mileage ? <span><Gauge size={12} style={{ verticalAlign: -2 }} /> {THB(r.mileage)} กม. · </span> : null}
            {r.garage ? "อู่: " + r.garage : ""}
            {r.notes ? " · " + r.notes : ""}
          </div>
          {repeatPrev && (
            <div style={{ background: "#fdecea", color: "#b4451f", borderRadius: 8, padding: "6px 10px", fontSize: 13, marginTop: 6 }}>
              ⚠️ <b>ซ่อมซ้ำ!</b> หมวด "{r.category}" เคยซ่อมใน 6 เดือน: {repeatPrev.map((p) => fmtDate(p.repair_date) + " (" + p.parts + (p.cause ? " — " + p.cause : "") + ")").join(" · ")}
            </div>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#4c4335" }}>{THB(r.cost)} ฿</div>
          <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
            <button style={{ ...S.btnGhost, padding: "5px 9px" }} onClick={onEdit}><Pencil size={13} /></button>
            <button style={{ ...S.btnGhost, padding: "5px 9px", color: "#b4451f" }} onClick={onDel}><Trash2 size={13} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// แท็บ: ประวัติซ่อมรวมทุกคัน
// ============================================================
function RepairsTab({ repairs, vehById, vehLabel, repeatFlags, onAdd, onEdit, onDel, onOpenVeh }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const list = repairs.filter((r) => {
    if (cat !== "all" && (r.category || "อื่นๆ") !== cat) return false;
    if (!q) return true;
    const v = vehById[r.vehicle_id];
    const s = ((v ? vehLabel(v) : "") + " " + (r.parts || "") + " " + (r.cause || "") + " " + (r.garage || "")).toLowerCase();
    return s.includes(q.toLowerCase());
  });
  const repeatCount = list.filter((r) => repeatFlags[r.id]).length;

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: 12, color: "#b0a691" }} />
          <input style={{ ...S.input, paddingLeft: 36 }} placeholder="ค้นหา รถ / อาการ / สาเหตุ / อู่…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select style={{ ...S.input, width: "auto" }} value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="all">ทุกหมวด</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button style={S.btn} onClick={onAdd}><Plus size={17} /> บันทึกซ่อม</button>
      </div>
      {repeatCount > 0 && <div style={{ background: "#fdecea", color: "#b4451f", borderRadius: 10, padding: "8px 14px", marginBottom: 10, fontSize: 14 }}>
        ⚠️ พบรายการ <b>ซ่อมซ้ำหมวดเดิมภายใน 6 เดือน</b> {repeatCount} รายการ (ขีดแดงด้านซ้าย) — ควรตรวจหาสาเหตุที่แท้จริง
      </div>}
      {list.length === 0 && <div style={{ ...S.card, color: "#9b917f", textAlign: "center", padding: 30 }}>ยังไม่มีรายการซ่อม</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {list.map((r) => {
          const v = vehById[r.vehicle_id];
          return <RepairRow key={r.id} r={r} repeatPrev={repeatFlags[r.id]}
            vehName={v ? "🚚 " + vehLabel(v) : "(ไม่พบรถ)"}
            onOpenVeh={() => v && onOpenVeh(v.id)}
            onEdit={() => onEdit(r)} onDel={() => onDel(r)} />;
        })}
      </div>
    </div>
  );
}

// ============================================================
// แท็บ: สรุปค่าใช้จ่าย
// ============================================================
function CostsTab({ repairs, vehById, vehLabel, onOpenVeh }) {
  const months = useMemo(() => {
    const m = {};
    repairs.forEach((r) => {
      const mk = monthKey(r.repair_date);
      m[mk] = m[mk] || { total: 0, heavy: 0, light: 0, n: 0 };
      const cost = Number(r.cost) || 0;
      m[mk].total += cost; m[mk].n++;
      const v = vehById[r.vehicle_id];
      if (v && v.vtype === "light") m[mk].light += cost; else m[mk].heavy += cost;
    });
    return Object.entries(m).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [repairs, vehById]);

  const [selMonth, setSelMonth] = useState(null);
  const curMonth = selMonth || (months[0] ? months[0][0] : monthKey(todayStr()));

  const monthRepairs = repairs.filter((r) => monthKey(r.repair_date) === curMonth);
  const byVeh = {};
  monthRepairs.forEach((r) => {
    byVeh[r.vehicle_id] = byVeh[r.vehicle_id] || { cost: 0, n: 0 };
    byVeh[r.vehicle_id].cost += Number(r.cost) || 0; byVeh[r.vehicle_id].n++;
  });
  const vehRows = Object.entries(byVeh).sort((a, b) => b[1].cost - a[1].cost);
  const maxBar = months.length ? Math.max(...months.map(([, x]) => x.total)) : 1;

  return (
    <div>
      <div style={S.h2}><CircleDollarSign size={17} style={{ verticalAlign: -3 }} /> ค่าซ่อมรายเดือน (กดเดือนเพื่อดูรายละเอียด)</div>
      {months.length === 0 && <div style={{ ...S.card, color: "#9b917f", textAlign: "center", padding: 30 }}>ยังไม่มีข้อมูลค่าใช้จ่าย</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {months.slice(0, 13).map(([mk, x]) => (
          <div key={mk} onClick={() => setSelMonth(mk)}
            style={{ ...S.card, padding: "10px 14px", cursor: "pointer", ...(mk === curMonth ? { borderColor: "#E8943A", background: "#fffaf2" } : {}) }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14.5, fontWeight: 700, color: "#4c4335" }}>
              <span>{fmtMonth(mk)} <span style={{ color: "#9b917f", fontWeight: 400 }}>({x.n} รายการ)</span></span>
              <span>{THB(x.total)} ฿</span>
            </div>
            <div style={{ height: 8, borderRadius: 5, background: "#E8943A", marginTop: 6, width: (100 * x.total / maxBar) + "%", minWidth: 40 }} />
          </div>
        ))}
      </div>

      {vehRows.length > 0 && <>
        <div style={S.h2}>รถที่มีค่าซ่อมสูงสุด — {fmtMonth(curMonth)}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {vehRows.map(([vid, x], i) => {
            const v = vehById[vid];
            return (
              <div key={vid} style={{ ...S.card, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                onClick={() => v && onOpenVeh(vid)}>
                <span style={{ fontSize: 14.5, color: "#4c4335" }}>
                  <b style={{ color: i === 0 ? "#b4451f" : "#9b917f", marginRight: 8 }}>#{i + 1}</b>
                  {v ? vehLabel(v) : "(ไม่พบรถ)"} <span style={{ color: "#9b917f" }}>· {x.n} รายการ</span>
                </span>
                <b style={{ color: "#4c4335" }}>{THB(x.cost)} ฿</b>
              </div>
            );
          })}
        </div>
      </>}
    </div>
  );
}

// ============================================================
// แท็บ: ครบกำหนด ทะเบียน/พ.ร.บ./ประกัน
// ============================================================
function DueTab({ vehicles, onOpenVeh }) {
  const items = [];
  vehicles.filter((v) => v.active).forEach((v) => {
    [["tax_due", "ต่อทะเบียน/ภาษี", "📄"], ["act_due", "พ.ร.บ.", "🛡️"], ["insurance_due", "ประกันภัย", "🛡️"]].forEach(([k, label, icon]) => {
      const dd = daysUntil(v[k]);
      if (dd !== null) items.push({ v, k, label, icon, date: v[k], dd });
    });
  });
  items.sort((a, b) => a.dd - b.dd);
  const overdue = items.filter((x) => x.dd < 0);
  const soon = items.filter((x) => x.dd >= 0 && x.dd <= DUE_SOON_DAYS);
  const later = items.filter((x) => x.dd > DUE_SOON_DAYS);

  const Row = ({ x }) => (
    <div style={{ ...S.card, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", flexWrap: "wrap", gap: 6 }}
      onClick={() => onOpenVeh(x.v.id)}>
      <span style={{ fontSize: 14.5, color: "#4c4335" }}>
        {x.icon} <b>{x.label}</b> — {(x.v.code ? x.v.code + " · " : "") + x.v.plate}{x.v.name ? " (" + x.v.name + ")" : ""}
        {x.k === "insurance_due" && x.v.insurance_company ? <span style={{ color: "#9b917f" }}> · {x.v.insurance_company}</span> : null}
      </span>
      <span style={{ fontSize: 13.5, fontWeight: 700, color: x.dd < 0 ? "#b4451f" : x.dd <= DUE_SOON_DAYS ? "#b46a1f" : "#3d7a3d" }}>
        {fmtDate(x.date)} · {x.dd < 0 ? "เลยมา " + Math.abs(x.dd) + " วัน" : x.dd === 0 ? "วันนี้!" : "อีก " + x.dd + " วัน"}
      </span>
    </div>
  );

  return (
    <div>
      {items.length === 0 && <div style={{ ...S.card, color: "#9b917f", textAlign: "center", padding: 30 }}>
        ยังไม่มีข้อมูลวันครบกำหนด — ใส่วันที่ในหน้า "แก้ไขข้อมูลรถ" ของแต่ละคัน
      </div>}
      {overdue.length > 0 && <><div style={{ ...S.h2, color: "#b4451f" }}>🔴 เลยกำหนดแล้ว ({overdue.length})</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{overdue.map((x, i) => <Row key={i} x={x} />)}</div></>}
      {soon.length > 0 && <><div style={{ ...S.h2, color: "#b46a1f" }}>🟠 ใกล้ครบกำหนด ภายใน {DUE_SOON_DAYS} วัน ({soon.length})</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{soon.map((x, i) => <Row key={i} x={x} />)}</div></>}
      {later.length > 0 && <><div style={S.h2}>🟢 ยังไม่ถึงกำหนด ({later.length})</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{later.map((x, i) => <Row key={i} x={x} />)}</div></>}
    </div>
  );
}

// ============================================================
// ฟอร์ม: เพิ่ม/แก้ไขรถ
// ============================================================
function Modal({ title, children, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(60,50,35,.45)", display: "grid", placeItems: "center", padding: 14, zIndex: 50 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 18, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: "#4c4335" }}>{title}</div>
          <button style={{ ...S.btnGhost, padding: "6px 10px" }} onClick={onClose}><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function VehicleForm({ init, onSave, onClose }) {
  const [f, setF] = useState({
    id: init.id || null, code: init.code || "", plate: init.plate || "", name: init.name || "",
    vtype: init.vtype || "heavy", brand: init.brand || "", model: init.model || "", year: init.year || "",
    farm: init.farm || "", vgroup: init.vgroup || "", vin: init.vin || "", owner_name: init.owner_name || "",
    renew_at: init.renew_at || "", insurance_renew_at: init.insurance_renew_at || "",
    insurance_phone: init.insurance_phone || "", has_docs: init.has_docs !== false,
    tax_due: init.tax_due || "", act_due: init.act_due || "", insurance_due: init.insurance_due || "",
    insurance_company: init.insurance_company || "", notes: init.notes || "", active: init.active !== false,
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const [saving, setSaving] = useState(false);
  return (
    <Modal title={f.id ? "แก้ไขข้อมูลรถ" : "เพิ่มรถใหม่"} onClose={onClose}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 10px" }}>
        <Field label="เบอร์รถ (รหัสภายใน)"><input style={S.input} placeholder="เช่น H-01" value={f.code} onChange={set("code")} /></Field>
        <Field label="ทะเบียนรถ *"><input style={S.input} placeholder="เช่น 82-1234 สระบุรี" value={f.plate} onChange={set("plate")} /></Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 10px" }}>
        <Field label="📍 ที่ตั้ง/ฟาร์ม">
          <select style={S.input} value={f.farm} onChange={set("farm")}>
            <option value="">— ไม่ระบุ —</option>
            {FARMS.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </Field>
        <Field label="หมวดรถ"><input style={S.input} placeholder="เช่น รถเล็ก / รถใหญ่ / รถเครน" value={f.vgroup} onChange={set("vgroup")} /></Field>
      </div>
      <Field label="เอกสารรถ">
        <div style={{ display: "flex", gap: 8 }}>
          {[[true, "📄 มีเอกสาร (จดทะเบียน)"], [false, "🚜 ใช้ภายใน ไม่มีเอกสาร"]].map(([k, t]) => (
            <button key={String(k)} type="button" onClick={() => setF({ ...f, has_docs: k })}
              style={{ ...S.btnGhost, flex: 1, justifyContent: "center", ...(f.has_docs === k ? { background: "#4c4335", color: "#fff", borderColor: "#4c4335" } : {}) }}>{t}</button>
          ))}
        </div>
      </Field>
      <Field label="ชื่อเรียก / ลักษณะการใช้งาน"><input style={S.input} placeholder="เช่น สิบล้อขนอาหาร 1" value={f.name} onChange={set("name")} /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 90px", gap: "0 10px" }}>
        <Field label="ยี่ห้อ"><input style={S.input} placeholder="Isuzu" value={f.brand} onChange={set("brand")} /></Field>
        <Field label="รุ่น"><input style={S.input} placeholder="FTR" value={f.model} onChange={set("model")} /></Field>
        <Field label="ปีรถ"><input style={S.input} type="number" placeholder="2560" value={f.year} onChange={set("year")} /></Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 10px" }}>
        <Field label="จดนาม/เล่มรถ หรือ ผู้ใช้"><input style={S.input} placeholder="เช่น บจ.เอสเจเอฟ / ช่างต้า" value={f.owner_name} onChange={set("owner_name")} /></Field>
        <Field label="เลขตัวถัง"><input style={S.input} value={f.vin} onChange={set("vin")} /></Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 10px" }}>
        <Field label="📄 ครบกำหนดต่อทะเบียน/ภาษี"><input style={S.input} type="date" value={f.tax_due} onChange={set("tax_due")} /></Field>
        <Field label="🛡️ ครบกำหนด พ.ร.บ."><input style={S.input} type="date" value={f.act_due} onChange={set("act_due")} /></Field>
        <Field label="🛡️ ครบกำหนดประกันภัย"><input style={S.input} type="date" value={f.insurance_due} onChange={set("insurance_due")} /></Field>
        <Field label="บริษัทประกัน"><input style={S.input} placeholder="เช่น วิริยะ" value={f.insurance_company} onChange={set("insurance_company")} /></Field>
        <Field label="เบอร์ประกัน"><input style={S.input} placeholder="เช่น 1557" value={f.insurance_phone} onChange={set("insurance_phone")} /></Field>
        <Field label="ต่อภาษี/พรบ ที่"><input style={S.input} placeholder="เช่น ไทรงาม / เจ้ต๊ะ" value={f.renew_at} onChange={set("renew_at")} /></Field>
        <Field label="ต่อประกันที่"><input style={S.input} placeholder="เช่น ไทรงาม" value={f.insurance_renew_at} onChange={set("insurance_renew_at")} /></Field>
      </div>
      <Field label="หมายเหตุ"><textarea style={{ ...S.input, minHeight: 54 }} value={f.notes} onChange={set("notes")} /></Field>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
        <button style={S.btnGhost} onClick={onClose}>ยกเลิก</button>
        <button style={{ ...S.btn, opacity: saving || !f.plate.trim() ? .5 : 1 }} disabled={saving || !f.plate.trim()}
          onClick={async () => { setSaving(true); const ok = await onSave(f); if (!ok) setSaving(false); }}>
          บันทึก
        </button>
      </div>
    </Modal>
  );
}

// ============================================================
// ฟอร์ม: บันทึกซ่อม
// ============================================================
function RepairForm({ init, vehicles, vehLabel, repairsByVeh, onSave, onClose }) {
  const [f, setF] = useState({
    id: init.id || null, vehicle_id: init.vehicle_id || "",
    repair_date: init.repair_date || todayStr(), mileage: init.mileage || "",
    category: init.category || "", parts: init.parts || "", cause: init.cause || "",
    garage: init.garage || "", cost: init.cost || "", status: init.status || "done", notes: init.notes || "",
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const [saving, setSaving] = useState(false);

  // 💡 โชว์ประวัติหมวดเดียวกันของรถคันนี้ทันทีตอนกรอก — เห็นเลยว่าเคยซ่อมเรื่องนี้มาก่อนไหม
  const history = (repairsByVeh[f.vehicle_id] || []).filter((r) => r.id !== f.id && (!f.category || r.category === f.category)).slice(0, 5);

  return (
    <Modal title={f.id ? "แก้ไขรายการซ่อม" : "บันทึกซ่อมใหม่"} onClose={onClose}>
      <Field label="รถ *">
        <select style={S.input} value={f.vehicle_id} onChange={set("vehicle_id")}>
          <option value="">— เลือกรถ —</option>
          {vehicles.map((v) => <option key={v.id} value={v.id}>{vehLabel(v)}</option>)}
        </select>
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 10px" }}>
        <Field label="วันที่ซ่อม"><input style={S.input} type="date" value={f.repair_date} onChange={set("repair_date")} /></Field>
        <Field label="เลขไมล์ (กม.)"><input style={S.input} type="number" placeholder="เช่น 152000" value={f.mileage} onChange={set("mileage")} /></Field>
      </div>
      <Field label="หมวดการซ่อม">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {CATEGORIES.map((c) => (
            <button key={c} type="button" onClick={() => setF({ ...f, category: f.category === c ? "" : c })}
              style={{ ...S.btnGhost, padding: "6px 12px", fontSize: 13.5, ...(f.category === c ? { background: "#E8943A", color: "#fff", borderColor: "#E8943A" } : {}) }}>{c}</button>
          ))}
        </div>
      </Field>
      {f.vehicle_id && history.length > 0 && (
        <div style={{ background: "#fff8ec", border: "1px solid #f0e2c8", borderRadius: 10, padding: "8px 12px", marginBottom: 10, fontSize: 13 }}>
          <b style={{ color: "#b46a1f" }}>📌 ประวัติ{f.category ? "หมวด " + f.category : ""}ของรถคันนี้:</b>
          {history.map((r) => (
            <div key={r.id} style={{ color: "#7a6f5c", marginTop: 3 }}>
              • {fmtDate(r.repair_date)} — {r.parts}{r.cause ? " (สาเหตุ: " + r.cause + ")" : ""} · {THB(r.cost)} ฿
            </div>
          ))}
        </div>
      )}
      <Field label="ซ่อม/เปลี่ยนอะไร *"><input style={S.input} placeholder="เช่น เปลี่ยนผ้าเบรกหน้า 2 ข้าง" value={f.parts} onChange={set("parts")} /></Field>
      <Field label="สาเหตุที่เสีย (สำคัญ — ช่วยกันซ่อมซ้ำ)"><input style={S.input} placeholder="เช่น บรรทุกหนักเกิน / ลุยน้ำ / เสื่อมตามอายุ" value={f.cause} onChange={set("cause")} /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 10px" }}>
        <Field label="อู่/ช่างที่ซ่อม"><input style={S.input} placeholder="เช่น อู่ช่างเดชา" value={f.garage} onChange={set("garage")} /></Field>
        <Field label="ค่าใช้จ่าย (บาท)"><input style={S.input} type="number" placeholder="0" value={f.cost} onChange={set("cost")} /></Field>
      </div>
      <Field label="สถานะ">
        <div style={{ display: "flex", gap: 8 }}>
          {[["done", "✅ ซ่อมเสร็จแล้ว"], ["pending", "⏳ กำลังซ่อม"]].map(([k, t]) => (
            <button key={k} type="button" onClick={() => setF({ ...f, status: k })}
              style={{ ...S.btnGhost, flex: 1, justifyContent: "center", ...(f.status === k ? { background: "#4c4335", color: "#fff", borderColor: "#4c4335" } : {}) }}>{t}</button>
          ))}
        </div>
      </Field>
      <Field label="หมายเหตุ"><input style={S.input} value={f.notes} onChange={set("notes")} /></Field>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
        <button style={S.btnGhost} onClick={onClose}>ยกเลิก</button>
        <button style={{ ...S.btn, opacity: saving || !f.vehicle_id || !f.parts.trim() ? .5 : 1 }} disabled={saving || !f.vehicle_id || !f.parts.trim()}
          onClick={async () => { setSaving(true); const ok = await onSave(f); if (!ok) setSaving(false); }}>
          บันทึก
        </button>
      </div>
    </Modal>
  );
}

// ---------- เริ่มแอป ----------
import { createRoot } from "react-dom/client";
const boot = document.getElementById("boot");
if (boot) boot.remove();
createRoot(document.getElementById("root")).render(<App />);
