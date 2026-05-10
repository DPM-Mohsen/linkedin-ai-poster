"use client";
import { useState, useEffect, useRef } from "react";

const TONES = ["Thought leadership","Storytelling","Educational","Conversational","Data-driven"];
const HOOKS = ["Bold statement","Question","Controversial take","Personal story","Stat/Data"];
const LOADING_MSGS = ["Claude is writing your post...","Nailing the hook...","Adding that PM edge...","Polishing the punchline...","Almost done..."];
const STATUS_COLOR = { pending:"#fbbf24", scheduled:"#4f8ef7", sent:"#34d399", failed:"#f87171", done:"#34d399" };
const TODAY = new Date().toISOString().split("T")[0];
const fmtDate = (iso) => new Date(iso).toLocaleDateString("en-US",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});
const buildBacklogPrompt = (topic, tone, hook) => ({ topic, tone, hook, length:"medium", hashtags:"5", sfctx:"" });

function TagGroup({ options, value, onChange, small }) {
  return (
    <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
      {options.map(o=>(
        <div key={o} onClick={()=>onChange(o)} style={{
          padding:small?"3px 9px":"4px 11px", borderRadius:20,
          fontSize:small?"0.68rem":"0.72rem", fontWeight:600,
          border:o===value?"1px solid #4f8ef7":"1px solid #1e1e32",
          background:o===value?"rgba(79,142,247,0.12)":"#11111c",
          color:o===value?"#4f8ef7":"#5a5a7a",
          cursor:"pointer", userSelect:"none", transition:"all 0.15s"
        }}>{o}</div>
      ))}
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("backlog");
  // Generate
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("Thought leadership");
  const [hook, setHook] = useState("Bold statement");
  const [length, setLength] = useState("medium");
  const [hashtags, setHashtags] = useState("5");
  const [sfctx, setSfctx] = useState("");
  const [versions, setVersions] = useState([]);
  const [currentVer, setCurrentVer] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MSGS[0]);
  const [editedPost, setEditedPost] = useState("");
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);
  const [toast, setToast] = useState(null);
  // Backlog
  const [backlog, setBacklog] = useState([]);
  const [newTopic, setNewTopic] = useState("");
  const [newTone, setNewTone] = useState("Thought leadership");
  const [newHook, setNewHook] = useState("Bold statement");
  const [newNote, setNewNote] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("09:00");
  const [generatingId, setGeneratingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const timerRef = useRef(null);

  const currentPost = editedPost || versions[currentVer] || "";
  const pendingCount = backlog.filter(b=>b.status==="pending").length;
  const scheduledCount = backlog.filter(b=>b.status==="scheduled").length;

  // Load backlog from localStorage
  useEffect(()=>{
    try { const bl = JSON.parse(localStorage.getItem("li_backlog_v1") || "[]"); setBacklog(bl); } catch{}
  },[]);

  const saveBacklog = (updated) => {
    setBacklog(updated);
    try { localStorage.setItem("li_backlog_v1", JSON.stringify(updated)); } catch{}
  };

  // Auto-send scheduled posts every minute
  useEffect(()=>{
    timerRef.current = setInterval(async()=>{
      const bl = JSON.parse(localStorage.getItem("li_backlog_v1")||"[]");
      const now = new Date();
      let changed = false;
      for(const item of bl){
        if(item.status==="scheduled" && item.generatedPost && new Date(item.scheduleAt)<=now){
          try{ await apiPost(item.generatedPost); item.status="sent"; changed=true; }
          catch{ item.status="failed"; changed=true; }
        }
      }
      if(changed){ saveBacklog([...bl]); showToast("📬 Scheduled post sent to LinkedIn!","success"); }
    }, 60000);
    return ()=>clearInterval(timerRef.current);
  },[]);

  const showToast = (msg, type="success") => {
    setToast({msg,type});
    setTimeout(()=>setToast(null), 4000);
  };

  const startLoadingAnim = () => {
    setLoading(true); setLoadingMsg(LOADING_MSGS[0]);
    let i=0;
    const iv = setInterval(()=>{ i=(i+1)%LOADING_MSGS.length; setLoadingMsg(LOADING_MSGS[i]); },1600);
    return ()=>clearInterval(iv);
  };

  // Call server API to generate
  const apiGenerate = async (params) => {
    const res = await fetch("/api/generate", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify(params)
    });
    const data = await res.json();
    if(data.error) throw new Error(data.error);
    return data.post;
  };

  // Call server API to post to LinkedIn via Zapier
  const apiPost = async (text) => {
    const res = await fetch("/api/post", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({text})
    });
    const data = await res.json();
    if(data.error) throw new Error(data.error);
    return data;
  };

  const generate = async (addVersion=false) => {
    if(!topic.trim()){ showToast("Please enter a topic first.","error"); return; }
    const stop = startLoadingAnim();
    try{
      const post = await apiGenerate({topic,tone,hook,length,hashtags,sfctx});
      if(post){
        setVersions(prev=>addVersion?[...prev,post]:[post]);
        setCurrentVer(addVersion?versions.length:0);
        setEditedPost(""); setSent(false);
      }
    }catch(e){ showToast("❌ Error: "+e.message,"error"); }
    finally{ stop(); setLoading(false); }
  };

  const improve = async () => {
    if(!currentPost) return;
    const stop = startLoadingAnim();
    try{
      const res = await fetch("/api/generate",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({topic:`Improve this LinkedIn post. Sharpen the hook, tighten the flow, keep same length. Return only the improved post:\n\n${currentPost}`, tone, hook, length, hashtags:"0", sfctx:""})
      });
      const data = await res.json();
      if(data.post){ setVersions(prev=>[...prev,data.post]); setCurrentVer(versions.length); setEditedPost(""); setSent(false); }
    }catch(e){ showToast("❌ Error: "+e.message,"error"); }
    finally{ stop(); setLoading(false); }
  };

  const postToLinkedIn = async (text) => {
    if(!text?.trim()){ showToast("No post content.","error"); return; }
    setSending(true);
    showToast("📤 Sending to LinkedIn...","info");
    try{
      await apiPost(text);
      setSent(true);
      showToast("✅ Posted to LinkedIn! Check your profile.","success");
      setTimeout(()=>setSent(false),6000);
    }catch(e){ showToast("❌ Failed: "+e.message,"error"); }
    finally{ setSending(false); }
  };

  const copy = () => {
    if(!currentPost){ showToast("Generate a post first!","error"); return; }
    navigator.clipboard.writeText(currentPost)
      .then(()=>{ setCopied(true); showToast("✅ Copied to clipboard!","success"); setTimeout(()=>setCopied(false),2000); })
      .catch(()=>showToast("❌ Copy failed — select text manually","error"));
  };

  // Backlog actions
  const addToBacklog = () => {
    if(!newTopic.trim()) return;
    const item = { id:Date.now(), topic:newTopic, tone:newTone, hook:newHook, note:newNote,
      status:newDate?"scheduled":"pending",
      scheduleAt:newDate?new Date(`${newDate}T${newTime}`).toISOString():null,
      generatedPost:null, createdAt:new Date().toISOString() };
    saveBacklog([item,...backlog]);
    setNewTopic(""); setNewNote(""); setNewDate(""); setNewTime("09:00");
    showToast(newDate?`📅 Scheduled for ${fmtDate(item.scheduleAt)}`:"📋 Added to backlog!","success");
  };

  const generateFromBacklog = async (item) => {
    setGeneratingId(item.id);
    setTopic(item.topic); setTone(item.tone); setHook(item.hook||"Bold statement");
    setVersions([]); setEditedPost(""); setSent(false);
    setTab("generate");
    setLoading(true); setLoadingMsg(LOADING_MSGS[0]);
    let i=0; const iv=setInterval(()=>{ i=(i+1)%LOADING_MSGS.length; setLoadingMsg(LOADING_MSGS[i]); },1600);
    try{
      const post = await apiGenerate({topic:item.topic,tone:item.tone,hook:item.hook||"Bold statement",length:"medium",hashtags:"5",sfctx:""});
      if(post){
        setVersions([post]); setCurrentVer(0);
        const updated = backlog.map(b=>b.id===item.id?{...b,generatedPost:post,status:item.scheduleAt?"scheduled":"done"}:b);
        saveBacklog(updated);
      }
    }catch(e){ showToast("❌ Error: "+e.message,"error"); }
    finally{ clearInterval(iv); setGeneratingId(null); setLoading(false); }
  };

  const sendNow = async (item, isOverride=false) => {
    let text = item.generatedPost;
    if(!text){
      showToast("✦ Generating post first...","info");
      try{
        text = await apiGenerate({topic:item.topic,tone:item.tone,hook:item.hook||"Bold statement",length:"medium",hashtags:"5",sfctx:""});
        const withPost = backlog.map(b=>b.id===item.id?{...b,generatedPost:text}:b);
        saveBacklog(withPost);
      }catch(e){ showToast("❌ Generate failed: "+e.message,"error"); return; }
    }
    showToast(isOverride?"📤 Overriding schedule — sending now...":"📤 Sending to LinkedIn...","info");
    try{
      await apiPost(text);
      const updated = backlog.map(b=>b.id===item.id?{...b,status:"sent",generatedPost:text}:b);
      saveBacklog(updated);
      showToast(isOverride?"✅ Sent! Schedule cancelled.":"✅ Posted to LinkedIn!","success");
    }catch(e){ showToast("❌ Send failed: "+e.message,"error"); }
  };

  const deleteItem = (id) => saveBacklog(backlog.filter(b=>b.id!==id));

  const updateItemSchedule = (id, date, time) => {
    const updated = backlog.map(b=>b.id===id?{...b,scheduleAt:date?new Date(`${date}T${time}`).toISOString():null,status:date?(b.generatedPost?"scheduled":"pending"):"pending"}:b);
    saveBacklog(updated);
  };

  // Styles
  const c = {
    app:{fontFamily:"'DM Sans',sans-serif",background:"#0d0d14",color:"#e2e2ee",minHeight:"100vh",fontSize:14},
    hdr:{background:"linear-gradient(135deg,#0f0f1a,#0d1a2e)",borderBottom:"1px solid #1e1e32",padding:"12px 20px",display:"flex",alignItems:"center",justifyContent:"space-between"},
    nav:{display:"flex",background:"#0d0d14",borderBottom:"1px solid #1e1e32",position:"sticky",top:0,zIndex:10},
    navBtn:(a)=>({flex:1,padding:"10px 4px",textAlign:"center",fontFamily:"'Syne',sans-serif",fontSize:"0.65rem",fontWeight:700,letterSpacing:"0.5px",textTransform:"uppercase",color:a?"#4f8ef7":"#4a4a6a",cursor:"pointer",borderBottom:a?"2px solid #4f8ef7":"2px solid transparent",transition:"all 0.15s"}),
    panel:{maxWidth:720,margin:"0 auto",padding:20},
    lbl:{display:"block",fontSize:"0.68rem",color:"#5a5a7a",marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.7px"},
    inp:{width:"100%",background:"#11111c",border:"1px solid #1e1e32",borderRadius:8,color:"#e2e2ee",fontFamily:"inherit",fontSize:"0.85rem",padding:"9px 12px",outline:"none"},
    ta:{width:"100%",background:"#11111c",border:"1px solid #1e1e32",borderRadius:8,color:"#e2e2ee",fontFamily:"inherit",fontSize:"0.85rem",padding:"9px 12px",outline:"none",resize:"vertical",lineHeight:1.5},
    sel:{width:"100%",background:"#11111c",border:"1px solid #1e1e32",borderRadius:8,color:"#e2e2ee",fontFamily:"inherit",fontSize:"0.85rem",padding:"9px 12px",outline:"none"},
    g2:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12},
    card:{background:"#11111c",border:"1px solid #1e1e32",borderRadius:10,padding:"13px 14px",marginBottom:10},
    addCard:{background:"#0f0f1c",border:"1px dashed #2a2a40",borderRadius:10,padding:14,marginBottom:14},
    secTitle:{fontFamily:"'Syne',sans-serif",fontSize:"0.7rem",fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:"#5a5a7a",marginBottom:10},
    divider:{border:"none",borderTop:"1px solid #1e1e32",margin:"16px 0"},
    btnPrimary:{width:"100%",padding:"12px",background:"linear-gradient(135deg,#4f8ef7,#7c5ff7)",border:"none",borderRadius:9,fontFamily:"'Syne',sans-serif",fontSize:"0.85rem",fontWeight:700,color:"white",cursor:"pointer",marginTop:6},
    btnLI:{width:"100%",padding:"12px",background:"linear-gradient(135deg,#0A66C2,#0855a8)",border:"none",borderRadius:9,fontFamily:"'Syne',sans-serif",fontSize:"0.85rem",fontWeight:700,color:"white",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginTop:10},
    btnSent:{width:"100%",padding:"12px",background:"rgba(52,211,153,0.1)",border:"1px solid rgba(52,211,153,0.3)",borderRadius:9,fontFamily:"'Syne',sans-serif",fontSize:"0.85rem",fontWeight:700,color:"#34d399",cursor:"default",display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginTop:10},
    btnSm:(col)=>({padding:"5px 10px",borderRadius:6,fontSize:"0.68rem",fontWeight:600,border:`1px solid ${col}40`,background:`${col}15`,color:col,cursor:"pointer",fontFamily:"'Syne',sans-serif",whiteSpace:"nowrap"}),
    btnGhost:{padding:"5px 10px",borderRadius:6,fontSize:"0.68rem",fontWeight:600,border:"1px solid #1e1e32",background:"#1a1a28",color:"#8a8aaa",cursor:"pointer",fontFamily:"'Syne',sans-serif"},
    pill:(st)=>({display:"inline-block",padding:"2px 8px",borderRadius:10,fontSize:"0.62rem",fontWeight:700,background:`${STATUS_COLOR[st]||"#666"}20`,color:STATUS_COLOR[st]||"#666",border:`1px solid ${STATUS_COLOR[st]||"#666"}40`}),
    outWrap:{marginTop:14,background:"#11111c",border:"1px solid #1e1e32",borderRadius:10,overflow:"hidden"},
    outHdr:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",borderBottom:"1px solid #1e1e32",flexWrap:"wrap",gap:5},
    outBody:{padding:14,fontSize:"0.88rem",lineHeight:1.8,whiteSpace:"pre-wrap",color:"#d0d0e8",minHeight:100,maxHeight:300,overflowY:"auto",outline:"none"},
    outFoot:{padding:"6px 12px",borderTop:"1px solid #1e1e32",display:"flex",justifyContent:"flex-end"},
    spinner:{width:16,height:16,border:"2px solid rgba(79,142,247,0.2)",borderTopColor:"#4f8ef7",borderRadius:"50%",animation:"spin 0.7s linear infinite",flexShrink:0},
    spinnerW:{width:16,height:16,border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"white",borderRadius:"50%",animation:"spin 0.7s linear infinite",flexShrink:0},
  };

  const initials = "MK";

  return (
    <div style={c.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500&display=swap');
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeDown{from{opacity:0;transform:translateX(-50%) translateY(-10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:5px} ::-webkit-scrollbar-track{background:#0d0d14} ::-webkit-scrollbar-thumb{background:#1e1e32;border-radius:4px}
        input[type=date]::-webkit-calendar-picker-indicator,input[type=time]::-webkit-calendar-picker-indicator{filter:invert(0.4)}
        select option{background:#11111c}
        textarea:focus,input:focus,select:focus{border-color:#4f8ef7!important}
      `}</style>

      {/* TOAST */}
      {toast && (
        <div style={{position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",zIndex:9999,padding:"11px 20px",borderRadius:10,background:toast.type==="success"?"rgba(52,211,153,0.97)":toast.type==="error"?"rgba(248,113,113,0.97)":"rgba(79,142,247,0.97)",color:"white",fontWeight:700,fontSize:"0.85rem",boxShadow:"0 4px 30px rgba(0,0,0,0.5)",animation:"fadeDown 0.25s ease",whiteSpace:"nowrap"}}>
          {toast.msg}
        </div>
      )}

      {/* HEADER */}
      <div style={c.hdr}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:34,height:34,borderRadius:8,background:"linear-gradient(135deg,#0A66C2,#4f8ef7)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:"white",fontSize:13,fontFamily:"'Syne',sans-serif"}}>in</div>
          <div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:"1rem",fontWeight:800}}>LinkedIn AI Poster</div>
            <div style={{fontSize:"0.65rem",color:"#5a5a7a"}}>Claude · Zapier · Mohsen Khorsand</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6,background:"rgba(52,211,153,0.1)",border:"1px solid rgba(52,211,153,0.25)",borderRadius:20,padding:"4px 12px",fontSize:"0.7rem",color:"#34d399",fontWeight:600}}>
          <div style={{width:6,height:6,borderRadius:"50%",background:"#34d399"}}/> Live
        </div>
      </div>

      {/* NAV */}
      <div style={c.nav}>
        <div style={c.navBtn(tab==="backlog")} onClick={()=>setTab("backlog")}>
          📋 Backlog & Schedule
          {(pendingCount+scheduledCount)>0&&<span style={{marginLeft:4,background:"#4f8ef7",color:"white",borderRadius:"50%",width:15,height:15,fontSize:"0.6rem",display:"inline-flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>{pendingCount+scheduledCount}</span>}
        </div>
        <div style={c.navBtn(tab==="generate")} onClick={()=>setTab("generate")}>✦ Generate</div>
        <div style={c.navBtn(tab==="preview")} onClick={()=>setTab("preview")}>◈ Preview</div>
      </div>

      {/* ══ BACKLOG TAB ══ */}
      {tab==="backlog"&&(
        <div style={c.panel}>
          <div style={c.secTitle}>+ New Topic</div>
          <div style={c.addCard}>
            <div style={{marginBottom:12}}>
              <label style={c.lbl}>Topic idea</label>
              <textarea style={{...c.ta,minHeight:56}} value={newTopic} onChange={e=>setNewTopic(e.target.value)} placeholder="e.g. How Agentforce is redefining the Salesforce PM role in 2026..."/>
            </div>
            <div style={{marginBottom:12}}>
              <label style={c.lbl}>Tone</label>
              <TagGroup options={TONES} value={newTone} onChange={setNewTone} small/>
            </div>
            <div style={{marginBottom:12}}>
              <label style={c.lbl}>Hook style</label>
              <TagGroup options={HOOKS} value={newHook} onChange={setNewHook} small/>
            </div>
            <div style={{background:"rgba(79,142,247,0.05)",border:"1px solid #1e1e32",borderRadius:8,padding:12,marginBottom:12}}>
              <label style={{...c.lbl,color:"#4f8ef7",marginBottom:8}}>📅 Schedule (optional)</label>
              <div style={c.g2}>
                <div><label style={c.lbl}>Date</label><input style={{...c.inp,colorScheme:"dark"}} type="date" value={newDate} onChange={e=>setNewDate(e.target.value)} min={TODAY}/></div>
                <div><label style={c.lbl}>Time</label><input style={{...c.inp,colorScheme:"dark"}} type="time" value={newTime} onChange={e=>setNewTime(e.target.value)}/></div>
              </div>
              {newDate&&<div style={{fontSize:"0.7rem",color:"#4f8ef7",marginTop:6}}>📅 Will auto-post on {fmtDate(new Date(`${newDate}T${newTime}`).toISOString())}</div>}
            </div>
            <div style={{marginBottom:12}}>
              <label style={c.lbl}>Note (optional)</label>
              <input style={c.inp} value={newNote} onChange={e=>setNewNote(e.target.value)} placeholder="Source, deadline, campaign..."/>
            </div>
            <button style={c.btnPrimary} onClick={addToBacklog} disabled={!newTopic.trim()}>
              {newDate?"📅 Add & Schedule":"+ Add to Backlog"}
            </button>
          </div>

          <hr style={c.divider}/>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <div style={c.secTitle}>Your Backlog & Queue</div>
            <div style={{display:"flex",gap:10,fontSize:"0.7rem",color:"#5a5a7a"}}>
              <span>📋 {pendingCount} pending</span>
              <span>📅 {scheduledCount} scheduled</span>
              <span>✅ {backlog.filter(b=>b.status==="sent"||b.status==="done").length} done</span>
            </div>
          </div>

          {backlog.length===0?(
            <div style={{textAlign:"center",padding:"40px 16px",color:"#3a3a5a"}}>
              <div style={{fontSize:"2.5rem",marginBottom:10}}>📋</div>
              <div>No topics yet — add your first idea above!</div>
            </div>
          ):backlog.map(item=>{
            const isExpanded=expandedId===item.id;
            const isDone=item.status==="sent"||item.status==="done";
            return(
              <div key={item.id} style={{...c.card,opacity:isDone?0.55:1,borderColor:item.status==="scheduled"?"rgba(79,142,247,0.35)":"#1e1e32"}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:8}}>
                  <div style={{flex:1,cursor:"pointer"}} onClick={()=>setExpandedId(isExpanded?null:item.id)}>
                    <div style={{fontSize:"0.85rem",color:"#e2e2ee",fontWeight:500,lineHeight:1.4,marginBottom:5}}>{item.topic}</div>
                    <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                      <span style={c.pill(item.status)}>{item.status}</span>
                      <span style={{fontSize:"0.65rem",color:"#5a5a7a"}}>{item.tone}</span>
                      {item.scheduleAt&&<span style={{fontSize:"0.65rem",color:"#4f8ef7"}}>📅 {fmtDate(item.scheduleAt)}</span>}
                      {item.note&&<span style={{fontSize:"0.65rem",color:"#5a5a7a"}}>· {item.note}</span>}
                    </div>
                  </div>
                  <div style={{display:"flex",gap:5,flexShrink:0,flexWrap:"wrap",justifyContent:"flex-end"}}>
                    {!isDone&&<button style={c.btnSm("#a78bfa")} onClick={()=>generateFromBacklog(item)} disabled={generatingId===item.id}>{generatingId===item.id?"...":"✦ Generate"}</button>}
                    {item.status!=="sent"&&item.status!=="done"&&(
                      <button style={{...c.btnSm("#34d399"),...(item.status==="scheduled"?{background:"rgba(52,211,153,0.2)",border:"1px solid #34d399",fontWeight:700}:{})}}
                        onClick={()=>sendNow(item,item.status==="scheduled")}>
                        {item.status==="scheduled"?"▶ Send now (override)":"▶ Send now"}
                      </button>
                    )}
                    <button style={c.btnSm("#f87171")} onClick={()=>deleteItem(item.id)}>✕</button>
                  </div>
                </div>
                {isExpanded&&(
                  <div style={{marginTop:10,borderTop:"1px solid #1e1e32",paddingTop:10}}>
                    {item.generatedPost
                      ?<div style={{background:"#0d0d14",borderRadius:8,padding:10,fontSize:"0.8rem",color:"#c0c0d8",lineHeight:1.65,whiteSpace:"pre-wrap",maxHeight:150,overflowY:"auto",marginBottom:10}}>{item.generatedPost}</div>
                      :<div style={{fontSize:"0.72rem",color:"#5a5a7a",marginBottom:10,fontStyle:"italic"}}>No post generated yet — click ✦ Generate</div>
                    }
                    {!isDone&&(
                      <div style={{background:"rgba(79,142,247,0.05)",border:"1px solid #1e1e32",borderRadius:8,padding:10}}>
                        <label style={{...c.lbl,color:"#4f8ef7",marginBottom:6}}>📅 Change schedule</label>
                        <div style={c.g2}>
                          <div><label style={c.lbl}>Date</label>
                            <input style={{...c.inp,colorScheme:"dark",fontSize:"0.78rem"}} type="date" min={TODAY}
                              defaultValue={item.scheduleAt?new Date(item.scheduleAt).toISOString().split("T")[0]:""}
                              onChange={e=>updateItemSchedule(item.id,e.target.value,"09:00")}/>
                          </div>
                          <div><label style={c.lbl}>Time</label>
                            <input style={{...c.inp,colorScheme:"dark",fontSize:"0.78rem"}} type="time"
                              defaultValue={item.scheduleAt?new Date(item.scheduleAt).toLocaleTimeString("en-US",{hour12:false,hour:"2-digit",minute:"2-digit"}):"09:00"}
                              onChange={e=>{
                                const d=item.scheduleAt?new Date(item.scheduleAt).toISOString().split("T")[0]:TODAY;
                                updateItemSchedule(item.id,d,e.target.value);
                              }}/>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <div style={{background:"rgba(251,191,36,0.05)",border:"1px solid rgba(251,191,36,0.12)",borderRadius:8,padding:10,fontSize:"0.72rem",color:"#8a7a5a",lineHeight:1.6}}>
            ⏰ Scheduled posts auto-send while this page is open. The page must be open at the scheduled time for auto-send to work.
          </div>
        </div>
      )}

      {/* ══ GENERATE TAB ══ */}
      {tab==="generate"&&(
        <div style={c.panel}>
          <div style={{marginBottom:14}}>
            <label style={c.lbl}>What's this post about?</label>
            <textarea style={{...c.ta,minHeight:70}} value={topic} onChange={e=>setTopic(e.target.value)} placeholder="e.g. Why modern companies need a Salesforce PM — the role evolved from admin to AI orchestrator..."/>
          </div>
          <div style={{marginBottom:14}}>
            <label style={c.lbl}>Tone</label>
            <TagGroup options={TONES} value={tone} onChange={setTone}/>
          </div>
          <div style={{...c.g2,marginBottom:14}}>
            <div><label style={c.lbl}>Length</label>
              <select style={c.sel} value={length} onChange={e=>setLength(e.target.value)}>
                <option value="short">Short (~150w)</option>
                <option value="medium">Medium (~250w)</option>
                <option value="long">Long (~400w)</option>
              </select>
            </div>
            <div><label style={c.lbl}>Hashtags</label>
              <select style={c.sel} value={hashtags} onChange={e=>setHashtags(e.target.value)}>
                <option value="3">3 hashtags</option>
                <option value="5">5 hashtags</option>
                <option value="7">7 hashtags</option>
                <option value="0">None</option>
              </select>
            </div>
          </div>
          <div style={{marginBottom:14}}>
            <label style={c.lbl}>Salesforce context (optional)</label>
            <input style={c.inp} value={sfctx} onChange={e=>setSfctx(e.target.value)} placeholder="e.g. Agentforce, Einstein AI, Spring '26 release..."/>
          </div>
          <div style={{marginBottom:14}}>
            <label style={c.lbl}>Hook style</label>
            <TagGroup options={HOOKS} value={hook} onChange={setHook}/>
          </div>
          <button style={{...c.btnPrimary,opacity:loading?0.6:1}} disabled={loading} onClick={()=>generate(false)}>
            {loading?"✦ Writing...":"✦ Generate with Claude"}
          </button>
          {loading&&<div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 0",color:"#4f8ef7",fontSize:"0.8rem"}}><div style={c.spinner}/>{loadingMsg}</div>}

          {versions.length>0&&(
            <div style={c.outWrap}>
              {versions.length>1&&(
                <div style={{display:"flex",gap:5,padding:"8px 12px 0"}}>
                  {versions.map((_,i)=>(
                    <div key={i} onClick={()=>{setCurrentVer(i);setEditedPost("");setSent(false);}} style={{padding:"2px 9px",borderRadius:10,fontSize:"0.65rem",fontWeight:700,border:i===currentVer?"1px solid #a78bfa":"1px solid #1e1e32",background:i===currentVer?"rgba(167,139,250,0.12)":"#1a1a28",color:i===currentVer?"#a78bfa":"#5a5a7a",cursor:"pointer"}}>v{i+1}</div>
                  ))}
                </div>
              )}
              <div style={c.outHdr}>
                <span style={{fontFamily:"'Syne',sans-serif",fontSize:"0.68rem",fontWeight:700,textTransform:"uppercase",letterSpacing:1,color:"#5a5a7a"}}>Generated Post</span>
                <div style={{display:"flex",gap:5}}>
                  <button style={c.btnGhost} onClick={()=>generate(true)} disabled={loading}>↺ New</button>
                  <button style={c.btnGhost} onClick={improve} disabled={loading}>✦ Improve</button>
                  <button style={{...c.btnGhost,color:copied?"#34d399":"#8a8aaa",borderColor:copied?"#34d399":"#1e1e32"}} onClick={copy}>{copied?"✓ Copied":"⧉ Copy"}</button>
                </div>
              </div>
              <div style={c.outBody} contentEditable suppressContentEditableWarning onInput={e=>setEditedPost(e.currentTarget.innerText)}>{versions[currentVer]}</div>
              <div style={c.outFoot}><span style={{fontSize:"0.65rem",color:currentPost.length>3000?"#f87171":currentPost.length>2500?"#fbbf24":"#3a3a5a"}}>{currentPost.length} chars</span></div>
              <div style={{padding:"0 12px 12px"}}>
                {sent
                  ?<div style={c.btnSent}>✅ Posted to LinkedIn successfully!</div>
                  :<button style={{...c.btnLI,opacity:sending?0.7:1}} onClick={()=>postToLinkedIn(currentPost)} disabled={sending}>
                    {sending?<><div style={c.spinnerW}/>Posting to LinkedIn...</>:<>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="white"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                      Post to LinkedIn Now
                    </>}
                  </button>
                }
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ PREVIEW TAB ══ */}
      {tab==="preview"&&(
        <div style={c.panel}>
          {currentPost?(
            <>
              <div style={{background:"white",borderRadius:12,padding:18,marginBottom:12}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                  <div style={{width:44,height:44,borderRadius:"50%",background:"linear-gradient(135deg,#0A66C2,#0099ff)",display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontWeight:800,fontSize:"0.95rem",flexShrink:0}}>{initials}</div>
                  <div>
                    <div style={{fontWeight:700,color:"#111",fontSize:"0.9rem"}}>Mohsen Khorsand</div>
                    <div style={{color:"#666",fontSize:"0.75rem"}}>Senior PM · Salesforce</div>
                    <div style={{color:"#999",fontSize:"0.68rem"}}>Just now · 🌐</div>
                  </div>
                </div>
                <div style={{whiteSpace:"pre-wrap",color:"#333",fontSize:"0.88rem",lineHeight:1.7}}>{currentPost}</div>
                <div style={{marginTop:12,paddingTop:10,borderTop:"1px solid #eee",display:"flex",gap:16}}>
                  {["👍 Like","💬 Comment","🔄 Repost","✉️ Send"].map(a=><span key={a} style={{fontSize:"0.75rem",color:"#666",fontWeight:600}}>{a}</span>)}
                </div>
              </div>
              {sent
                ?<div style={c.btnSent}>✅ Posted to LinkedIn successfully!</div>
                :<button style={{...c.btnLI,opacity:sending?0.7:1}} onClick={()=>postToLinkedIn(currentPost)} disabled={sending}>
                  {sending?<><div style={c.spinnerW}/>Posting...</>:<>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="white"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                    Post to LinkedIn Now
                  </>}
                </button>
              }
            </>
          ):(
            <div style={{textAlign:"center",padding:"60px 20px",color:"#3a3a5a"}}>
              <div style={{fontSize:"3rem",marginBottom:12}}>📝</div>
              <div>Generate a post first, then preview it here.</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
