import { useState, useEffect } from "react";
import {
  collection, doc, onSnapshot,
  setDoc, deleteDoc, writeBatch
} from "firebase/firestore";
import { db } from "./firebase";

// ── STATIC DATA ───────────────────────────────────────────────────────────────
const POSITIONS = {
  Front: ["Adirana","Alexander","Annika","Baleria","Benjamin","Blake","Brayden","Brianna","Carol","Elena","Ella","Gabby","Haley","Helene","Inyla","Jalo","Jeremy","Jessica","Joshua","Kate","Landon","Lavina","Lisa","Maddux","Nathan","Quamari","Ryley","Shannon","Sienna","Sophia","Tyler","Yohana"],
  Back:  ["Abril","Alberto","Andres","Blanca","Chris","Corey","Dayberth","Daylimar","Erika","Estelle","Gregg","Iqra","Jessy","Jofonda","Kaitlyn","Kieran","Laura","Maria","Mario","Nairym","Yenetzzy","Wisler"]
};

const RUBRIC = [
  { category: "Compliance / Sales",        task: "Smart Shops – per compliant item",        points: 1,   deduct: -10 },
  { category: "Compliance / Sales",        task: "Make % goal for sales each day",          points: 5,   deduct: null },
  { category: "Cleaning / Operations",     task: "Cleaning list completed weekly",          points: 10,  deduct: -20 },
  { category: "Cleaning / Operations",     task: "CEM % Change",                           points: 5,   deduct: -10 },
  { category: "Cleaning / Operations",     task: "RQA completed daily",                    points: 10,  deduct: null },
  { category: "Teamwork / Flexibility",    task: "Coming in when asked by director",       points: 20,  deduct: null },
  { category: "Teamwork / Flexibility",    task: "Staying later when asked by director",   points: 10,  deduct: null },
  { category: "Attitude / Effort",         task: "Observed going second mile",             points: 10,  deduct: null },
  { category: "Cost Control/Performance",  task: "Food & paper cost in line for month",    points: 25,  deduct: null },
  { category: "Cost Control/Performance",  task: "Timer usage 90%+ each week",             points: 20,  deduct: -20 },
  { category: "Accountability/Appearance", task: "Covering your shift",                    points: null,deduct: -40 },
  { category: "Accountability/Appearance", task: "Complete, clean, wrinkle-free uniform",  points: null,deduct: -5  },
  { category: "Inspections / Feedback",    task: "Ecosure visit score = 1",                points: 100, deduct: null },
  { category: "Inspections / Feedback",    task: "Comments / CARES",                       points: 10,  deduct: -10 },
];

const DEFAULT_USERS = {
  admins: [{ name: "Admin 1", pin: "9999" }],
  managers: [
    { name: "Manager 1", pin: "1111" },
    { name: "Manager 2", pin: "2222" },
    { name: "Manager 3", pin: "3333" },
  ],
  employees: [...POSITIONS.Front, ...POSITIONS.Back].map((name, i) => ({
    name,
    pin: String(4000 + i + 1),
    position: POSITIONS.Front.includes(name) ? "Front" : "Back",
  })),
};

// ── SHARED STYLES ─────────────────────────────────────────────────────────────
const h2          = { margin: "0 0 18px", color: "#222", fontSize: 20, fontWeight: "bold" };
const lbl         = { display: "block", fontSize: 11, fontWeight: "bold", color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 5, marginTop: 12 };
const inp         = { width: "100%", padding: "10px 12px", fontSize: 14, borderRadius: 8, border: "2px solid #eee", outline: "none", boxSizing: "border-box", fontFamily: "'Georgia', serif", marginBottom: 2 };
const primaryBtn  = { width: "100%", padding: "13px", background: "#E51636", color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: "bold", cursor: "pointer", fontFamily: "'Georgia', serif", marginTop: 6 };
const disabledBtn = { ...primaryBtn, background: "#e5e5e5", color: "#bbb", cursor: "not-allowed" };
const ghostBtn    = { background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13 };

// ── ROOT ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [users,   setUsersState] = useState(DEFAULT_USERS);
  const [logs,    setLogs]       = useState([]);
  const [session, setSession]    = useState(null);
  const [screen,  setScreen]     = useState("login");
  const [loading, setLoading]    = useState(true);

  // Live-sync users from Firestore
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "config", "users"), async (snap) => {
      if (snap.exists()) {
        setUsersState(snap.data());
      } else {
        await setDoc(doc(db, "config", "users"), DEFAULT_USERS);
      }
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  // Live-sync logs from Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "logs"), (snap) => {
      const data = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => b.date.localeCompare(a.date));
      setLogs(data);
    });
    return unsub;
  }, []);

  async function saveUsers(updated) {
    setUsersState(updated);
    await setDoc(doc(db, "config", "users"), updated);
  }

  async function addLogs(entries) {
    const batch = writeBatch(db);
    entries.forEach(entry => batch.set(doc(collection(db, "logs")), entry));
    await batch.commit();
  }

  async function deleteLog(id) {
    await deleteDoc(doc(db, "logs", id));
  }

  const logout = () => { setSession(null); setScreen("login"); };

  if (loading) return <LoadingScreen />;

  if (!session || screen === "login") {
    return (
      <LoginScreen
        users={users}
        onLogin={(sess) => {
          setSession(sess);
          setScreen(sess.role === "employee" ? "employee-view" : "dashboard");
        }}
      />
    );
  }

  if (session.role === "employee") {
    const myLogs = logs.filter(l => l.employee === session.name);
    const total  = myLogs.reduce((s, l) => s + l.amount, 0);
    return <EmployeeView session={session} logs={myLogs} total={total} onLogout={logout} />;
  }

  const totals = {};
  logs.forEach(l => { totals[l.employee] = (totals[l.employee] || 0) + l.amount; });

  return (
    <AdminShell session={session} screen={screen} setScreen={setScreen} onLogout={logout}>
      {screen === "dashboard"   && <Dashboard    logs={logs} totals={totals} users={users} setScreen={setScreen} />}
      {screen === "add-entry"   && <AddEntry     addLogs={addLogs} session={session} employees={users.employees} />}
      {screen === "history"     && <History      logs={logs} deleteLog={deleteLog} employees={users.employees} />}
      {screen === "leaderboard" && <Leaderboard  totals={totals} users={users} />}
      {screen === "manage-pins" && <ManagePins   users={users} saveUsers={saveUsers} session={session} />}
    </AdminShell>
  );
}

// ── LOADING ───────────────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div style={{ minHeight: "100vh", background: "#E51636", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Georgia', serif" }}>
      <div style={{ textAlign: "center", color: "#fff" }}>
        <div style={{ fontSize: 40, marginBottom: 16, animation: "spin 1s linear infinite" }}>⏳</div>
        <div style={{ fontSize: 18, fontWeight: "bold" }}>Connecting to server...</div>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );
}

// ── LOGIN ─────────────────────────────────────────────────────────────────────
function LoginScreen({ users, onLogin }) {
  const [pin,   setPin]   = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);

  const allUsers = [
    ...users.admins.map(u => ({ ...u, role: "admin" })),
    ...(users.managers || []).map(u => ({ ...u, role: "manager" })),
    ...users.employees.map(u => ({ ...u, role: "employee" })),
  ];

  function tryLogin(p) {
    const found = allUsers.find(u => u.pin === p);
    if (!found) {
      setShake(true); setError("Incorrect PIN"); setPin("");
      setTimeout(() => setShake(false), 500);
      return;
    }
    setError("");
    onLogin({ name: found.name, role: found.role, position: found.position });
  }

  function pressDigit(d) {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next); setError("");
    if (next.length === 4) setTimeout(() => tryLogin(next), 120);
  }

  function backspace() { setPin(p => p.slice(0, -1)); setError(""); }

  return (
    <div style={{ minHeight: "100vh", background: "#E51636", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Georgia', serif" }}>
      <div style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        {[...Array(12)].map((_, i) => (
          <div key={i} style={{ position: "absolute", borderRadius: "50%", background: "rgba(255,255,255,0.06)",
            width: 60 + i * 30, height: 60 + i * 30,
            top: `${(i * 37) % 100}%`, left: `${(i * 53) % 100}%`, transform: "translate(-50%,-50%)" }} />
        ))}
      </div>
      <div style={{ position: "relative", background: "#fff", borderRadius: 24, padding: "44px 40px 36px", width: 320,
        boxShadow: "0 30px 80px rgba(0,0,0,0.35)", textAlign: "center",
        animation: shake ? "shake 0.4s ease" : "none" }}>
        <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-6px)}80%{transform:translateX(6px)}}`}</style>
        <div style={{ fontSize: 22, fontWeight: "bold", color: "#E51636", letterSpacing: 1 }}>Chick-fil-A</div>
        <div style={{ fontSize: 13, color: "#aaa", marginBottom: 32, fontStyle: "italic" }}>Team Dollar Tracker</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 14, marginBottom: 8 }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ width: 20, height: 20, borderRadius: "50%",
              background: pin.length > i ? "#E51636" : "#eee",
              border: `2px solid ${pin.length > i ? "#E51636" : "#ddd"}`,
              transition: "all 0.15s", transform: pin.length === i + 1 ? "scale(1.3)" : "scale(1)" }} />
          ))}
        </div>
        <div style={{ height: 20, marginBottom: 18, fontSize: 13, color: "#E51636", fontWeight: "bold" }}>{error}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {[1,2,3,4,5,6,7,8,9,null,0,"⌫"].map((d, i) => (
            <button key={i}
              onClick={() => { if (d === "⌫") backspace(); else if (d !== null) pressDigit(String(d)); }}
              style={{ padding: "16px 0", fontSize: 22, fontWeight: "bold", borderRadius: 12, border: "none",
                background: d === "⌫" ? "#fee2e2" : d === null ? "transparent" : "#f5f5f5",
                cursor: d === null ? "default" : "pointer",
                color: d === "⌫" ? "#E51636" : "#333",
                boxShadow: d !== null && d !== "⌫" ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
                fontFamily: "'Georgia', serif" }}>
              {d === null ? "" : d}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 20, fontSize: 12, color: "#ccc" }}>Enter your 4-digit PIN</div>
      </div>
    </div>
  );
}

// ── EMPLOYEE VIEW ─────────────────────────────────────────────────────────────
function EmployeeView({ session, logs, total, onLogout }) {
  return (
    <div style={{ minHeight: "100vh", background: "#fdf3f3", fontFamily: "'Georgia', serif" }}>
      <header style={{ background: "#E51636", color: "#fff", padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 11, opacity: 0.75, letterSpacing: 2, textTransform: "uppercase" }}>My Chick-fil-A Dollars</div>
          <div style={{ fontSize: 22, fontWeight: "bold" }}>👋 {session.name}</div>
        </div>
        <button onClick={onLogout} style={ghostBtn}>Sign Out</button>
      </header>
      <div style={{ padding: 24, maxWidth: 580, margin: "0 auto" }}>
        <div style={{ background: "linear-gradient(135deg,#E51636,#b01028)", color: "#fff", borderRadius: 20, padding: 32, textAlign: "center", marginBottom: 24, boxShadow: "0 10px 30px rgba(229,22,54,0.35)" }}>
          <div style={{ fontSize: 12, opacity: 0.8, letterSpacing: 3, textTransform: "uppercase", marginBottom: 10 }}>Total Balance</div>
          <div style={{ fontSize: 72, fontWeight: "bold", lineHeight: 1 }}>${total}</div>
          <div style={{ fontSize: 13, opacity: 0.7, marginTop: 10 }}>{session.position} of House · {logs.length} entries</div>
        </div>
        <div style={{ background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #f0f0f0", fontWeight: "bold", color: "#333" }}>Transaction History</div>
          {logs.length === 0
            ? <div style={{ padding: 32, textAlign: "center", color: "#bbb" }}>No entries yet — keep up the great work! 🌟</div>
            : logs.map(l => (
              <div key={l.id} style={{ padding: "14px 20px", borderBottom: "1px solid #f9f9f9", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: "bold", color: "#222" }}>{l.task}</div>
                  <div style={{ fontSize: 12, color: "#aaa", marginTop: 2 }}>{l.date} · Added by {l.enteredBy}</div>
                  {l.notes && <div style={{ fontSize: 12, color: "#888", fontStyle: "italic", marginTop: 2 }}>{l.notes}</div>}
                </div>
                <div style={{ fontSize: 22, fontWeight: "bold", color: l.amount >= 0 ? "#16a34a" : "#E51636", minWidth: 60, textAlign: "right" }}>
                  {l.amount >= 0 ? "+" : ""}{l.amount}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

// ── ADMIN SHELL ───────────────────────────────────────────────────────────────
function AdminShell({ session, screen, setScreen, onLogout, children }) {
  const tabs = [
    { id: "dashboard",   label: "Dashboard",   icon: "📊" },
    { id: "add-entry",   label: "Add Entry",   icon: "➕" },
    { id: "history",     label: "History",     icon: "📋" },
    { id: "leaderboard", label: "Leaderboard", icon: "🏆" },
    { id: "manage-pins", label: "Manage PINs", icon: "🔑" },
  ];
  return (
    <div style={{ minHeight: "100vh", background: "#f6f6f6", fontFamily: "'Georgia', serif" }}>
      <header style={{ background: "#E51636", color: "#fff", padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 11, opacity: 0.75, letterSpacing: 2 }}>{session.role === "admin" ? "ADMIN" : "MANAGER"} · {session.name}</div>
          <div style={{ fontSize: 20, fontWeight: "bold" }}>Chick-fil-A Dollars</div>
        </div>
        <button onClick={onLogout} style={ghostBtn}>Sign Out</button>
      </header>
      <nav style={{ background: "#fff", borderBottom: "2px solid #f0f0f0", display: "flex", overflowX: "auto" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setScreen(t.id)}
            style={{ padding: "13px 18px", border: "none", background: "none", cursor: "pointer", fontSize: 13,
              fontFamily: "'Georgia', serif", whiteSpace: "nowrap",
              borderBottom: `3px solid ${screen === t.id ? "#E51636" : "transparent"}`,
              color: screen === t.id ? "#E51636" : "#666",
              fontWeight: screen === t.id ? "bold" : "normal" }}>
            {t.icon} {t.label}
          </button>
        ))}
      </nav>
      <div style={{ padding: "24px 20px", maxWidth: 960, margin: "0 auto" }}>{children}</div>
    </div>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function Dashboard({ logs, totals, users, setScreen }) {
  const totalAwarded = Object.values(totals).reduce((s, v) => s + v, 0);
  const topEarner    = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
  const recent       = logs.slice(0, 8);
  return (
    <div>
      <h2 style={h2}>Overview</h2>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 24 }}>
        <StatCard label="Total Entries"   value={logs.length} />
        <StatCard label="Dollars Awarded" value={"$" + totalAwarded} color={totalAwarded >= 0 ? "#16a34a" : "#E51636"} />
        <StatCard label="Team Members"    value={users.employees.length} />
        {topEarner && <StatCard label="Top Earner" value={topEarner[0]} sub={"$" + topEarner[1]} color="#b45309" />}
      </div>
      <div style={{ background: "#fff", borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #f0f0f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: "bold", color: "#333" }}>Recent Activity</span>
          <button onClick={() => setScreen("history")} style={{ background: "none", border: "none", color: "#E51636", cursor: "pointer", fontSize: 13 }}>View All →</button>
        </div>
        {recent.length === 0
          ? <div style={{ padding: 28, textAlign: "center", color: "#bbb" }}>No entries yet.</div>
          : recent.map(l => (
            <div key={l.id} style={{ padding: "12px 20px", borderBottom: "1px solid #f9f9f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontWeight: "bold", color: "#222", marginRight: 8 }}>{l.employee}</span>
                <span style={{ fontSize: 13, color: "#666" }}>{l.task}</span>
                <div style={{ fontSize: 12, color: "#bbb", marginTop: 2 }}>{l.date} · by {l.enteredBy}</div>
              </div>
              <span style={{ fontWeight: "bold", fontSize: 18, color: l.amount >= 0 ? "#16a34a" : "#E51636" }}>
                {l.amount >= 0 ? "+" : ""}{l.amount}
              </span>
            </div>
          ))}
      </div>
      <div style={{ marginTop: 18 }}>
        <button onClick={() => setScreen("add-entry")} style={{ ...primaryBtn, width: "auto", padding: "13px 32px", fontSize: 15 }}>
          ➕ Add New Entry
        </button>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color = "#E51636" }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: "20px 22px", flex: 1, minWidth: 150, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
      <div style={{ fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: "bold", color, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 14, color: "#888", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── ADD ENTRY ─────────────────────────────────────────────────────────────────
function AddEntry({ addLogs, session, employees }) {
  const [selectedEmps,   setSelectedEmps]   = useState([]);
  const [posFilter,      setPosFilter]      = useState("All");
  const [selectedRubric, setSelectedRubric] = useState(null);
  const [customTask,     setCustomTask]     = useState("");
  const [amount,         setAmount]         = useState("");
  const [date,           setDate]           = useState(new Date().toISOString().slice(0, 10));
  const [notes,          setNotes]          = useState("");
  const [success,        setSuccess]        = useState(0);
  const [saving,         setSaving]         = useState(false);

  const filteredEmps = posFilter === "All" ? employees : employees.filter(e => e.position === posFilter);

  const toggleEmp = (name) => setSelectedEmps(p => p.includes(name) ? p.filter(n => n !== name) : [...p, name]);
  const selectAll = () => setSelectedEmps(filteredEmps.map(e => e.name));
  const clearAll  = () => setSelectedEmps([]);

  function pickRubric(r) {
    setSelectedRubric(r); setCustomTask("");
    if (r.points != null) setAmount(String(r.points));
  }

  async function submit() {
    if (!selectedEmps.length || (!selectedRubric && !customTask.trim()) || !amount) return;
    setSaving(true);
    const entries = selectedEmps.map(name => ({
      date,
      employee: name,
      task: selectedRubric ? selectedRubric.task : customTask.trim(),
      amount: Number(amount),
      notes,
      enteredBy: session.name,
      position: employees.find(e => e.name === name)?.position || "",
    }));
    await addLogs(entries);
    setSuccess(entries.length);
    setSelectedEmps([]); setSelectedRubric(null); setCustomTask(""); setAmount(""); setNotes("");
    setSaving(false);
    setTimeout(() => setSuccess(0), 3000);
  }

  const categories = [...new Set(RUBRIC.map(r => r.category))];
  const canSubmit  = !saving && selectedEmps.length > 0 && (selectedRubric || customTask.trim()) && amount;

  return (
    <div>
      <h2 style={h2}>Add Dollar Entry</h2>
      {success > 0 && (
        <div style={{ background: "#dcfce7", border: "1px solid #86efac", borderRadius: 10, padding: 14, marginBottom: 20, color: "#166534", fontWeight: "bold", textAlign: "center" }}>
          ✅ Saved to cloud! Added for {success} employee{success > 1 ? "s" : ""}.
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

        {/* Employee picker */}
        <div style={{ background: "#fff", borderRadius: 14, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: "bold", color: "#333", marginBottom: 14, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
            Select Employees
            {selectedEmps.length > 0 && <span style={{ background: "#E51636", color: "#fff", borderRadius: 20, padding: "2px 10px", fontSize: 12 }}>{selectedEmps.length} selected</span>}
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {["All","Front","Back"].map(f => (
              <button key={f} onClick={() => setPosFilter(f)}
                style={{ padding: "5px 14px", borderRadius: 20, border: `2px solid ${posFilter === f ? "#E51636" : "#e5e5e5"}`,
                  background: posFilter === f ? "#fee2e2" : "#fafafa", cursor: "pointer", fontSize: 12,
                  color: posFilter === f ? "#E51636" : "#666", fontFamily: "'Georgia', serif" }}>
                {f === "All" ? "All" : f + " of House"}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button onClick={selectAll} style={{ flex: 1, padding: "7px", background: "#fee2e2", border: "none", borderRadius: 8, cursor: "pointer", color: "#E51636", fontWeight: "bold", fontSize: 12, fontFamily: "'Georgia', serif" }}>
              Select All ({filteredEmps.length})
            </button>
            <button onClick={clearAll} style={{ flex: 1, padding: "7px", background: "#f5f5f5", border: "none", borderRadius: 8, cursor: "pointer", color: "#666", fontSize: 12, fontFamily: "'Georgia', serif" }}>
              Clear
            </button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, maxHeight: 320, overflowY: "auto", padding: 2 }}>
            {filteredEmps.map(e => {
              const sel = selectedEmps.includes(e.name);
              return (
                <button key={e.name} onClick={() => toggleEmp(e.name)}
                  style={{ padding: "7px 13px", borderRadius: 20, border: `2px solid ${sel ? "#E51636" : "#e5e5e5"}`,
                    background: sel ? "#E51636" : "#fafafa", cursor: "pointer", fontSize: 13,
                    color: sel ? "#fff" : "#444", fontFamily: "'Georgia', serif",
                    fontWeight: sel ? "bold" : "normal", transition: "all 0.12s" }}>
                  {sel ? "✓ " : ""}{e.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Task + amount */}
        <div style={{ background: "#fff", borderRadius: 14, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: "bold", color: "#333", marginBottom: 14, fontSize: 15 }}>Task & Amount</div>
          <label style={lbl}>Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} />
          <label style={lbl}>Pick from Rubric</label>
          <div style={{ maxHeight: 210, overflowY: "auto", border: "2px solid #eee", borderRadius: 10, padding: 10, marginBottom: 8 }}>
            {categories.map(cat => (
              <div key={cat} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 10, color: "#aaa", textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>{cat}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {RUBRIC.filter(r => r.category === cat).map((r, i) => {
                    const sel = selectedRubric === r;
                    return (
                      <button key={i} onClick={() => pickRubric(r)}
                        style={{ padding: "5px 10px", borderRadius: 16, border: `2px solid ${sel ? "#E51636" : "#e5e5e5"}`,
                          background: sel ? "#fee2e2" : "#fafafa", cursor: "pointer", fontSize: 11,
                          color: sel ? "#E51636" : "#555", fontFamily: "'Georgia', serif" }}>
                        {r.task}
                        <span style={{ marginLeft: 4, opacity: 0.65, fontSize: 10 }}>
                          {r.points != null ? `+${r.points}` : ""}{r.deduct != null ? (r.points != null ? `/${r.deduct}` : r.deduct) : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <label style={lbl}>— or — Custom Task</label>
          <input placeholder="Custom description..." value={customTask}
            onChange={e => { setCustomTask(e.target.value); setSelectedRubric(null); }} style={inp} />
          <label style={lbl}>Dollar Amount (negative = deduction)</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 10 or -20" style={inp} />
          <label style={lbl}>Notes (optional)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any context..." rows={2} style={{ ...inp, resize: "vertical" }} />
          {selectedEmps.length > 0 && amount && (
            <div style={{ background: "#f9fafb", borderRadius: 8, padding: "10px 14px", marginBottom: 10, fontSize: 13, color: "#555", border: "1px solid #e5e5e5" }}>
              <strong>Preview:</strong> {selectedEmps.length} employee{selectedEmps.length > 1 ? "s" : ""} each get{" "}
              <strong style={{ color: Number(amount) >= 0 ? "#16a34a" : "#E51636" }}>{Number(amount) >= 0 ? "+" : ""}{amount}</strong>{" "}
              for <em>{selectedRubric?.task || customTask || "—"}</em>
            </div>
          )}
          <button onClick={submit} disabled={!canSubmit} style={canSubmit ? primaryBtn : disabledBtn}>
            {saving ? "⏳ Saving to cloud..." : selectedEmps.length > 1 ? `➕ Add to ${selectedEmps.length} Employees` : "➕ Add Entry"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── HISTORY ───────────────────────────────────────────────────────────────────
function History({ logs, deleteLog, employees }) {
  const [filterEmp, setFilterEmp] = useState("");
  const [search,    setSearch]    = useState("");
  const [confirmId, setConfirmId] = useState(null);

  const filtered = logs.filter(l =>
    (!filterEmp || l.employee === filterEmp) &&
    (!search || l.task.toLowerCase().includes(search.toLowerCase()) || l.employee.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      <h2 style={h2}>Full History</h2>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <select value={filterEmp} onChange={e => setFilterEmp(e.target.value)} style={{ ...inp, marginBottom: 0, flex: "0 0 190px" }}>
          <option value="">All employees</option>
          {employees.map(e => <option key={e.name} value={e.name}>{e.name}</option>)}
        </select>
        <input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, marginBottom: 0, flex: 1 }} />
      </div>
      <div style={{ background: "#fff", borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
        {filtered.length === 0
          ? <div style={{ padding: 32, textAlign: "center", color: "#bbb" }}>No entries found.</div>
          : filtered.map(l => (
            <div key={l.id} style={{ padding: "13px 20px", borderBottom: "1px solid #f5f5f5" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: "bold", color: "#222" }}>{l.employee}</span>
                    <span style={{ fontSize: 11, background: "#f0f0f0", padding: "2px 7px", borderRadius: 10, color: "#888" }}>{l.position}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "#666", margin: "2px 0" }}>{l.task}</div>
                  <div style={{ fontSize: 11, color: "#bbb" }}>{l.date} · by {l.enteredBy}</div>
                  {l.notes && <div style={{ fontSize: 12, color: "#888", fontStyle: "italic" }}>{l.notes}</div>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20, fontWeight: "bold", color: l.amount >= 0 ? "#16a34a" : "#E51636", minWidth: 56, textAlign: "right" }}>
                    {l.amount >= 0 ? "+" : ""}{l.amount}
                  </span>
                  <button onClick={() => setConfirmId(confirmId === l.id ? null : l.id)}
                    style={{ background: confirmId === l.id ? "#fee2e2" : "none", border: "none", cursor: "pointer",
                      color: confirmId === l.id ? "#E51636" : "#ccc", fontSize: 17, borderRadius: 6, padding: "4px 6px" }}>🗑</button>
                </div>
              </div>
              {confirmId === l.id && (
                <div style={{ marginTop: 10, padding: "10px 14px", background: "#fff5f5", borderRadius: 8, border: "1px solid #fecaca", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: "#991b1b" }}>Delete this entry?</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => { deleteLog(l.id); setConfirmId(null); }}
                      style={{ background: "#E51636", color: "#fff", border: "none", borderRadius: 6, padding: "5px 14px", cursor: "pointer", fontWeight: "bold", fontSize: 13 }}>Delete</button>
                    <button onClick={() => setConfirmId(null)}
                      style={{ background: "#f5f5f5", border: "none", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 13 }}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}

// ── LEADERBOARD ───────────────────────────────────────────────────────────────
function Leaderboard({ totals, users }) {
  const [filter, setFilter] = useState("All");
  const allEmp = users.employees
    .map(e => ({ name: e.name, position: e.position, total: totals[e.name] || 0 }))
    .sort((a, b) => b.total - a.total);
  const filtered = filter === "All" ? allEmp : allEmp.filter(e => e.position === filter);
  const medal = i => i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i+1}.`;

  return (
    <div>
      <h2 style={h2}>🏆 Leaderboard</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {["All","Front","Back"].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding: "7px 18px", borderRadius: 20, border: `2px solid ${filter === f ? "#E51636" : "#e5e5e5"}`,
              background: filter === f ? "#fee2e2" : "#fff", cursor: "pointer", fontSize: 13,
              color: filter === f ? "#E51636" : "#666", fontFamily: "'Georgia', serif" }}>
            {f === "All" ? "All" : f + " of House"}
          </button>
        ))}
      </div>
      <div style={{ background: "#fff", borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
        {filtered.map((e, i) => (
          <div key={e.name} style={{ padding: "14px 20px", borderBottom: "1px solid #f5f5f5", display: "flex", justifyContent: "space-between", alignItems: "center",
            background: i < 3 ? `rgba(229,22,54,${0.04 * (3-i)})` : "transparent" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ fontSize: i < 3 ? 22 : 15, minWidth: 30, textAlign: "center" }}>{medal(i)}</span>
              <div>
                <div style={{ fontWeight: "bold", color: "#222" }}>{e.name}</div>
                <div style={{ fontSize: 12, color: "#bbb" }}>{e.position} of House</div>
              </div>
            </div>
            <div style={{ fontSize: 22, fontWeight: "bold", color: e.total >= 0 ? "#16a34a" : "#E51636" }}>${e.total}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── MANAGE PINs ───────────────────────────────────────────────────────────────
function ManagePins({ users, saveUsers, session }) {
  const canEditManagers = session.role === "admin";
  const [tab,      setTab]      = useState(canEditManagers ? "managers" : "employees");
  const [editing,  setEditing]  = useState(null);
  const [saved,    setSaved]    = useState(null);
  const [pinError, setPinError] = useState("");
  const [saving,   setSaving]   = useState(false);

  function startEdit(type, index) { setEditing({ type, index, newPin: "" }); setPinError(""); }

  async function savePinFn() {
    if (!editing || !/^\d{4}$/.test(editing.newPin)) { setPinError("Must be exactly 4 digits."); return; }
    const all = [...users.admins, ...(users.managers || []), ...users.employees];
    const offsets = { admins: 0, managers: users.admins.length, employees: users.admins.length + (users.managers || []).length };
    const conflict = all.find((u, gi) => gi !== offsets[editing.type] + editing.index && u.pin === editing.newPin);
    if (conflict) { setPinError(`PIN already used by ${conflict.name}.`); return; }
    setSaving(true);
    const arr = [...(users[editing.type] || [])];
    arr[editing.index] = { ...arr[editing.index], pin: editing.newPin };
    await saveUsers({ ...users, [editing.type]: arr });
    setSaved(editing.type + editing.index);
    setEditing(null); setPinError(""); setSaving(false);
    setTimeout(() => setSaved(null), 2500);
  }

  const tabs = canEditManagers
    ? [{ id: "managers", label: "Managers" }, { id: "employees", label: "Employees" }]
    : [{ id: "employees", label: "Employees" }];
  const list = (tab === "managers" ? users.managers : users.employees) || [];

  return (
    <div>
      <h2 style={h2}>🔑 Manage PINs</h2>
      <div style={{ background: "#fff3cd", border: "1px solid #ffc107", borderRadius: 10, padding: "10px 16px", marginBottom: 20, fontSize: 13, color: "#856404" }}>
        {canEditManagers ? "As an Admin, you can change Manager and Employee PINs." : "As a Manager, you can change Employee PINs only."}
      </div>
      {tabs.length > 1 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setEditing(null); setPinError(""); }}
              style={{ padding: "7px 18px", borderRadius: 20, border: `2px solid ${tab === t.id ? "#E51636" : "#e5e5e5"}`,
                background: tab === t.id ? "#fee2e2" : "#fff", cursor: "pointer", fontSize: 13,
                color: tab === t.id ? "#E51636" : "#666", fontFamily: "'Georgia', serif" }}>
              {t.label}
            </button>
          ))}
        </div>
      )}
      <div style={{ background: "#fff", borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
        {list.map((u, i) => {
          const isEditing = editing && editing.type === tab && editing.index === i;
          const isSaved   = saved === tab + i;
          return (
            <div key={u.name} style={{ padding: "13px 20px", borderBottom: "1px solid #f5f5f5", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div>
                <div style={{ fontWeight: "bold", color: "#222" }}>{u.name}</div>
                {tab === "employees" && <div style={{ fontSize: 12, color: "#bbb" }}>{u.position} of House</div>}
                {tab === "managers"  && <div style={{ fontSize: 12, color: "#E51636", background: "#fee2e2", display: "inline-block", padding: "1px 8px", borderRadius: 8, marginTop: 2 }}>Manager</div>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {isEditing ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <input type="text" maxLength={4} value={editing.newPin} placeholder="New PIN"
                        onChange={e => { setEditing(p => ({ ...p, newPin: e.target.value.replace(/\D/g,"").slice(0,4) })); setPinError(""); }}
                        style={{ width: 80, padding: "7px 10px", border: "2px solid #E51636", borderRadius: 8, fontSize: 18, textAlign: "center", fontFamily: "monospace", outline: "none", letterSpacing: 4 }} autoFocus />
                      <button onClick={savePinFn} disabled={saving}
                        style={{ background: "#E51636", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontWeight: "bold", fontSize: 13 }}>
                        {saving ? "..." : "Save"}
                      </button>
                      <button onClick={() => { setEditing(null); setPinError(""); }}
                        style={{ background: "#f5f5f5", border: "none", borderRadius: 8, padding: "7px 12px", cursor: "pointer", fontSize: 13 }}>✕</button>
                    </div>
                    {pinError && <div style={{ fontSize: 12, color: "#E51636" }}>{pinError}</div>}
                  </div>
                ) : (
                  <>
                    <span style={{ fontFamily: "monospace", fontSize: 20, color: "#ccc", letterSpacing: 6 }}>••••</span>
                    {isSaved && <span style={{ fontSize: 12, color: "#16a34a", fontWeight: "bold" }}>✓ Updated</span>}
                    <button onClick={() => startEdit(tab, i)}
                      style={{ background: "#f5f5f5", border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13, color: "#555", fontFamily: "'Georgia', serif" }}>
                      Change PIN
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {canEditManagers && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 12, color: "#aaa", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Admin Accounts (PINs not editable here)</div>
          <div style={{ background: "#fff", borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", opacity: 0.7 }}>
            {users.admins.map(u => (
              <div key={u.name} style={{ padding: "13px 20px", borderBottom: "1px solid #f5f5f5", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: "bold", color: "#222" }}>{u.name}</div>
                  <div style={{ fontSize: 12, color: "#E51636", background: "#fee2e2", display: "inline-block", padding: "1px 8px", borderRadius: 8, marginTop: 2 }}>Admin</div>
                </div>
                <span style={{ fontFamily: "monospace", fontSize: 20, color: "#ddd", letterSpacing: 6 }}>••••</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
