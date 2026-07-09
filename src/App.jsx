import { useState, useEffect, useRef } from "react";

const CAT = {
  Technical:   { bg:"#eff6ff", color:"#1d4ed8", bdr:"#bfdbfe", icon:"⚙️", label:"Technical"    },
  Behavioral:  { bg:"#fef3c7", color:"#92400e", bdr:"#fde68a", icon:"🧠", label:"Behavioral"   },
  Situational: { bg:"#ecfdf5", color:"#065f46", bdr:"#a7f3d0", icon:"💡", label:"Situational"  },
  HR:          { bg:"#faf5ff", color:"#6b21a8", bdr:"#e9d5ff", icon:"🤝", label:"HR & culture" },
};

const DIFF = {
  Easy:   { bg:"#dcfce7", color:"#15803d" },
  Medium: { bg:"#fef3c7", color:"#b45309" },
  Hard:   { bg:"#fee2e2", color:"#b91c1c" },
};

const stext = s => s>=7?"#16a34a":s>=5?"#d97706":"#dc2626";
const sfill = s => s>=7?"#16a34a":s>=5?"#d97706":"#dc2626";
const sbg   = s => s>=7?"#dcfce7":s>=5?"#fef3c7":"#fee2e2";
const sbdr  = s => s>=7?"#86efac":s>=5?"#fde68a":"#fca5a5";
const slbl  = s => s>=8?"Excellent 🌟":s>=6?"Good 👍":s>=4?"Fair 📖":"Needs work 💪";
const fmt   = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;

// ── API call goes through /api/chat (Vercel serverless function)
// ── so your ANTHROPIC_API_KEY stays secret on the server side
async function callClaude(sys, usr) {
  const r = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: sys,
      messages: [{ role: "user", content: usr }],
    }),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return d.content[0].text;
}

const toJSON = t => JSON.parse(t.replace(/```[\w]*\n?|```/g, "").trim());

function Pill({ bg, color, bdr, children }) {
  return (
    <span style={{ background:bg, color, border:`1px solid ${bdr||bg}`, padding:"3px 10px", borderRadius:20, fontSize:12, fontWeight:600, display:"inline-flex", alignItems:"center", gap:4 }}>
      {children}
    </span>
  );
}

const CARD = { background:"#fff", borderRadius:14, padding:"20px 22px", boxShadow:"0 2px 12px rgba(0,0,0,0.07)", border:"1px solid #e2e8f0" };
const INP  = { width:"100%", padding:"9px 12px", border:"1.5px solid #e2e8f0", borderRadius:8, fontSize:14, outline:"none", color:"#111827", background:"#fff", fontFamily:"inherit", boxSizing:"border-box" };
const BTN  = { padding:"12px 20px", background:"linear-gradient(135deg,#1a365d,#2563eb)", color:"#fff", border:"none", borderRadius:10, fontSize:15, fontWeight:700, cursor:"pointer", width:"100%", fontFamily:"inherit" };

export default function InterviewTrainer() {
  const [phase, setPhase] = useState("setup");
  const [prof,  setProf]  = useState({ name:"", exp:"", role:"", industry:"" });
  const [qs,    setQs]    = useState([]);
  const [qi,    setQi]    = useState(0);
  const [ans,   setAns]   = useState("");
  const [hist,  setHist]  = useState([]);
  const [ev,    setEv]    = useState(null);
  const [err,   setErr]   = useState("");
  const [sec,   setSec]   = useState(0);
  const tid = useRef(null);

  useEffect(() => {
    if (phase !== "interview") return;
    setSec(0);
    tid.current = setInterval(() => setSec(s => s + 1), 1000);
    return () => clearInterval(tid.current);
  }, [phase, qi]);

  const fp  = (k, v) => setProf(p => ({ ...p, [k]:v }));
  const avg = hist.length ? (hist.reduce((s,h) => s+h.score, 0)/hist.length).toFixed(1) : null;

  const startSession = async () => {
    if (!prof.name.trim()||!prof.exp||!prof.role.trim()) {
      setErr("Please fill in name, experience level, and job role."); return;
    }
    setErr(""); setPhase("gen");
    try {
      const txt = await callClaude(
        "Expert HR interview coach. Return ONLY valid JSON, no markdown.",
        `Generate 8 interview questions for: ${prof.role} | ${prof.exp}${prof.industry?" | "+prof.industry:""}.
Mix: 3 Technical, 2 Behavioral (STAR), 2 Situational, 1 HR.
JSON only: {"questions":[{"id":1,"question":"...","category":"Technical","difficulty":"Easy","hint":"..."}]}`
      );
      const { questions } = toJSON(txt);
      setQs(questions); setQi(0); setHist([]); setPhase("interview");
    } catch { setErr("Couldn't generate questions. Please try again."); setPhase("setup"); }
  };

  const submitAnswer = async () => {
    if (!ans.trim()) { setErr("Please write your answer before submitting."); return; }
    setErr(""); setPhase("eval");
    const q = qs[qi];
    try {
      const txt = await callClaude(
        "Senior HR expert and interview coach. Score 1–10. Return ONLY valid JSON.",
        `Role: ${prof.role} (${prof.exp})
Q [${q.category}]: "${q.question}"
Answer: "${ans}"
JSON: {"score":7,"feedback":"...","strengths":["...","..."],"improvements":["...","..."],"modelAnswer":"...","tip":"..."}`
      );
      const result = toJSON(txt);
      const entry  = { ...q, ans, sec, ...result };
      setEv(entry); setHist(h => [...h, entry]); setPhase("feedback");
    } catch { setErr("Evaluation failed. Please try again."); setPhase("interview"); }
  };

  const goNext = () => {
    setAns(""); setEv(null); setErr("");
    qi+1 >= qs.length ? setPhase("done") : (setQi(i => i+1), setPhase("interview"));
  };

  const reset = () => {
    setPhase("setup"); setQs([]); setQi(0); setAns(""); setHist([]); setEv(null); setErr("");
  };

  return (
    <div style={{ minHeight:"100vh", background:"#f0f4f8", fontFamily:"system-ui,-apple-system,sans-serif" }}>

      {/* NAV */}
      <div style={{ background:"#0f2744", padding:"13px 24px", display:"flex", justifyContent:"space-between", alignItems:"center", position:"sticky", top:0, zIndex:20 }}>
        <div style={{ display:"flex", alignItems:"center", gap:9 }}>
          <span style={{ fontSize:20 }}>🎯</span>
          <span style={{ color:"#fff", fontWeight:800, fontSize:15 }}>Interview Trainer Agent</span>
          <span style={{ background:"rgba(255,255,255,.15)", color:"rgba(255,255,255,.85)", fontSize:10, padding:"2px 8px", borderRadius:10, fontWeight:600 }}>RAG-Powered</span>
        </div>
        {phase !== "setup" && (
          <button onClick={reset} style={{ background:"rgba(255,255,255,.12)", color:"#fff", border:"none", borderRadius:6, padding:"5px 12px", fontSize:12, cursor:"pointer", fontWeight:600 }}>
            ✕ New Session
          </button>
        )}
      </div>

      <div style={{ maxWidth:660, margin:"0 auto", padding:"28px 16px 64px" }}>

        {/* SETUP */}
        {phase === "setup" && (
          <>
            <div style={{ textAlign:"center", marginBottom:24 }}>
              <div style={{ fontSize:52 }}>🎯</div>
              <h1 style={{ fontSize:24, fontWeight:800, color:"#0f2744", margin:"8px 0 5px" }}>AI Interview Trainer</h1>
              <p style={{ color:"#64748b", fontSize:15, margin:0 }}>Tailored questions · Real-time AI scoring · Model answers</p>
            </div>
            <div style={CARD}>
              <p style={{ fontSize:12, fontWeight:700, color:"#94a3b8", margin:"0 0 16px", letterSpacing:.8, textTransform:"uppercase" }}>Your profile</p>

              <div style={{ marginBottom:14 }}>
                <label style={{ display:"block", fontSize:13, fontWeight:600, color:"#374151", marginBottom:5 }}>Full name <span style={{ color:"#dc2626" }}>*</span></label>
                <input value={prof.name} onChange={e=>fp("name",e.target.value)} placeholder="e.g. Priya Sharma" style={INP} />
              </div>

              <div style={{ marginBottom:14 }}>
                <label style={{ display:"block", fontSize:13, fontWeight:600, color:"#374151", marginBottom:5 }}>Job role <span style={{ color:"#dc2626" }}>*</span></label>
                <input value={prof.role} onChange={e=>fp("role",e.target.value)} placeholder="e.g. Full Stack Developer, Data Scientist" style={INP} />
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:20 }}>
                <div>
                  <label style={{ display:"block", fontSize:13, fontWeight:600, color:"#374151", marginBottom:5 }}>Experience <span style={{ color:"#dc2626" }}>*</span></label>
                  <select value={prof.exp} onChange={e=>fp("exp",e.target.value)} style={INP}>
                    <option value="">Select level</option>
                    {["Fresher (0–1 yrs)","Junior (1–3 yrs)","Mid-level (3–5 yrs)","Senior (5–8 yrs)","Lead / Principal (8+ yrs)"].map(v=><option key={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display:"block", fontSize:13, fontWeight:600, color:"#374151", marginBottom:5 }}>Industry <span style={{ color:"#94a3b8", fontWeight:400 }}>(optional)</span></label>
                  <select value={prof.industry} onChange={e=>fp("industry",e.target.value)} style={INP}>
                    <option value="">Select</option>
                    {["Technology","Finance","Healthcare","E-commerce","Manufacturing","Consulting","Education","Media"].map(v=><option key={v}>{v}</option>)}
                  </select>
                </div>
              </div>

              {err && <div style={{ background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:8, padding:"9px 13px", color:"#dc2626", fontSize:13, marginBottom:14 }}>⚠️ {err}</div>}
              <button onClick={startSession} style={BTN}>🚀 Generate My Questions</button>

              <div style={{ display:"flex", gap:20, marginTop:18, paddingTop:16, borderTop:"1px solid #e2e8f0", flexWrap:"wrap" }}>
                {Object.entries(CAT).map(([k,v])=>(
                  <div key={k} style={{ display:"flex", alignItems:"center", gap:5, fontSize:12, color:"#64748b" }}>
                    <span>{v.icon}</span>{v.label}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* GENERATING */}
        {phase === "gen" && (
          <div style={{ textAlign:"center", padding:"60px 20px" }}>
            <div style={{ fontSize:48, display:"inline-block", animation:"spin 1.5s linear infinite" }}>⚙️</div>
            <h2 style={{ color:"#0f2744", marginTop:18, marginBottom:6 }}>Building your question set…</h2>
            <p style={{ color:"#64748b", margin:0 }}>{prof.role} · {prof.exp}</p>
          </div>
        )}

        {/* INTERVIEW */}
        {phase === "interview" && qs[qi] && (()=>{
          const q=qs[qi]; const cs=CAT[q.category]||CAT.Technical; const ds=DIFF[q.difficulty]||DIFF.Medium;
          const wc=ans.trim().split(/\s+/).filter(Boolean).length;
          return (
            <>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                <span style={{ fontSize:13, color:"#64748b" }}>Question <strong style={{ color:"#111827" }}>{qi+1}</strong> of {qs.length}</span>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ fontSize:12, color:"#94a3b8" }}>{hist.length} answered</span>
                  <span style={{ fontFamily:"monospace", fontSize:12, color:"#374151", background:"#f1f5f9", padding:"3px 9px", borderRadius:20, border:"1px solid #e2e8f0" }}>⏱ {fmt(sec)}</span>
                </div>
              </div>
              <div style={{ height:4, background:"#e2e8f0", borderRadius:99, marginBottom:18, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${(qi/qs.length)*100}%`, background:"linear-gradient(90deg,#2563eb,#7c3aed)", borderRadius:99, transition:"width .4s" }} />
              </div>
              <div style={{ ...CARD, marginBottom:12 }}>
                <div style={{ display:"flex", gap:7, marginBottom:13, flexWrap:"wrap" }}>
                  <Pill bg={cs.bg} color={cs.color} bdr={cs.bdr}>{cs.icon} {q.category}</Pill>
                  <Pill bg={ds.bg} color={ds.color} bdr={ds.bg}>{q.difficulty}</Pill>
                </div>
                <p style={{ fontSize:17, fontWeight:600, color:"#111827", lineHeight:1.65, margin:"0 0 12px" }}>{q.question}</p>
                {q.hint && <div style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:8, padding:"8px 12px", fontSize:13, color:"#64748b" }}>💡 <strong>Focus on:</strong> {q.hint}</div>}
              </div>
              <div style={CARD}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:9 }}>
                  <label style={{ fontSize:13, fontWeight:700, color:"#111827" }}>Your answer</label>
                  {q.category==="Behavioral" && <span style={{ fontSize:11, color:"#2563eb", background:"#eff6ff", padding:"2px 8px", borderRadius:10, border:"1px solid #bfdbfe", fontWeight:600 }}>Use STAR format</span>}
                </div>
                <textarea value={ans} onChange={e=>{setAns(e.target.value);setErr("");}}
                  placeholder={q.category==="Behavioral"?"Situation: …\nTask: …\nAction: …\nResult: …":"Type your response here…"}
                  rows={7} style={{ width:"100%", padding:"11px 13px", border:"1.5px solid #e2e8f0", borderRadius:8, fontSize:14, outline:"none", resize:"vertical", fontFamily:"inherit", lineHeight:1.7, color:"#111827", boxSizing:"border-box" }} />
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:10 }}>
                  <span style={{ fontSize:12, color:wc>=30?"#16a34a":"#94a3b8" }}>{wc} words{wc>0&&wc<30?" — aim for 30+":""}</span>
                  {err && <span style={{ fontSize:12, color:"#dc2626" }}>⚠️ {err}</span>}
                  <button onClick={submitAnswer} style={{ padding:"9px 18px", background:"linear-gradient(135deg,#0f2744,#2563eb)", color:"#fff", border:"none", borderRadius:8, fontSize:14, fontWeight:700, cursor:"pointer" }}>Submit →</button>
                </div>
              </div>
            </>
          );
        })()}

        {/* EVALUATING */}
        {phase === "eval" && (
          <div style={{ textAlign:"center", padding:"60px 20px" }}>
            <div style={{ fontSize:48, display:"inline-block", animation:"spin 1.5s linear infinite" }}>🔍</div>
            <h2 style={{ color:"#0f2744", marginTop:18, marginBottom:6 }}>Evaluating your answer…</h2>
            <p style={{ color:"#64748b", margin:0 }}>AI coach is reviewing your response</p>
          </div>
        )}

        {/* FEEDBACK */}
        {phase === "feedback" && ev && (()=>{
          const {score,feedback,strengths=[],improvements=[],modelAnswer,tip,sec:s}=ev;
          return (
            <>
              <div style={{ ...CARD, display:"flex", gap:20, alignItems:"center", marginBottom:12 }}>
                <div style={{ textAlign:"center", minWidth:62 }}>
                  <div style={{ fontSize:36, fontWeight:800, color:stext(score), lineHeight:1 }}>{score}</div>
                  <div style={{ fontSize:11, color:"#94a3b8" }}>/10</div>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:16, fontWeight:700, color:stext(score), marginBottom:7 }}>{slbl(score)}</div>
                  <div style={{ height:5, background:"#e2e8f0", borderRadius:99, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${score*10}%`, background:sfill(score), transition:"width .6s ease" }} />
                  </div>
                </div>
                <div style={{ fontSize:12, color:"#94a3b8" }}>⏱ {fmt(s||0)}</div>
              </div>
              <div style={{ background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:12, padding:"14px 18px", marginBottom:12 }}>
                <p style={{ fontSize:13, fontWeight:700, color:"#1d4ed8", margin:"0 0 7px" }}>🤖 AI Coach Feedback</p>
                <p style={{ fontSize:14, color:"#1e3a5f", lineHeight:1.75, margin:0 }}>{feedback}</p>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
                <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:12, padding:"14px 16px" }}>
                  <p style={{ fontSize:13, fontWeight:700, color:"#15803d", margin:"0 0 8px" }}>✅ Strengths</p>
                  {strengths.map((s,i)=><p key={i} style={{ fontSize:13, color:"#166534", lineHeight:1.6, margin:"0 0 3px" }}>· {s}</p>)}
                </div>
                <div style={{ background:"#fff7ed", border:"1px solid #fed7aa", borderRadius:12, padding:"14px 16px" }}>
                  <p style={{ fontSize:13, fontWeight:700, color:"#c2410c", margin:"0 0 8px" }}>📈 Work On</p>
                  {improvements.map((s,i)=><p key={i} style={{ fontSize:13, color:"#9a3412", lineHeight:1.6, margin:"0 0 3px" }}>· {s}</p>)}
                </div>
              </div>
              <div style={{ ...CARD, marginBottom:12 }}>
                <p style={{ fontSize:13, fontWeight:700, color:"#374151", margin:"0 0 8px" }}>⭐ Model Answer</p>
                <p style={{ fontSize:14, color:"#4b5563", lineHeight:1.75, margin:0 }}>{modelAnswer}</p>
              </div>
              {tip && (
                <div style={{ background:"#faf5ff", border:"1px solid #e9d5ff", borderRadius:12, padding:"12px 16px", marginBottom:16 }}>
                  <p style={{ fontSize:13, fontWeight:700, color:"#7e22ce", margin:"0 0 5px" }}>💜 Pro Tip</p>
                  <p style={{ fontSize:13, color:"#6b21a8", lineHeight:1.65, margin:0 }}>{tip}</p>
                </div>
              )}
              <button onClick={goNext} style={BTN}>{qi+1>=qs.length?"🏁 View Final Results":`Next Question → (${qi+2} / ${qs.length})`}</button>
            </>
          );
        })()}

        {/* DONE */}
        {phase === "done" && (()=>{
          const exc=hist.filter(r=>r.score>=8).length;
          const gd=hist.filter(r=>r.score>=6&&r.score<8).length;
          const nw=hist.filter(r=>r.score<6).length;
          const num=Number(avg);
          return (
            <>
              <div style={{ background:"linear-gradient(135deg,#0f2744,#1e40af)", borderRadius:18, padding:"30px 24px", textAlign:"center", color:"#fff", marginBottom:16 }}>
                <div style={{ fontSize:52 }}>{num>=8?"🏆":num>=6?"🎯":"💪"}</div>
                <h1 style={{ margin:"10px 0 4px", fontSize:24, fontWeight:800 }}>Session Complete!</h1>
                <p style={{ opacity:.75, margin:"0 0 18px" }}>Well done, {prof.name.split(" ")[0]}!</p>
                <div style={{ display:"inline-flex", gap:28, background:"rgba(255,255,255,.13)", borderRadius:12, padding:"12px 28px" }}>
                  <div><div style={{ fontSize:38, fontWeight:900, lineHeight:1 }}>{avg}</div><div style={{ opacity:.65, fontSize:12 }}>avg score / 10</div></div>
                  <div style={{ width:1, background:"rgba(255,255,255,.2)" }} />
                  <div><div style={{ fontSize:38, fontWeight:900, lineHeight:1 }}>{hist.length}</div><div style={{ opacity:.65, fontSize:12 }}>questions done</div></div>
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:14 }}>
                {[{l:"Excellent",n:exc,color:"#16a34a",bg:"#f0fdf4",bdr:"#bbf7d0",icon:"⭐"},
                  {l:"Good",n:gd,color:"#d97706",bg:"#fefce8",bdr:"#fde68a",icon:"👍"},
                  {l:"Needs work",n:nw,color:"#dc2626",bg:"#fef2f2",bdr:"#fca5a5",icon:"📚"}
                ].map(({l,n,color,bg,bdr,icon})=>(
                  <div key={l} style={{ background:bg, border:`1px solid ${bdr}`, borderRadius:12, padding:"14px", textAlign:"center" }}>
                    <div style={{ fontSize:22 }}>{icon}</div>
                    <div style={{ fontSize:26, fontWeight:800, color }}>{n}</div>
                    <div style={{ fontSize:12, color:"#64748b" }}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{ ...CARD, marginBottom:14 }}>
                <p style={{ fontSize:13, fontWeight:700, color:"#374151", margin:"0 0 12px" }}>Question Breakdown</p>
                {hist.map((r,i)=>{
                  const cs=CAT[r.category]||CAT.Technical;
                  return (
                    <div key={i} style={{ display:"flex", gap:12, alignItems:"flex-start", padding:"9px 0", borderBottom:i<hist.length-1?"1px solid #e2e8f0":"none" }}>
                      <div style={{ minWidth:32, height:32, borderRadius:"50%", background:sbg(r.score), color:stext(r.score), border:`1px solid ${sbdr(r.score)}`, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:13, flexShrink:0 }}>{r.score}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ fontSize:13, color:"#111827", lineHeight:1.5, margin:"0 0 4px" }}>{r.question}</p>
                        <Pill bg={cs.bg} color={cs.color} bdr={cs.bdr}>{cs.icon} {r.category}</Pill>
                      </div>
                    </div>
                  );
                })}
              </div>
              <button onClick={reset} style={BTN}>🔄 Start a New Session</button>
            </>
          );
        })()}
      </div>

      <style>{`
        * { box-sizing: border-box; }
        @keyframes spin { to { transform: rotate(360deg); } }
        textarea:focus, input:focus, select:focus { border-color: #2563eb !important; box-shadow: 0 0 0 3px rgba(37,99,235,.12); }
        button:hover:not(:disabled) { opacity: .9; }
        button:active:not(:disabled) { transform: scale(.98); }
      `}</style>
    </div>
  );
}
