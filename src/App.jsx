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
// ── so your GROQ_API_KEY stays secret on the server side
async function callAI(sys, usr) {
  const r = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      max_tokens: 4000,
      system: sys,
      messages: [{ role: "user", content: usr }],
    }),
  });
  const d = await r.json();
  if (!r.ok || d.error) throw new Error(typeof d.error === "string" ? d.error : d.error?.message || "AI request failed. Please try again.");
  const text = d.content?.[0]?.text;
  if (!text) throw new Error("The AI returned an empty response.");
  return text;
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


const SpeechRecognitionAPI = typeof window !== "undefined"
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;
const FILLER_RE = /\b(um+|uh+|erm+|ah+|basically|you know|i mean)\b/gi;
const countWords = text => (text.trim().match(/\b[\w'-]+\b/g) || []).length;
const analyzeSpeech = (text, durationSeconds, pauses = []) => {
  const words = countWords(text);
  const fillers = (text.match(FILLER_RE) || []).length;
  const minutes = Math.max(durationSeconds / 60, 1 / 60);
  return {
    words,
    durationSeconds: Math.max(0, durationSeconds),
    wordsPerMinute: durationSeconds > 0 ? Math.round(words / minutes) : 0,
    fillerCount: fillers,
    fillerWords: [...new Set((text.match(FILLER_RE) || []).map(x => x.toLowerCase()))],
    longPauses: pauses.filter(p => p >= 1.2).length,
    source: "voice",
  };
};

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
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [micStatus, setMicStatus] = useState("idle");
  const [speechSupported, setSpeechSupported] = useState(false);
  const [speechError, setSpeechError] = useState("");
  const [speechStats, setSpeechStats] = useState(null);
  const recognitionRef = useRef(null);
  const speechStartedAt = useRef(0);
  const lastSpeechAt = useRef(0);
  const pauseGaps = useRef([]);
  const transcriptRef = useRef("");
  const speechUsedRef = useRef(false);
  const tid = useRef(null);

  useEffect(() => {
    setSpeechSupported(Boolean(SpeechRecognitionAPI));
    return () => {
      try { recognitionRef.current?.stop(); } catch {}
      window.speechSynthesis?.cancel();
    };
  }, []);


  const speak = (text) => {
    if (!voiceEnabled || !("speechSynthesis" in window) || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.96;
    utterance.pitch = 1;
    utterance.lang = "en-IN";
    window.speechSynthesis.speak(utterance);
  };

  const stopListening = () => {
    try { recognitionRef.current?.stop(); } catch {}
    setMicStatus("idle");
  };

  const startListening = () => {
    if (!SpeechRecognitionAPI) {
      setSpeechError("Speech recognition is not supported in this browser. Please use Chrome or Edge, or type your answer.");
      return;
    }
    setSpeechError("");
    setSpeechStats(null);
    window.speechSynthesis?.cancel();
    const recognition = new SpeechRecognitionAPI();
    recognition.lang = "en-IN";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognitionRef.current = recognition;
    transcriptRef.current = ans;
    speechUsedRef.current = true;
    speechStartedAt.current = Date.now();
    lastSpeechAt.current = 0;
    pauseGaps.current = [];
    setMicStatus("listening");
    recognition.onresult = event => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const part = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += part;
        else interimText += part;
      }
      if (finalText.trim()) {
        const now = Date.now();
        if (lastSpeechAt.current) pauseGaps.current.push((now - lastSpeechAt.current) / 1000);
        lastSpeechAt.current = now;
        transcriptRef.current = `${transcriptRef.current}${transcriptRef.current && !/\s$/.test(transcriptRef.current) ? " " : ""}${finalText.trim()}`;
        setAns(`${transcriptRef.current}${interimText ? " " + interimText : ""}`);
      } else if (interimText) {
        setAns(`${transcriptRef.current}${transcriptRef.current ? " " : ""}${interimText}`);
      }
    };
    recognition.onerror = event => {
      setMicStatus("idle");
      setSpeechError(event.error === "not-allowed"
        ? "Microphone permission was denied. Allow microphone access in your browser settings."
        : `Speech recognition error: ${event.error}. You can continue by typing.`);
    };
    recognition.onend = () => {
      setMicStatus("idle");
      const duration = speechStartedAt.current ? (Date.now() - speechStartedAt.current) / 1000 : 0;
      setSpeechStats(analyzeSpeech(transcriptRef.current, duration, pauseGaps.current));
    };
    try { recognition.start(); }
    catch (error) {
      setMicStatus("idle");
      setSpeechError("Unable to start microphone. Please stop any active recording and try again.");
    }
  };

  useEffect(() => {
    if (phase !== "interview") return;
    setSec(0);
    tid.current = setInterval(() => setSec(s => s + 1), 1000);
    return () => clearInterval(tid.current);
  }, [phase, qi]);

  useEffect(() => {
    if (phase === "interview" && qs[qi] && voiceEnabled) {
      const timer = setTimeout(() => speak(`Question ${qi + 1}. ${qs[qi].question}`), 350);
      return () => clearTimeout(timer);
    }
    if (phase !== "interview") stopListening();
  }, [phase, qi, voiceEnabled]);

  const fp  = (k, v) => setProf(p => ({ ...p, [k]:v }));
  const avg = hist.length ? (hist.reduce((s,h) => s+h.score, 0)/hist.length).toFixed(1) : null;

  const startSession = async () => {
    if (!prof.name.trim()||!prof.exp||!prof.role.trim()) {
      setErr("Please fill in name, experience level, and job role."); return;
    }
    setErr(""); setSpeechStats(null); setSpeechError(""); window.speechSynthesis?.cancel(); setPhase("gen");
    try {
      const txt = await callAI(
        "Expert HR interview coach. Return ONLY valid JSON, no markdown.",
        `Generate 30 interview questions for: ${prof.role} | ${prof.exp}${prof.industry?" | "+prof.industry:""}.
Mix: 12 Technical, 8 Behavioral (STAR), 6 Situational, 4 HR.
Vary difficulty: roughly 10 Easy, 12 Medium, 8 Hard across the set.
JSON only: {"questions":[{"id":1,"question":"...","category":"Technical","difficulty":"Easy","hint":"..."}]}`
      );
      const { questions } = toJSON(txt);
      setQs(questions); setQi(0); setHist([]); setPhase("interview");
    } catch { setErr("Couldn't generate questions. Please try again."); setPhase("setup"); }
  };

  const submitAnswer = async () => {
    if (!ans.trim()) { setErr("Please write your answer before submitting."); return; }
    stopListening();
    setErr(""); setPhase("eval");
    const q = qs[qi];
    const micDuration = speechStartedAt.current ? (Date.now() - speechStartedAt.current) / 1000 : 0;
    const measuredSpeech = speechStats || (speechUsedRef.current
      ? analyzeSpeech(ans || transcriptRef.current, micDuration, pauseGaps.current)
      : { ...analyzeSpeech(ans, 0), source: "typed" });
    try {
      const txt = await callAI(
        "Senior HR expert and interview coach. Score 1–10. Return ONLY valid JSON.",
        `Role: ${prof.role} (${prof.exp})
Q [${q.category}]: "${q.question}"
Answer: "${ans}"
Speaking metrics (descriptive, do not use as a proxy for technical correctness): ${JSON.stringify(measuredSpeech)}
Return a concise contextual follow-up question in followUpQuestion, or an empty string if none is useful.
JSON: {"score":7,"feedback":"...","strengths":["...","..."],"improvements":["...","..."],"modelAnswer":"...","tip":"...","followUpQuestion":"..."}`
      );
      const result = toJSON(txt);
      const entry  = { ...q, ans, sec, speech: measuredSpeech, ...result, followUpQuestion: typeof result.followUpQuestion === "string" ? result.followUpQuestion.trim() : "" };
      setEv(entry); setHist(h => [...h, entry]); setPhase("feedback");
      if (voiceEnabled) speak(result.feedback || "Your answer has been evaluated.");
    } catch { setErr("Evaluation failed. Please try again."); setPhase("interview"); }
  };

  const goNext = () => {
    stopListening(); setAns(""); setEv(null); setErr(""); setSpeechStats(null); setSpeechError("");
    speechUsedRef.current = false; transcriptRef.current = ""; speechStartedAt.current = 0; pauseGaps.current = [];
    qi+1 >= qs.length ? setPhase("done") : (setQi(i => i+1), setPhase("interview"));
  };

  const reset = () => {
    stopListening(); window.speechSynthesis?.cancel();
    setPhase("setup"); setQs([]); setQi(0); setAns(""); setHist([]); setEv(null); setErr(""); setSpeechStats(null); setSpeechError(""); speechUsedRef.current = false; transcriptRef.current = "";
  };

  return (
    <div style={{ minHeight:"100vh", background:"#f0f4f8", fontFamily:"system-ui,-apple-system,sans-serif" }}>

      {/* NAV */}
            <div style={{ background:"#0f2744", padding:"13px 24px", display:"flex", justifyContent:"space-between", alignItems:"center", position:"sticky", top:0, zIndex:20 }}>
        <div style={{ display:"flex", alignItems:"center", gap:9 }}>
          <span style={{ fontSize:20 }}>🎯</span>
          <span style={{ color:"#fff", fontWeight:800, fontSize:15 }}>Interview Trainer Agent</span>
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

              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:10, padding:"12px 14px", marginBottom:14 }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:"#0f2744" }}>🎙️ Voice interview mode</div>
                  <div style={{ fontSize:12, color:"#64748b", marginTop:3 }}>AI reads questions and feedback aloud. You can answer by speaking or typing.</div>
                </div>
                <input aria-label="Enable voice interview" type="checkbox" checked={voiceEnabled} onChange={e=>setVoiceEnabled(e.target.checked)} style={{ width:20, height:20, accentColor:"#2563eb", flexShrink:0 }} />
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
                <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:10 }}>
                  <button type="button" onClick={micStatus === "listening" ? stopListening : startListening}
                    style={{ padding:"9px 14px", border:0, borderRadius:8, background:micStatus === "listening" ? "#fee2e2" : "#e0f2fe", color:micStatus === "listening" ? "#b91c1c" : "#075985", fontWeight:700, cursor:"pointer" }}>
                    {micStatus === "listening" ? "⏹ Stop recording" : "🎙️ Speak your answer"}
                  </button>
                  <button type="button" onClick={()=>speak(q.question)} style={{ padding:"9px 14px", border:"1px solid #cbd5e1", borderRadius:8, background:"#fff", color:"#334155", fontWeight:600, cursor:"pointer" }}>🔊 Hear question again</button>
                  {speechStats && <span style={{ alignSelf:"center", fontSize:11, color:"#64748b" }}>Speech captured · {speechStats.words} words</span>}
                </div>
                {micStatus === "listening" && <div role="status" style={{ marginTop:8, color:"#b91c1c", fontSize:12, fontWeight:700 }}>● Listening… speak naturally, then press Stop recording.</div>}
                {speechError && <div role="alert" style={{ marginTop:8, color:"#b91c1c", fontSize:12 }}>{speechError}</div>}
                {!speechSupported && <div style={{ marginTop:8, color:"#92400e", fontSize:12 }}>Voice input works best in Chrome or Edge. Typing remains available.</div>}
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
              {ev.speech && <div style={{ ...CARD, marginBottom:12 }}>
                <p style={{ fontSize:13, fontWeight:700, color:"#0f2744", margin:"0 0 10px" }}>🎙️ Speaking analysis</p>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10 }}>
                  {[{label:"Speaking pace",value:ev.speech.wordsPerMinute ? `${ev.speech.wordsPerMinute} WPM` : "Not measured"},{label:"Filler words",value:ev.speech.source === "typed" ? "Not captured" : ev.speech.fillerCount},{label:"Answer length",value:`${ev.speech.words} words`},{label:"Recognition segment gaps (est.)",value:ev.speech.source === "typed" ? "Not captured" : (ev.speech.longPauses ?? "Not measured")}].map(item=><div key={item.label} style={{ background:"#f8fafc", borderRadius:9, padding:11 }}><div style={{ color:"#64748b", fontSize:11 }}>{item.label}</div><div style={{ color:"#0f2744", fontSize:17, fontWeight:800, marginTop:3 }}>{item.value}</div></div>)}
                </div>
                <p style={{ color:"#64748b", fontSize:11, lineHeight:1.5, margin:"10px 0 0" }}>These are estimates based on the recognized transcript and recording session. Browser speech recognition does not provide a reliable acoustic measure of pronunciation, confidence or exact silence duration.</p>
              </div>}
              <div style={{ ...CARD, marginBottom:12 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8 }}>
                  <p style={{ fontSize:13, fontWeight:700, color:"#374151", margin:"0 0 8px" }}>⭐ Model Answer</p>
                  <button type="button" onClick={()=>speak(modelAnswer)} style={{ padding:"6px 10px", border:"1px solid #cbd5e1", borderRadius:7, background:"#fff", color:"#334155", cursor:"pointer", fontSize:12 }}>🔊 Listen</button>
                </div>
                <p style={{ fontSize:14, color:"#4b5563", lineHeight:1.75, margin:0 }}>{modelAnswer}</p>
              </div>
              {tip && (
                <div style={{ background:"#faf5ff", border:"1px solid #e9d5ff", borderRadius:12, padding:"12px 16px", marginBottom:16 }}>
                  <p style={{ fontSize:13, fontWeight:700, color:"#7e22ce", margin:"0 0 5px" }}>💜 Pro Tip</p>
                  <p style={{ fontSize:13, color:"#6b21a8", lineHeight:1.65, margin:0 }}>{tip}</p>
                </div>
              )}
              {ev.followUpQuestion && !String(ev.id).startsWith("followup-") && <button onClick={()=>{ setQs(prev=>[...prev.slice(0,qi+1),{id:`followup-${qi}`,question:ev.followUpQuestion,category:ev.category||"Technical",difficulty:ev.difficulty||"Medium",hint:"Build on your previous answer."},...prev.slice(qi+1)]); stopListening(); setAns(""); setEv(null); setErr(""); setSpeechStats(null); setSpeechError(""); speechUsedRef.current=false; transcriptRef.current=""; setQi(i=>i+1); setPhase("interview"); }} style={{ ...BTN, marginBottom:10, background:"linear-gradient(135deg,#6d28d9,#9333ea)" }}>↪ Answer AI follow-up question</button>}
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
                <p style={{ fontSize:13, fontWeight:700, color:"#0f2744", margin:"0 0 12px" }}>🎙️ Overall speaking performance</p>
                {(()=>{ const speech=hist.filter(x=>x.speech && x.speech.source !== "typed"); const totalWords=speech.reduce((n,x)=>n+x.speech.words,0); const totalSeconds=speech.reduce((n,x)=>n+x.speech.durationSeconds,0); const fillers=speech.reduce((n,x)=>n+x.speech.fillerCount,0); const gaps=speech.reduce((n,x)=>n+(x.speech.longPauses||0),0); const wpm=totalSeconds?Math.round(totalWords/(totalSeconds/60)):0; return <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10 }}>{[{l:"Average speaking pace",v:wpm?`${wpm} WPM`:"N/A"},{l:"Total filler words",v:fillers},{l:"Total spoken words",v:totalWords},{l:"Estimated long gaps",v:gaps}].map(x=><div key={x.l} style={{ background:"#f8fafc", borderRadius:9, padding:12 }}><div style={{ fontSize:11, color:"#64748b" }}>{x.l}</div><div style={{ fontSize:21, fontWeight:800, color:"#0f2744", marginTop:3 }}>{x.v}</div></div>)}</div> })()}
                <p style={{ color:"#64748b", fontSize:11, margin:"10px 0 0", lineHeight:1.5 }}>Speaking metrics are estimates from browser speech recognition. They are coaching indicators, not a validated assessment of confidence, accent or communication ability.</p>
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
