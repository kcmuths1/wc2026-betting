import { loadData, saveData, subscribeToData } from "./firebase.js";
import { useState, useEffect, useCallback, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis } from "recharts";

// ─── ZAFRONIX API (inlined — no separate module) ──────────────────────────────
const _ZAF_KEY  = "zwc_free_85b9322115f4fe82a4e3a87a";
const _ZAF_BASE = "https://api.zafronix.com/fifa/worldcup/v1";
const _ZAF_NAMES = {"United States":"USA","Korea Republic":"South Korea","Republic of Korea":"South Korea","Bosnia Herzegovina":"Bosnia & Herz.","Bosnia-Herzegovina":"Bosnia & Herz.","Côte d'Ivoire":"Ivory Coast","Cote d'Ivoire":"Ivory Coast","Curacao":"Curaçao","Turkey":"Türkiye","Czech Republic":"Czechia","Cape Verde Islands":"Cape Verde","Congo DR":"DR Congo","Democratic Republic of Congo":"DR Congo"};
const _zNorm = n => _ZAF_NAMES[n] || n;
const _ZAF_IDS = {"Mexico|||South Africa":1,"South Korea|||Czechia":2,"Canada|||Bosnia & Herz.":3,"USA|||Paraguay":4,"Qatar|||Switzerland":5,"Brazil|||Morocco":6,"Haiti|||Scotland":7,"Australia|||Türkiye":8,"Germany|||Curaçao":9,"Netherlands|||Japan":10,"Ivory Coast|||Ecuador":11,"Sweden|||Tunisia":12,"Spain|||Cape Verde":13,"Belgium|||Egypt":14,"Saudi Arabia|||Uruguay":15,"Iran|||New Zealand":16,"France|||Senegal":17,"Iraq|||Norway":18,"Argentina|||Algeria":19,"Austria|||Jordan":20,"Portugal|||DR Congo":21,"England|||Croatia":22,"Ghana|||Panama":23,"Uzbekistan|||Colombia":24,"Czechia|||South Africa":25,"Switzerland|||Bosnia & Herz.":26,"Canada|||Qatar":27,"Mexico|||South Korea":28,"USA|||Australia":29,"Scotland|||Morocco":30,"Brazil|||Haiti":31,"Türkiye|||Paraguay":32,"Netherlands|||Sweden":33,"Germany|||Ivory Coast":34,"Ecuador|||Curaçao":35,"Tunisia|||Japan":36,"Spain|||Saudi Arabia":37,"Belgium|||Iran":38,"Uruguay|||Cape Verde":39,"New Zealand|||Egypt":40,"Argentina|||Austria":41,"France|||Iraq":42,"Norway|||Senegal":43,"Jordan|||Algeria":44,"Portugal|||Uzbekistan":45,"England|||Ghana":46,"Panama|||Croatia":47,"Colombia|||DR Congo":48,"Switzerland|||Canada":49,"Bosnia & Herz.|||Qatar":50,"Scotland|||Brazil":51,"Morocco|||Haiti":52,"Czechia|||Mexico":53,"South Africa|||South Korea":54,"Curaçao|||Ivory Coast":55,"Ecuador|||Germany":56,"Japan|||Sweden":57,"Tunisia|||Netherlands":58,"Türkiye|||USA":59,"Paraguay|||Australia":60,"Norway|||France":61,"Senegal|||Iraq":62,"Cape Verde|||Saudi Arabia":63,"Uruguay|||Spain":64,"Egypt|||Iran":65,"New Zealand|||Belgium":66,"Panama|||England":67,"Croatia|||Ghana":68,"Colombia|||Portugal":69,"DR Congo|||Uzbekistan":70,"Algeria|||Austria":71,"Jordan|||Argentina":72};
const _ZAF_KO = {"round_of_32":{s:73,e:88},"r32":{s:73,e:88},"round_of_16":{s:89,e:96},"r16":{s:89,e:96},"quarter_final":{s:97,e:100},"qf":{s:97,e:100},"semi_final":{s:101,e:102},"sf":{s:101,e:102},"third_place":{s:103,e:103},"thirdPlace":{s:103,e:103},"final":{s:104,e:104}};
async function zFetch(ep) {
  const r = await fetch(`${_ZAF_BASE}${ep}`,{headers:{"X-API-Key":_ZAF_KEY}});
  if(!r.ok){const b=await r.text();throw new Error(`Zafronix ${r.status}: ${b.slice(0,150)}`);}
  return r.json();
}
async function syncAllResults(currentData) {
  const summary={matchesUpdated:0,knockoutNamesUpdated:0,qualifiersUpdated:0,topScorer:null,awards:{},errors:[],rawAPINames:[]};
  const newData=JSON.parse(JSON.stringify(currentData));
  if(!newData.knockoutTeams)newData.knockoutTeams={};
  if(!newData.matchScorers)newData.matchScorers={};
  const ids=Object.assign({},_ZAF_IDS);
  let matches=[];
  try{const j=await zFetch("/matches?year=2026");matches=Array.isArray(j)?j:(j.matches||j.data||[]);}
  catch(e){summary.errors.push(`Matches: ${e.message}`);return{newData,summary};}
  const koCounters={};

  // Helper to extract scorers from a match object
  const extractScorers=(m,home,away)=>{
    const goals=m.goals||m.scorers||m.events||[];
    if(!goals.length)return null;
    const homeGoals=[],awayGoals=[];
    for(const g of goals){
      const name=g.player||g.name||g.scorer||g.playerName||"";
      const team=_zNorm(g.team||g.teamName||"");
      const min=g.minute||g.min||"";
      const isOG=g.type==="own_goal"||g.ownGoal||g.type==="OG";
      const entry=`${name}${min?" "+min+"'":""}${isOG?" (OG)":""}`;
      if(team===home)homeGoals.push(entry);
      else if(team===away)awayGoals.push(entry);
      else homeGoals.push(entry); // fallback
    }
    return{home:homeGoals,away:awayGoals};
  };

  for(const m of matches){
    const home=_zNorm(m.homeTeam||m.home_team||m.team1||"");
    const away=_zNorm(m.awayTeam||m.away_team||m.team2||"");
    if(!home||!away)continue;
    const hs=m.homeScore??m.home_score??m.score?.home??m.result?.home??null;
    const as2=m.awayScore??m.away_score??m.score?.away??m.result?.away??null;
    const done=hs!==null&&hs!==undefined&&as2!==null&&as2!==undefined&&m.status!=="scheduled"&&m.status!=="upcoming";
    if(done)summary.rawAPINames.push(`${home} ${hs}-${as2} ${away}`);
    const stage=(m.stageNormalized||m.stage||"").toLowerCase();
    const isGrp=stage.startsWith("group_");

    if(isGrp&&done){
      const key=`${home}|||${away}`;const mid=ids[key];
      if(mid){
        const sc=`${hs}-${as2}`;const win=hs>as2?home:as2>hs?away:"Draw";
        if(!newData.matchActuals[mid]||newData.matchActuals[mid].score!==sc){newData.matchActuals[mid]={score:sc,winner:win};summary.matchesUpdated++;}
        // Store scorers
        const scorers=extractScorers(m,home,away);
        if(scorers)newData.matchScorers[mid]=scorers;
      }
    }
    if(!isGrp&&stage&&stage!=="group"&&home&&away&&!home.includes("Winner")&&!away.includes("Winner")){
      const key=`${home}|||${away}`;let oid=ids[key];
      if(!oid){const range=_ZAF_KO[stage];if(range){if(!koCounters[stage])koCounters[stage]=range.s;oid=koCounters[stage];if(koCounters[stage]<=range.e)koCounters[stage]++;ids[key]=oid;}}
      if(oid){
        const prev=newData.knockoutTeams[oid];
        if(!prev||prev.home!==home||prev.away!==away){newData.knockoutTeams[oid]={home,away};summary.knockoutNamesUpdated++;}
        if(done){
          const sc=`${hs}-${as2}`;const win=hs>as2?home:as2>hs?away:"Draw";
          if(!newData.matchActuals[oid]||newData.matchActuals[oid].score!==sc){newData.matchActuals[oid]={score:sc,winner:win};summary.matchesUpdated++;}
          const scorers=extractScorers(m,home,away);
          if(scorers)newData.matchScorers[oid]=scorers;
        }
      }
    }
  }

  // ── Bracket sync — fills knockout team names round by round ──────────────
  try{
    const j=await zFetch("/bracket?year=2026");
    // bracket returns rounds, each with matches containing homeTeam/awayTeam
    const rounds=j.rounds||j.bracket||j.data||[];
    for(const round of(Array.isArray(rounds)?rounds:[])){
      const roundMatches=round.matches||round.games||[];
      const stage=(round.stage||round.name||round.round||"").toLowerCase().replace(/\s/g,"_");
      const range=_ZAF_KO[stage]||_ZAF_KO[round.stageNormalized||""];
      if(!range)continue;
      let slot=range.s;
      for(const bm of roundMatches){
        const bHome=_zNorm(bm.homeTeam||bm.home||bm.team1||"");
        const bAway=_zNorm(bm.awayTeam||bm.away||bm.team2||"");
        if(!bHome||!bAway||bHome.includes("Winner")||bAway.includes("Winner"))continue;
        if(slot<=range.e){
          const prev=newData.knockoutTeams[slot];
          if(!prev||prev.home!==bHome||prev.away!==bAway){
            newData.knockoutTeams[slot]={home:bHome,away:bAway};
            summary.knockoutNamesUpdated++;
          }
          slot++;
        }
      }
    }
  }catch(e){summary.errors.push(`Bracket: ${e.message}`);}
  try{
    const j=await zFetch("/standings?year=2026");
    let groups=[];
    if(Array.isArray(j))groups=j;
    else if(j.groups&&!Array.isArray(j.groups))groups=Object.entries(j.groups).map(([k,v])=>({group:k,teams:Array.isArray(v)?v:[]}));
    else if(Array.isArray(j.groups))groups=j.groups;
    else if(j.standings&&!Array.isArray(j.standings))groups=Object.entries(j.standings).map(([k,v])=>({group:k,teams:Array.isArray(v)?v:[]}));
    else if(Array.isArray(j.standings))groups=j.standings;
    else summary.errors.push(`Standings shape: ${JSON.stringify(j).slice(0,120)}`);
    const players=[...new Set([...Object.keys(newData.predictions),...Object.keys(newData.deductions)])];
    for(const grp of groups){
      const gl=(grp.group||grp.name||"").replace(/^[Gg]roup[\s_]*/,"").trim().toUpperCase();
      if(!gl||gl.length!==1)continue;
      const teams=(grp.teams||grp.standings||[]).sort((a,b)=>(a.position||a.rank||99)-(b.position||b.rank||99));
      if(teams.length<2)continue;
      // Each group has 4 teams × 3 games = 6 total matches
      // Sum all played counts and divide by 2 (each match counted twice)
      const totalPlayed=teams.reduce((s,t)=>s+(t.played||t.gamesPlayed||t.mp||0),0)/2;
      if(totalPlayed<6){
        // Group not done yet — reset any previously set qualifiers back to null
        for(const p of players)for(let s=0;s<2;s++){
          const key=`${p}_${gl}_${s}`;
          if(newData.groupQualifiers[key]?.qualified!==undefined&&newData.groupQualifiers[key]?.qualified!==null){
            newData.groupQualifiers[key].qualified=null;
          }
        }
        continue;
      }
      const top2=teams.slice(0,2).map(t=>_zNorm(t.team||t.name||t.teamName||"")).filter(Boolean);
      if(top2.length<2)continue;
      for(const p of players)for(let s=0;s<2;s++){
        const key=`${p}_${gl}_${s}`;const pick=newData.groupQualifiers[key]?.team;
        if(!pick||!newData.groupQualifiers[key])continue;
        newData.groupQualifiers[key].qualified=top2.some(t=>t===pick||t.toLowerCase()===pick.toLowerCase());
        summary.qualifiersUpdated++;
      }
    }
  }catch(e){summary.errors.push(`Standings: ${e.message}`);}
  try{
    const j=await zFetch("/tournaments/2026");const t=j.tournament||j;
    if(t.champion){newData.matchActuals._winner=_zNorm(t.champion);summary.awards.winner=t.champion;}
    if(t.runnerUp){newData.matchActuals._runnerUp=_zNorm(t.runnerUp);summary.awards.runnerUp=t.runnerUp;}
    if(t.thirdPlace){newData.matchActuals._thirdPlace=_zNorm(t.thirdPlace);summary.awards.thirdPlace=t.thirdPlace;}
    if(t.topScorer?.player&&!summary.topScorer){newData.matchActuals._goldenBoot=t.topScorer.player;summary.topScorer={name:t.topScorer.player,goals:t.topScorer.goals};}
  }catch(e){summary.errors.push(`Awards: ${e.message}`);}
  return{newData,summary};
}
async function fetchFIFARankings() {
  return {"France":1,"Spain":2,"Argentina":3,"England":4,"Portugal":5,"Brazil":6,"Netherlands":7,"Morocco":8,"Belgium":9,"Germany":10,"Croatia":11,"Colombia":13,"Senegal":14,"Mexico":15,"USA":16,"Uruguay":17,"Japan":18,"Switzerland":19,"Ecuador":25,"South Korea":23,"Austria":27,"Norway":29,"Türkiye":30,"Sweden":35,"Algeria":31,"Iran":21,"Australia":24,"South Africa":68,"DR Congo":55,"Ghana":57,"Tunisia":33,"Egypt":36,"Saudi Arabia":56,"Ivory Coast":41,"Czechia":38,"Panama":49,"Bosnia & Herz.":62,"Qatar":37,"Canada":46,"Scotland":39,"Haiti":98,"Curaçao":82,"Cape Verde":75,"New Zealand":95,"Uzbekistan":74,"Jordan":85,"Iraq":63,"Paraguay":58};
}

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const T = {
  bg:       "#0f1923",
  bgCard:   "#1a2535",
  bgCard2:  "#212f42",
  border:   "rgba(255,255,255,0.08)",
  gold:     "#f0c040",
  goldDim:  "#b8923a",
  green:    "#22c55e",
  greenDim: "#15803d",
  red:      "#ef4444",
  blue:     "#3b82f6",
  text:     "#f1f5f9",
  textDim:  "#94a3b8",
  textMute: "#475569",
  sidebar:  "#111c2a",
};

// ─── STYLES ───────────────────────────────────────────────────────────────────
const S = {
  header:{background:"linear-gradient(90deg,#111c2a 0%,#1a2535 100%)",borderBottom:"1px solid rgba(240,192,64,0.2)",color:"#fff",padding:"10px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100,flexShrink:0},
  sec:{},
  h2:{fontSize:22,fontWeight:900,background:"linear-gradient(90deg,#f0c040,#f9a825)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",marginBottom:14,marginTop:0,letterSpacing:"-0.5px"},
  card:{background:T.bgCard,borderRadius:16,padding:16,marginBottom:14,border:"1px solid rgba(255,255,255,0.07)",boxShadow:"0 4px 24px rgba(0,0,0,0.3)"},
  blockTitle:{fontWeight:800,fontSize:13,color:T.gold,marginBottom:10,paddingBottom:8,borderBottom:"1px solid rgba(240,192,64,0.2)",textTransform:"uppercase",letterSpacing:"0.8px"},
  empty:{color:T.textMute,textAlign:"center",padding:24,fontSize:14},
  loginWrap:{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:16},
  loginCard:{background:"rgba(15,10,30,0.82)",borderRadius:24,padding:"32px 28px",maxWidth:380,width:"100%",boxShadow:"0 24px 60px rgba(0,0,0,.6)",border:"1px solid rgba(255,255,255,0.12)"},
  lbl:{fontSize:11,fontWeight:700,color:T.textDim,textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:4},
  inp:{border:"1px solid rgba(255,255,255,0.15)",borderRadius:10,padding:"11px 14px",fontSize:14,outline:"none",fontFamily:"inherit",width:"100%",boxSizing:"border-box",background:"rgba(255,255,255,0.07)",color:"#fff"},
  btn:{background:"linear-gradient(135deg,#22c55e,#15803d)",color:"#fff",border:"none",borderRadius:10,padding:"12px 20px",fontSize:14,fontWeight:700,cursor:"pointer",width:"100%",boxShadow:"0 4px 12px rgba(34,197,94,0.3)"},
  sel:{width:"100%",border:"1px solid rgba(255,255,255,0.15)",borderRadius:8,padding:"9px 10px",fontSize:13,outline:"none",fontFamily:"inherit",cursor:"pointer",boxSizing:"border-box",background:T.bgCard2,color:T.text},
  chip:{background:T.bgCard2,border:"1px solid rgba(255,255,255,0.1)",borderRadius:20,padding:"4px 12px",fontSize:11,cursor:"pointer",fontWeight:600,color:T.textDim,whiteSpace:"nowrap"},
  chipActive:{background:"linear-gradient(135deg,#f0c040,#f9a825)",color:"#111",borderColor:"#f0c040",fontWeight:800},
  rp:{fontSize:13,color:T.textDim,lineHeight:1.7,marginBottom:10},
  ri:{display:"flex",gap:10,alignItems:"flex-start",background:T.bgCard2,borderRadius:8,padding:"8px 10px",border:"1px solid rgba(255,255,255,0.06)",marginBottom:6},
};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const ADMIN_PASSWORD = "admin2026";
const FRIENDS = []; // Open — anyone who types their name joins automatically
const PLAYER_COLORS = ["#E53935","#1E88E5","#43A047","#FB8C00","#8E24AA","#00ACC1","#F4511E","#D81B60","#6D4C41","#00897B","#546E7A","#FDD835"];
const GROUPS = {
  A:["Mexico","South Korea","South Africa","Czechia"],
  B:["Canada","Bosnia & Herz.","Qatar","Switzerland"],
  C:["Brazil","Morocco","Haiti","Scotland"],
  D:["USA","Paraguay","Australia","Türkiye"],
  E:["Germany","Curaçao","Ivory Coast","Ecuador"],
  F:["Netherlands","Japan","Sweden","Tunisia"],
  G:["Belgium","Egypt","Iran","New Zealand"],
  H:["Spain","Cape Verde","Saudi Arabia","Uruguay"],
  I:["France","Senegal","Iraq","Norway"],
  J:["Argentina","Algeria","Austria","Jordan"],
  K:["Portugal","DR Congo","Uzbekistan","Colombia"],
  L:["England","Croatia","Ghana","Panama"],
};
const ALL_TEAMS = Object.values(GROUPS).flat().sort();
const STAGE_COLORS = {
  "Group Stage":"#1B5E20","Round of 32":"#01579B","Round of 16":"#4A148C",
  "Quarterfinal":"#880E4F","Semifinal":"#E65100","Third-Place":"#37474F","Final":"#B71C1C"
};
const POINTS = { winner:20,runnerUp:12,thirdPlace:8,goldenBoot:15,goldenBall:15,goldenGlove:12,exactScore:8,correctResult:3,groupQualifier:2 };

// ─── STAGE-BASED MATCH POINTS ────────────────────────────────────────────────
// Knockout rounds worth more — excitement increases as tournament progresses
const STAGE_POINTS = {
  "Group Stage":  { correct:3,  exact:8  },
  "Round of 32":  { correct:5,  exact:10 },
  "Round of 16":  { correct:7,  exact:13 },
  "Quarterfinal": { correct:10, exact:18 },
  "Semifinal":    { correct:13, exact:22 },
  "Third-Place":  { correct:18, exact:30 },
  "Final":        { correct:18, exact:30 },
};
function getStagePts(stage) {
  return STAGE_POINTS[stage] || STAGE_POINTS["Group Stage"];
}

// ─── UPSET BONUS SYSTEM ───────────────────────────────────────────────────────
const UPSET_TIERS = [
  { maxGap:5,   bonus:0,  label:"Even",       color:"#475569" },
  { maxGap:10,  bonus:1,  label:"+1 upset",   color:"#64748b" },
  { maxGap:15,  bonus:3,  label:"+3 upset",   color:"#f0c040" },
  { maxGap:25,  bonus:5,  label:"+5 upset",   color:"#fb923c" },
  { maxGap:50,  bonus:8,  label:"+8 upset",   color:"#f97316" },
  { maxGap:75,  bonus:15, label:"+15 UPSET",  color:"#ef4444" },
  { maxGap:100, bonus:25, label:"+25 UPSET!", color:"#dc2626" },
  { maxGap:Infinity, bonus:50, label:"+50 🔥 GIANT KILLER!", color:"#b91c1c" },
];

function getUpsetBonus(rankHome, rankAway, actualScore) {
  if (!rankHome || !rankAway || !actualScore) return 0;
  const a = parseScore(actualScore);
  if (!a) return 0;
  const homeWon = a.h > a.a, awayWon = a.a > a.h;
  if (!homeWon && !awayWon) return 0; // draw — no upset possible
  // Upset = lower-ranked (higher number) team wins
  const upset = (homeWon && rankHome > rankAway) || (awayWon && rankAway > rankHome);
  if (!upset) return 0;
  const gap = Math.abs(rankHome - rankAway);
  for (const tier of UPSET_TIERS) { if (gap <= tier.maxGap) return tier.bonus; }
  return 50;
}

function getUpsetTier(rankHome, rankAway) {
  if (!rankHome || !rankAway) return null;
  const gap = Math.abs(rankHome - rankAway);
  for (const tier of UPSET_TIERS) { if (gap <= tier.maxGap) return tier; }
  return UPSET_TIERS[UPSET_TIERS.length - 1];
}

function getRankTier(rank) {
  if (!rank) return { color:"#475569", label:"Unranked" };
  if (rank <= 10)  return { color:"#ef4444", label:"🔴 Top 10" };
  if (rank <= 25)  return { color:"#f97316", label:"🟠 Top 25" };
  if (rank <= 50)  return { color:"#f0c040", label:"🟡 Top 50" };
  return                  { color:"#64748b", label:"⚫ Rank "+rank };
}
const DEDUCTIONS = [
  {stage:"Pre-Tournament",before:"2026-06-11",pts:0,label:"Free"},
  {stage:"Group Stage",before:"2026-06-28",pts:5,label:"−5 pts"},
  {stage:"Round of 32",before:"2026-07-04",pts:8,label:"−8 pts"},
  {stage:"Round of 16",before:"2026-07-09",pts:12,label:"−12 pts"},
  {stage:"Quarterfinal",before:"2026-07-14",pts:18,label:"−18 pts"},
  {stage:"Semifinal",before:"2026-07-19",pts:25,label:"−25 pts"},
  {stage:"Post-Semis",before:"2099-01-01",pts:30,label:"−30 pts"},
];

// Group last match dates — groups lock for qualifier changes once their last match kicks off
const GROUP_LAST_MATCH = {
  A:"2026-06-24",B:"2026-06-24",C:"2026-06-24",
  D:"2026-06-25",E:"2026-06-25",F:"2026-06-25",
  G:"2026-06-26",H:"2026-06-26",I:"2026-06-26",
  J:"2026-06-27",K:"2026-06-27",L:"2026-06-27",
};

// Penalty for changing a qualifier pick after the group stage has started
const QUAL_PENALTY_TIERS = [
  {before:"2026-06-11",pts:0, label:"Free — before tournament"},
  {before:"2026-06-24",pts:3, label:"−3 pts — group stage started"},
  {before:"2026-06-27",pts:6, label:"−6 pts — most groups played"},
  {before:"2099-01-01",pts:10,label:"−10 pts — group stage ending"},
];
function getQualPenalty() {
  const now=Date.now();
  for(const t of QUAL_PENALTY_TIERS){ if(now<new Date(t.before+"T12:00:00Z").getTime()) return t; }
  return QUAL_PENALTY_TIERS[QUAL_PENALTY_TIERS.length-1];
}
function isGroupLocked(grp) {
  const lastDate = GROUP_LAST_MATCH[grp];
  if(!lastDate) return false;
  // Group locks at midnight ET (04:00 UTC) on the day of last matches
  return Date.now() >= new Date(lastDate+"T04:00:00Z").getTime();
}
const MATCHES = [
  {id:1,stage:"Group Stage",grp:"A",date:"2026-06-11",time:"15:00",home:"Mexico",away:"South Africa",venue:"Estadio Azteca",city:"Mexico City"},
  {id:2,stage:"Group Stage",grp:"A",date:"2026-06-11",time:"22:00",home:"South Korea",away:"Czechia",venue:"Estadio Akron",city:"Zapopan"},
  {id:3,stage:"Group Stage",grp:"B",date:"2026-06-12",time:"15:00",home:"Canada",away:"Bosnia & Herz.",venue:"BMO Field",city:"Toronto"},
  {id:4,stage:"Group Stage",grp:"D",date:"2026-06-12",time:"21:00",home:"USA",away:"Paraguay",venue:"SoFi Stadium",city:"Inglewood"},
  {id:5,stage:"Group Stage",grp:"B",date:"2026-06-13",time:"15:00",home:"Qatar",away:"Switzerland",venue:"Levi's Stadium",city:"Santa Clara"},
  {id:6,stage:"Group Stage",grp:"C",date:"2026-06-13",time:"18:00",home:"Brazil",away:"Morocco",venue:"MetLife Stadium",city:"E. Rutherford"},
  {id:7,stage:"Group Stage",grp:"C",date:"2026-06-13",time:"21:00",home:"Haiti",away:"Scotland",venue:"Gillette Stadium",city:"Foxborough"},
  {id:8,stage:"Group Stage",grp:"D",date:"2026-06-14",time:"00:00",home:"Australia",away:"Türkiye",venue:"BC Place",city:"Vancouver"},
  {id:9,stage:"Group Stage",grp:"E",date:"2026-06-14",time:"13:00",home:"Germany",away:"Curaçao",venue:"NRG Stadium",city:"Houston"},
  {id:10,stage:"Group Stage",grp:"F",date:"2026-06-14",time:"16:00",home:"Netherlands",away:"Japan",venue:"AT&T Stadium",city:"Arlington"},
  {id:11,stage:"Group Stage",grp:"E",date:"2026-06-14",time:"19:00",home:"Ivory Coast",away:"Ecuador",venue:"Lincoln Financial Field",city:"Philadelphia"},
  {id:12,stage:"Group Stage",grp:"F",date:"2026-06-14",time:"22:00",home:"Sweden",away:"Tunisia",venue:"Estadio BBVA",city:"Monterrey"},
  {id:13,stage:"Group Stage",grp:"H",date:"2026-06-15",time:"12:00",home:"Spain",away:"Cape Verde",venue:"Mercedes-Benz Stadium",city:"Atlanta"},
  {id:14,stage:"Group Stage",grp:"G",date:"2026-06-15",time:"15:00",home:"Belgium",away:"Egypt",venue:"Lumen Field",city:"Seattle"},
  {id:15,stage:"Group Stage",grp:"H",date:"2026-06-15",time:"18:00",home:"Saudi Arabia",away:"Uruguay",venue:"Hard Rock Stadium",city:"Miami Gardens"},
  {id:16,stage:"Group Stage",grp:"G",date:"2026-06-15",time:"21:00",home:"Iran",away:"New Zealand",venue:"SoFi Stadium",city:"Inglewood"},
  {id:17,stage:"Group Stage",grp:"I",date:"2026-06-16",time:"15:00",home:"France",away:"Senegal",venue:"MetLife Stadium",city:"E. Rutherford"},
  {id:18,stage:"Group Stage",grp:"I",date:"2026-06-16",time:"18:00",home:"Iraq",away:"Norway",venue:"Gillette Stadium",city:"Foxborough"},
  {id:19,stage:"Group Stage",grp:"J",date:"2026-06-16",time:"21:00",home:"Argentina",away:"Algeria",venue:"Arrowhead Stadium",city:"Kansas City"},
  {id:20,stage:"Group Stage",grp:"J",date:"2026-06-17",time:"00:00",home:"Austria",away:"Jordan",venue:"Levi's Stadium",city:"Santa Clara"},
  {id:21,stage:"Group Stage",grp:"K",date:"2026-06-17",time:"13:00",home:"Portugal",away:"DR Congo",venue:"NRG Stadium",city:"Houston"},
  {id:22,stage:"Group Stage",grp:"L",date:"2026-06-17",time:"16:00",home:"England",away:"Croatia",venue:"AT&T Stadium",city:"Arlington"},
  {id:23,stage:"Group Stage",grp:"L",date:"2026-06-17",time:"19:00",home:"Ghana",away:"Panama",venue:"BMO Field",city:"Toronto"},
  {id:24,stage:"Group Stage",grp:"K",date:"2026-06-17",time:"22:00",home:"Uzbekistan",away:"Colombia",venue:"Estadio Azteca",city:"Mexico City"},
  {id:25,stage:"Group Stage",grp:"A",date:"2026-06-18",time:"12:00",home:"Czechia",away:"South Africa",venue:"Mercedes-Benz Stadium",city:"Atlanta"},
  {id:26,stage:"Group Stage",grp:"B",date:"2026-06-18",time:"15:00",home:"Switzerland",away:"Bosnia & Herz.",venue:"SoFi Stadium",city:"Inglewood"},
  {id:27,stage:"Group Stage",grp:"B",date:"2026-06-18",time:"18:00",home:"Canada",away:"Qatar",venue:"BC Place",city:"Vancouver"},
  {id:28,stage:"Group Stage",grp:"A",date:"2026-06-18",time:"21:00",home:"Mexico",away:"South Korea",venue:"Estadio Akron",city:"Zapopan"},
  {id:29,stage:"Group Stage",grp:"D",date:"2026-06-19",time:"15:00",home:"USA",away:"Australia",venue:"Lumen Field",city:"Seattle"},
  {id:30,stage:"Group Stage",grp:"C",date:"2026-06-19",time:"18:00",home:"Scotland",away:"Morocco",venue:"Gillette Stadium",city:"Foxborough"},
  {id:31,stage:"Group Stage",grp:"C",date:"2026-06-19",time:"20:30",home:"Brazil",away:"Haiti",venue:"Lincoln Financial Field",city:"Philadelphia"},
  {id:32,stage:"Group Stage",grp:"D",date:"2026-06-19",time:"23:00",home:"Türkiye",away:"Paraguay",venue:"Levi's Stadium",city:"Santa Clara"},
  {id:33,stage:"Group Stage",grp:"F",date:"2026-06-20",time:"13:00",home:"Netherlands",away:"Sweden",venue:"NRG Stadium",city:"Houston"},
  {id:34,stage:"Group Stage",grp:"E",date:"2026-06-20",time:"16:00",home:"Germany",away:"Ivory Coast",venue:"BMO Field",city:"Toronto"},
  {id:35,stage:"Group Stage",grp:"E",date:"2026-06-20",time:"20:00",home:"Ecuador",away:"Curaçao",venue:"Arrowhead Stadium",city:"Kansas City"},
  {id:36,stage:"Group Stage",grp:"F",date:"2026-06-21",time:"00:00",home:"Tunisia",away:"Japan",venue:"Estadio BBVA",city:"Monterrey"},
  {id:37,stage:"Group Stage",grp:"H",date:"2026-06-21",time:"12:00",home:"Spain",away:"Saudi Arabia",venue:"Mercedes-Benz Stadium",city:"Atlanta"},
  {id:38,stage:"Group Stage",grp:"G",date:"2026-06-21",time:"15:00",home:"Belgium",away:"Iran",venue:"SoFi Stadium",city:"Inglewood"},
  {id:39,stage:"Group Stage",grp:"H",date:"2026-06-21",time:"18:00",home:"Uruguay",away:"Cape Verde",venue:"Hard Rock Stadium",city:"Miami Gardens"},
  {id:40,stage:"Group Stage",grp:"G",date:"2026-06-21",time:"21:00",home:"New Zealand",away:"Egypt",venue:"BC Place",city:"Vancouver"},
  {id:41,stage:"Group Stage",grp:"J",date:"2026-06-22",time:"13:00",home:"Argentina",away:"Austria",venue:"AT&T Stadium",city:"Arlington"},
  {id:42,stage:"Group Stage",grp:"I",date:"2026-06-22",time:"17:00",home:"France",away:"Iraq",venue:"Lincoln Financial Field",city:"Philadelphia"},
  {id:43,stage:"Group Stage",grp:"I",date:"2026-06-22",time:"20:00",home:"Norway",away:"Senegal",venue:"MetLife Stadium",city:"E. Rutherford"},
  {id:44,stage:"Group Stage",grp:"J",date:"2026-06-22",time:"23:00",home:"Jordan",away:"Algeria",venue:"Levi's Stadium",city:"Santa Clara"},
  {id:45,stage:"Group Stage",grp:"K",date:"2026-06-23",time:"13:00",home:"Portugal",away:"Uzbekistan",venue:"NRG Stadium",city:"Houston"},
  {id:46,stage:"Group Stage",grp:"L",date:"2026-06-23",time:"16:00",home:"England",away:"Ghana",venue:"Gillette Stadium",city:"Foxborough"},
  {id:47,stage:"Group Stage",grp:"L",date:"2026-06-23",time:"19:00",home:"Panama",away:"Croatia",venue:"BMO Field",city:"Toronto"},
  {id:48,stage:"Group Stage",grp:"K",date:"2026-06-23",time:"22:00",home:"Colombia",away:"DR Congo",venue:"Estadio Akron",city:"Zapopan"},
  {id:49,stage:"Group Stage",grp:"B",date:"2026-06-24",time:"15:00",home:"Switzerland",away:"Canada",venue:"BC Place",city:"Vancouver"},
  {id:50,stage:"Group Stage",grp:"B",date:"2026-06-24",time:"15:00",home:"Bosnia & Herz.",away:"Qatar",venue:"Lumen Field",city:"Seattle"},
  {id:51,stage:"Group Stage",grp:"C",date:"2026-06-24",time:"18:00",home:"Scotland",away:"Brazil",venue:"Hard Rock Stadium",city:"Miami Gardens"},
  {id:52,stage:"Group Stage",grp:"C",date:"2026-06-24",time:"18:00",home:"Morocco",away:"Haiti",venue:"Mercedes-Benz Stadium",city:"Atlanta"},
  {id:53,stage:"Group Stage",grp:"A",date:"2026-06-24",time:"21:00",home:"Czechia",away:"Mexico",venue:"Estadio Azteca",city:"Mexico City"},
  {id:54,stage:"Group Stage",grp:"A",date:"2026-06-24",time:"21:00",home:"South Africa",away:"South Korea",venue:"Estadio BBVA",city:"Monterrey"},
  {id:55,stage:"Group Stage",grp:"E",date:"2026-06-25",time:"16:00",home:"Curaçao",away:"Ivory Coast",venue:"Lincoln Financial Field",city:"Philadelphia"},
  {id:56,stage:"Group Stage",grp:"E",date:"2026-06-25",time:"16:00",home:"Ecuador",away:"Germany",venue:"MetLife Stadium",city:"E. Rutherford"},
  {id:57,stage:"Group Stage",grp:"F",date:"2026-06-25",time:"19:00",home:"Japan",away:"Sweden",venue:"AT&T Stadium",city:"Arlington"},
  {id:58,stage:"Group Stage",grp:"F",date:"2026-06-25",time:"19:00",home:"Tunisia",away:"Netherlands",venue:"Arrowhead Stadium",city:"Kansas City"},
  {id:59,stage:"Group Stage",grp:"D",date:"2026-06-25",time:"22:00",home:"Türkiye",away:"USA",venue:"SoFi Stadium",city:"Inglewood"},
  {id:60,stage:"Group Stage",grp:"D",date:"2026-06-25",time:"22:00",home:"Paraguay",away:"Australia",venue:"Levi's Stadium",city:"Santa Clara"},
  {id:61,stage:"Group Stage",grp:"I",date:"2026-06-26",time:"15:00",home:"Norway",away:"France",venue:"Gillette Stadium",city:"Foxborough"},
  {id:62,stage:"Group Stage",grp:"I",date:"2026-06-26",time:"15:00",home:"Senegal",away:"Iraq",venue:"BMO Field",city:"Toronto"},
  {id:63,stage:"Group Stage",grp:"H",date:"2026-06-26",time:"20:00",home:"Cape Verde",away:"Saudi Arabia",venue:"NRG Stadium",city:"Houston"},
  {id:64,stage:"Group Stage",grp:"H",date:"2026-06-26",time:"20:00",home:"Uruguay",away:"Spain",venue:"Estadio Akron",city:"Zapopan"},
  {id:65,stage:"Group Stage",grp:"G",date:"2026-06-26",time:"23:00",home:"Egypt",away:"Iran",venue:"Lumen Field",city:"Seattle"},
  {id:66,stage:"Group Stage",grp:"G",date:"2026-06-26",time:"23:00",home:"New Zealand",away:"Belgium",venue:"BC Place",city:"Vancouver"},
  {id:67,stage:"Group Stage",grp:"L",date:"2026-06-27",time:"17:00",home:"Panama",away:"England",venue:"MetLife Stadium",city:"E. Rutherford"},
  {id:68,stage:"Group Stage",grp:"L",date:"2026-06-27",time:"17:00",home:"Croatia",away:"Ghana",venue:"Lincoln Financial Field",city:"Philadelphia"},
  {id:69,stage:"Group Stage",grp:"K",date:"2026-06-27",time:"19:30",home:"Colombia",away:"Portugal",venue:"Hard Rock Stadium",city:"Miami Gardens"},
  {id:70,stage:"Group Stage",grp:"K",date:"2026-06-27",time:"19:30",home:"DR Congo",away:"Uzbekistan",venue:"Mercedes-Benz Stadium",city:"Atlanta"},
  {id:71,stage:"Group Stage",grp:"J",date:"2026-06-27",time:"22:00",home:"Algeria",away:"Austria",venue:"Arrowhead Stadium",city:"Kansas City"},
  {id:72,stage:"Group Stage",grp:"J",date:"2026-06-27",time:"22:00",home:"Jordan",away:"Argentina",venue:"AT&T Stadium",city:"Arlington"},
  {id:73,stage:"Round of 32",date:"2026-06-28",time:"15:00",home:"Runner-up A",away:"Runner-up B",venue:"SoFi Stadium",city:"Inglewood"},
  {id:74,stage:"Round of 32",date:"2026-06-29",time:"16:30",home:"Winner E",away:"Best 3rd",venue:"Gillette Stadium",city:"Foxborough"},
  {id:75,stage:"Round of 32",date:"2026-06-29",time:"21:00",home:"Winner F",away:"Runner-up C",venue:"Estadio BBVA",city:"Monterrey"},
  {id:76,stage:"Round of 32",date:"2026-06-29",time:"13:00",home:"Winner C",away:"Runner-up F",venue:"NRG Stadium",city:"Houston"},
  {id:77,stage:"Round of 32",date:"2026-06-30",time:"17:00",home:"Winner I",away:"Best 3rd",venue:"MetLife Stadium",city:"E. Rutherford"},
  {id:78,stage:"Round of 32",date:"2026-06-30",time:"13:00",home:"Runner-up E",away:"Runner-up I",venue:"AT&T Stadium",city:"Arlington"},
  {id:79,stage:"Round of 32",date:"2026-06-30",time:"21:00",home:"Winner A",away:"Best 3rd",venue:"Estadio Azteca",city:"Mexico City"},
  {id:80,stage:"Round of 32",date:"2026-07-01",time:"12:00",home:"Winner L",away:"Best 3rd",venue:"Mercedes-Benz Stadium",city:"Atlanta"},
  {id:81,stage:"Round of 32",date:"2026-07-01",time:"20:00",home:"Winner D",away:"Best 3rd",venue:"Levi's Stadium",city:"Santa Clara"},
  {id:82,stage:"Round of 32",date:"2026-07-01",time:"16:00",home:"Winner G",away:"Best 3rd",venue:"Lumen Field",city:"Seattle"},
  {id:83,stage:"Round of 32",date:"2026-07-02",time:"19:00",home:"Runner-up K",away:"Runner-up L",venue:"BMO Field",city:"Toronto"},
  {id:84,stage:"Round of 32",date:"2026-07-02",time:"15:00",home:"Winner H",away:"Runner-up J",venue:"SoFi Stadium",city:"Inglewood"},
  {id:85,stage:"Round of 32",date:"2026-07-02",time:"23:00",home:"Winner B",away:"Best 3rd",venue:"BC Place",city:"Vancouver"},
  {id:86,stage:"Round of 32",date:"2026-07-03",time:"18:00",home:"Winner J",away:"Runner-up H",venue:"Hard Rock Stadium",city:"Miami Gardens"},
  {id:87,stage:"Round of 32",date:"2026-07-03",time:"21:30",home:"Winner K",away:"Best 3rd",venue:"Arrowhead Stadium",city:"Kansas City"},
  {id:88,stage:"Round of 32",date:"2026-07-03",time:"14:00",home:"Runner-up D",away:"Runner-up G",venue:"AT&T Stadium",city:"Arlington"},
  {id:89,stage:"Round of 16",date:"2026-07-04",time:"17:00",home:"W M74",away:"W M77",venue:"Lincoln Financial Field",city:"Philadelphia"},
  {id:90,stage:"Round of 16",date:"2026-07-04",time:"13:00",home:"W M73",away:"W M75",venue:"NRG Stadium",city:"Houston"},
  {id:91,stage:"Round of 16",date:"2026-07-05",time:"16:00",home:"W M76",away:"W M78",venue:"MetLife Stadium",city:"E. Rutherford"},
  {id:92,stage:"Round of 16",date:"2026-07-05",time:"20:00",home:"W M79",away:"W M80",venue:"Estadio Azteca",city:"Mexico City"},
  {id:93,stage:"Round of 16",date:"2026-07-06",time:"15:00",home:"W M83",away:"W M84",venue:"AT&T Stadium",city:"Arlington"},
  {id:94,stage:"Round of 16",date:"2026-07-06",time:"20:00",home:"W M81",away:"W M82",venue:"Lumen Field",city:"Seattle"},
  {id:95,stage:"Round of 16",date:"2026-07-07",time:"12:00",home:"W M86",away:"W M88",venue:"Mercedes-Benz Stadium",city:"Atlanta"},
  {id:96,stage:"Round of 16",date:"2026-07-07",time:"16:00",home:"W M85",away:"W M87",venue:"BC Place",city:"Vancouver"},
  {id:97,stage:"Quarterfinal",date:"2026-07-09",time:"16:00",home:"W M89",away:"W M90",venue:"Gillette Stadium",city:"Foxborough"},
  {id:98,stage:"Quarterfinal",date:"2026-07-10",time:"15:00",home:"W M93",away:"W M94",venue:"SoFi Stadium",city:"Inglewood"},
  {id:99,stage:"Quarterfinal",date:"2026-07-11",time:"17:00",home:"W M91",away:"W M92",venue:"Hard Rock Stadium",city:"Miami Gardens"},
  {id:100,stage:"Quarterfinal",date:"2026-07-11",time:"21:00",home:"W M95",away:"W M96",venue:"Arrowhead Stadium",city:"Kansas City"},
  {id:101,stage:"Semifinal",date:"2026-07-14",time:"15:00",home:"W M97",away:"W M98",venue:"AT&T Stadium",city:"Arlington"},
  {id:102,stage:"Semifinal",date:"2026-07-15",time:"15:00",home:"W M99",away:"W M100",venue:"Mercedes-Benz Stadium",city:"Atlanta"},
  {id:103,stage:"Third-Place",date:"2026-07-18",time:"17:00",home:"L M101",away:"L M102",venue:"Hard Rock Stadium",city:"Miami Gardens"},
  {id:104,stage:"Final",date:"2026-07-19",time:"15:00",home:"Finalist 1",away:"Finalist 2",venue:"MetLife Stadium",city:"E. Rutherford"},
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const parseScore = s => { if(!s||!s.includes("-"))return null; const[a,b]=s.split("-"); const h=parseInt(a),aw=parseInt(b); return(isNaN(h)||isNaN(aw))?null:{h,a:aw}; };
const getResult = s => !s?null:s.h>s.a?"H":s.h<s.a?"A":"D";
const calcMatchPts = (actual, pred, rankHome, rankAway, stage) => {
  const a=parseScore(actual), p=parseScore(pred);
  if(!a||!p) return 0;
  const sp = getStagePts(stage);
  const basePts = a.h===p.h&&a.a===p.a ? sp.exact : getResult(a)===getResult(p) ? sp.correct : 0;
  if(basePts===0) return 0;
  const upsetBonus = getUpsetBonus(rankHome, rankAway, actual);
  return basePts + upsetBonus;
};
const isLocked = m => Date.now() >= etToUtcMs(m.date, m.time);
const getCurrentStage = () => { const now=Date.now(); for(const d of DEDUCTIONS){if(now<new Date(d.before+"T12:00:00Z").getTime())return d;} return DEDUCTIONS[DEDUCTIONS.length-1]; };
const fmt12 = t => { const[h,m]=t.split(":").map(Number); return `${h%12||12}:${String(m).padStart(2,"0")}${h>=12?"PM":"AM"} ET`; };
const fmtTZ = (t, offsetHrs) => {
  const[h,m]=t.split(":").map(Number);
  const totalMins = h*60 + m + Math.round(offsetHrs*60);
  const newH = ((Math.floor(totalMins/60)) % 24 + 24) % 24;
  const newM = ((totalMins % 60) + 60) % 60;
  return `${newH%12||12}:${String(newM).padStart(2,"0")}${newH>=12?"PM":"AM"}`;
};
const fmtAllTimes = t => ({
  et:   fmt12(t),
  bst:  fmtTZ(t, 5)   + " BST",
  cest: fmtTZ(t, 6)   + " CEST",
  ist:  fmtTZ(t, 9.5) + " IST",
});

// ─── TIMEZONE SYSTEM ─────────────────────────────────────────────────────────
const TIMEZONES = [
  { id:"ET",   label:"ET — Eastern Time (USA)",          offset:0,    abbr:"ET"   },
  { id:"CT",   label:"CT — Central Time (USA)",          offset:-1,   abbr:"CT"   },
  { id:"MT",   label:"MT — Mountain Time (USA)",         offset:-2,   abbr:"MT"   },
  { id:"PT",   label:"PT — Pacific Time (USA)",          offset:-3,   abbr:"PT"   },
  { id:"BST",  label:"BST — British Summer Time (UK)",   offset:5,    abbr:"BST"  },
  { id:"CEST", label:"CEST — Central European Summer",   offset:6,    abbr:"CEST" },
  { id:"GST",  label:"GST — Gulf Standard Time (UAE)",   offset:8,    abbr:"GST"  },
  { id:"IST",  label:"IST — India Standard Time",        offset:9.5,  abbr:"IST"  },
  { id:"SGT",  label:"SGT — Singapore / Malaysia Time",  offset:12,   abbr:"SGT"  },
  { id:"JST",  label:"JST — Japan Standard Time",        offset:13,   abbr:"JST"  },
  { id:"AEDT", label:"AEDT — Australian Eastern Summer", offset:15,   abbr:"AEDT" },
];

// Convert ET date+time to player's timezone, returns { time, date, abbr, dayShift }
function convertToTZ(etDate, etTime, tzId) {
  const tz = TIMEZONES.find(t=>t.id===tzId) || TIMEZONES[0];
  const [h,m] = etTime.split(":").map(Number);
  const totalMins = h*60 + m + Math.round(tz.offset*60);
  const dayShift = totalMins < 0 ? -1 : totalMins >= 24*60 ? 1 : 0;
  const newH = ((Math.floor(totalMins/60)) % 24 + 24) % 24;
  const newM = ((totalMins % 60) + 60) % 60;
  const timeStr = `${newH%12||12}:${String(newM).padStart(2,"0")}${newH>=12?"PM":"AM"} ${tz.abbr}`;

  // Shift date if needed
  let date = etDate;
  if (dayShift !== 0) {
    const d = new Date(etDate+"T12:00:00");
    d.setDate(d.getDate() + dayShift);
    date = d.toISOString().slice(0,10);
  }
  const dateStr = new Date(date+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",weekday:"short"});
  return { time:timeStr, date:dateStr, rawDate:date, abbr:tz.abbr, dayShift };
}

// Get a player's preferred timezone (default ET)
function getPlayerTZ(data, player) {
  return data?.playerTimezones?.[player] || "ET";
}

// Resolve real team names for a match (knockout rounds show placeholders until known)
function getMatchTeams(m, data) {
  if (m.id <= 72) return { home: m.home, away: m.away }; // group stage always fixed
  const kt = data?.knockoutTeams?.[m.id];
  return {
    home: kt?.home || m.home,
    away: kt?.away || m.away,
  };
}
const fmtDate = d => new Date(d+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",weekday:"short"});
const fmtShort = d => new Date(d+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"});
// Hash name → consistent color regardless of join order
const playerColor = name => {
  if (!name) return "#888";
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return PLAYER_COLORS[Math.abs(h) % PLAYER_COLORS.length];
};

// ─── STORAGE ──────────────────────────────────────────────────────────────────
// Storage handled by Firebase (see firebase.js)
const initData = () => ({ predictions:{}, matchPredictions:{}, matchActuals:{}, groupQualifiers:{}, deductions:{}, changeLog:[], pointsHistory:{}, prizePool:2000, playerPasswords:{}, playerTimezones:{}, knockoutTeams:{}, teamRankings:{}, matchScorers:{} });

// ─── COUNTDOWN TIMER ──────────────────────────────────────────────────────────
// All match times are stored in ET (Eastern Daylight Time = UTC-4 during summer).
// We must parse them as UTC-4, NOT as local time, to get correct countdowns
// regardless of what timezone the user's browser is in.
function etToUtcMs(etDate, etTime) {
  // ET during summer = EDT = UTC-4
  // Parse the ET date+time, then add 4h to convert to UTC
  const [h, m] = etTime.split(":").map(Number);
  const totalMins = h * 60 + m + 4 * 60; // add 4h in minutes
  const extraDays = Math.floor(totalMins / (24 * 60));
  const utcH = Math.floor((totalMins % (24 * 60)) / 60);
  const utcM = totalMins % 60;
  // Apply any day overflow to the date
  const base = new Date(etDate + "T00:00:00Z");
  base.setUTCDate(base.getUTCDate() + extraDays);
  base.setUTCHours(utcH, utcM, 0, 0);
  return base.getTime();
}

function useCountdown(etDate, etTime) {
  const getSecsLeft = () => Math.max(0, Math.floor((etToUtcMs(etDate,etTime) - Date.now()) / 1000));
  const [secs, setSecs] = useState(getSecsLeft);
  useEffect(() => {
    if (secs <= 0) return;
    const t = setInterval(() => setSecs(getSecsLeft()), 1000);
    return () => clearInterval(t);
  }, [etDate, etTime]);
  return secs;
}

function Countdown({etDate, etTime, label=null}) {
  const secs = useCountdown(etDate, etTime);
  if (secs <= 0) return null;

  const d  = Math.floor(secs / 86400);
  const h  = Math.floor((secs % 86400) / 3600);
  const m  = Math.floor((secs % 3600) / 60);
  const s  = secs % 60;

  const urgent  = secs < 48 * 3600;
  const warning = secs < 7  * 86400;

  const color  = urgent ? "#ef4444" : warning ? "#f97316" : T.gold;
  const bgCol  = urgent ? "rgba(239,68,68,0.1)" : warning ? "rgba(249,115,22,0.1)" : "rgba(240,192,64,0.1)";
  const defaultLabel = urgent ? "⚡ Closes soon!" : warning ? "⏳ Bet closes in" : "🕐 Bet closes in";

  const parts = d > 0
    ? `${d}d ${h}h ${String(m).padStart(2,"0")}m`
    : `${h}h ${String(m).padStart(2,"0")}m ${String(s).padStart(2,"0")}s`;

  if(label) {
    // Full banner mode (for predictions/qualifiers pages)
    return (
      <div style={{display:"flex",alignItems:"center",gap:8,background:bgCol,border:`1px solid ${color}40`,borderRadius:10,padding:"10px 14px",marginBottom:12}}>
        <span style={{fontSize:18}}>⏰</span>
        <div>
          <div style={{fontSize:12,color,fontWeight:700}}>{label}</div>
          <div style={{fontSize:18,fontWeight:900,fontFamily:"monospace",color}}>{parts}</div>
        </div>
        <div style={{marginLeft:"auto",fontSize:11,color:T.textDim}}>Jun 11 · 3PM ET</div>
      </div>
    );
  }

  return (
    <div style={{display:"inline-flex",alignItems:"center",gap:5,background:bgCol,borderRadius:6,padding:"3px 8px",marginTop:4}}>
      <span style={{fontSize:10,color,fontWeight:600}}>{defaultLabel}</span>
      <span style={{fontSize:12,color,fontWeight:900,fontFamily:"monospace"}}>{parts}</span>
    </div>
  );
}

// ─── PREDICTION RESULT HELPER ─────────────────────────────────────────────────
function getPredictionResult(score, home, away) {
  const p = parseScore(score);
  if (!p) return null;
  if (p.h === p.a) {
    const isNilNil = p.h === 0;
    const isOneOne = p.h === 1;
    const drawMsg = isNilNil || isOneOne
      ? "Draw — Haramball for the win! 🦍"
      : "You've predicted a draw";
    return { label:"Draw 🤝", detail:drawMsg, color:"#94a3b8", bg:"rgba(148,163,184,0.12)" };
  }
  if (p.h > p.a) return { label:`${home} to win`, detail:`You've predicted ${home} win ${p.h}–${p.a}`, color:"#22c55e", bg:"rgba(34,197,94,0.1)" };
  return { label:`${away} to win`, detail:`You've predicted ${away} win ${p.a}–${p.h}`, color:"#60a5fa", bg:"rgba(96,165,250,0.1)" };
}
function TimeBadges({time, inline=false}) {
  const tz = fmtAllTimes(time);
  if (inline) {
    return (
      <span style={{fontSize:11,color:"#64748b"}}>
        {tz.et} · {tz.bst} · {tz.cest} · {tz.ist}
      </span>
    );
  }
  return (
    <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:4}}>
      {[["ET",tz.et,"#1B5E20"],["BST",tz.bst,"#01579B"],["CEST",tz.cest,"#4A148C"],["IST",tz.ist,"#E65100"]].map(([label,val,color])=>(
        <span key={label} style={{background:color,color:"#fff",borderRadius:6,padding:"2px 7px",fontSize:10,fontWeight:700,whiteSpace:"nowrap"}}>
          {val}
        </span>
      ))}
    </div>
  );
}

// ─── SCORE ENGINE ─────────────────────────────────────────────────────────────
function calcScores(data) {
  const scores = {};
  // All players = anyone who has entered predictions, match predictions, qualifiers or deductions
  const players = new Set([
    ...Object.keys(data.predictions),
    ...Object.keys(data.deductions),
    ...Object.keys(data.matchPredictions).map(k=>k.split("_").slice(0,-1).join("_")),
    ...Object.keys(data.groupQualifiers).map(k=>k.split("_")[0]),
  ]);
  players.forEach(p => {
    let predPts=0,matchPts=0,qualPts=0,exactCount=0,resultCount=0;
    const pred=data.predictions[p]||{};
    if(pred.winner&&data.matchActuals._winner&&pred.winner===data.matchActuals._winner) predPts+=POINTS.winner;
    if(pred.runnerUp&&data.matchActuals._runnerUp&&pred.runnerUp===data.matchActuals._runnerUp) predPts+=POINTS.runnerUp;
    if(pred.thirdPlace&&data.matchActuals._thirdPlace&&pred.thirdPlace===data.matchActuals._thirdPlace) predPts+=POINTS.thirdPlace;
    if(pred.goldenBoot&&data.matchActuals._goldenBoot&&pred.goldenBoot===data.matchActuals._goldenBoot) predPts+=POINTS.goldenBoot;
    if(pred.goldenBall&&data.matchActuals._goldenBall&&pred.goldenBall===data.matchActuals._goldenBall) predPts+=POINTS.goldenBall;
    if(pred.goldenGlove&&data.matchActuals._goldenGlove&&pred.goldenGlove===data.matchActuals._goldenGlove) predPts+=POINTS.goldenGlove;
    MATCHES.forEach(m => {
      const key=`${p}_${m.id}`, predicted=data.matchPredictions[key], actual=data.matchActuals[m.id]?.score;
      const rankings = data.teamRankings||{};
      const { home, away } = getMatchTeams(m, data);
      if(actual&&predicted){ const pts=calcMatchPts(actual,predicted,rankings[home],rankings[away],m.stage); matchPts+=pts; const sp2=getStagePts(m.stage);if(pts>=sp2.exact)exactCount++; else if(pts>0&&pts<sp2.exact)resultCount++; }
    });
    Object.keys(GROUPS).forEach(grp => { for(let s=0;s<2;s++){ const q=data.groupQualifiers[`${p}_${grp}_${s}`]; if(q?.qualified===true)qualPts+=POINTS.groupQualifier; }});
    const ded=data.deductions[p]||0;
    scores[p]={ predPts, matchPts, qualPts, ded, exactCount, resultCount, total:predPts+matchPts+qualPts-ded };
  });
  return scores;
}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  const [player,setPlayer]=useState(()=>localStorage.getItem("wc2026_player")||"");
  const [playerInput,setPlayerInput]=useState("");
  const [isAdmin,setIsAdmin]=useState(()=>localStorage.getItem("wc2026_isAdmin")==="true");
  const [adminInput,setAdminInput]=useState("");
  const [tab,setTab]=useState("home");
  const [matchFilter,setMatchFilter]=useState("All");
  const [saving,setSaving]=useState(false);
  const [toast,setToast]=useState(null);
  const [h2hA,setH2hA]=useState("");
  const [h2hB,setH2hB]=useState("");

  // Onboarding pendo — show on every login, skip dismisses for current session only
  const [showOnboarding,setShowOnboarding]=useState(false);
  useEffect(()=>{
    if(!player||isAdmin) return;
    setShowOnboarding(true);
  },[player,isAdmin]);

  // Persist session to localStorage whenever player/isAdmin changes
  useEffect(()=>{ localStorage.setItem("wc2026_player", player); },[player]);
  useEffect(()=>{ localStorage.setItem("wc2026_isAdmin", isAdmin); },[isAdmin]);

  // Migrate old Firebase data to ensure all new fields exist
  const migrateData = d => {
    if(!d) return initData();
    const init = initData();
    // Add any missing fields from initData without overwriting existing data
    Object.keys(init).forEach(k => { if(d[k]===undefined) d[k]=init[k]; });
    return d;
  };

  useEffect(()=>{
    loadData().then(d=>{ setData(migrateData(d)); setLoading(false); });
    const unsub = subscribeToData(remote => {
      if(remote) setData(migrateData(remote));
    });
    return () => unsub();
  },[]);

  const persist = useCallback(async nd => { setSaving(true); await saveData(nd); setSaving(false); },[]);
  const update = useCallback(fn => { setData(prev => { const next=fn(JSON.parse(JSON.stringify(prev))); persist(next); return next; }); },[persist]);
  const toast_ = (msg,type="success") => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

  if(loading) return <Splash/>;

  // Show login screen before any expensive calculations
  if(!player&&!isAdmin) return <Login playerInput={playerInput} setPlayerInput={setPlayerInput} adminInput={adminInput} setAdminInput={setAdminInput} setPlayer={setPlayer} setIsAdmin={setIsAdmin} toast_={toast_} toast={toast} data={data} update={update}/>;

  // Guard against null/incomplete data
  if(!data?.matchPredictions || !data?.predictions) return <Splash/>;

  const scores = calcScores(data);
  const ranked = Object.entries(scores)
    .filter(([p]) => data.predictions[p] || Object.keys(data.matchPredictions).some(k=>k.startsWith(p+"_")))
    .sort((a,b) => b[1].total - a[1].total);
  const stageInfo = getCurrentStage();

  // Upcoming matches (next 5 not yet kicked off)
  const upcoming = MATCHES.filter(m=>!isLocked(m)).slice(0,5);
  // Recent results (last 5 with actual scores)
  const recentResults = [...MATCHES].reverse().filter(m=>data.matchActuals[m.id]?.score).slice(0,5);

  const tournamentStarted = Date.now() >= new Date("2026-06-11T19:00:00Z").getTime();
  const groupStageOver   = Date.now() >= new Date("2026-06-28T04:00:00Z").getTime(); // after last group matches

  const playerTabs=[
    {id:"home",label:"🏠",tip:"Home"},
    {id:"rules",label:"📖",tip:"Rules"},
    {id:"leaderboard",label:"🏆",tip:"Leaderboard"},
    {id:"dashboard",label:"📊",tip:"Dashboard"},
    ...(tournamentStarted?[{id:"picks",label:"👁",tip:"All Picks"}]:[]),
    {id:"predictions",label:"🔮",tip:"Predictions"},
    {id:"matches",label:"⚽",tip:"Matches"},
    {id:"qualifiers",label:"👥",tip:"Qualifiers"},
    {id:"h2h",label:"⚔️",tip:"Head-to-Head"},
    {id:"groups",label:"🌍",tip:"Groups"},
    {id:"schedule",label:"📅",tip:"Schedule"},
    {id:"profile",label:"👤",tip:"Profile"},
  ];
  const adminTabs=[
    {id:"home",label:"🏠",tip:"Home"},
    {id:"rules",label:"📖",tip:"Rules"},
    {id:"leaderboard",label:"🏆",tip:"Leaderboard"},
    {id:"dashboard",label:"📊",tip:"Dashboard"},
    ...(tournamentStarted?[{id:"picks",label:"👁",tip:"All Picks"}]:[]),
    {id:"admin_results",label:"⚙️",tip:"Results"},
    {id:"admin_qualifiers",label:"✅",tip:"Qualifiers"},
    {id:"admin_bracket",label:"🏟️",tip:"Bracket"},
    {id:"admin_deductions",label:"📉",tip:"Deductions"},
    {id:"admin_settings",label:"🔧",tip:"Settings"},
    {id:"h2h",label:"⚔️",tip:"Head-to-Head"},
    {id:"schedule",label:"📅",tip:"Schedule"},
    {id:"groups",label:"🌍",tip:"Groups"},
  ];
  const tabs=isAdmin?adminTabs:playerTabs;

  const onLogout = ()=>{
    setPlayer(""); setIsAdmin(false); setAdminInput(""); setPlayerInput(""); setTab("home");
    localStorage.removeItem("wc2026_player"); localStorage.removeItem("wc2026_isAdmin");
  };

  const playerTZ = getPlayerTZ(data, player);

  return (
    <div style={{fontFamily:"'Nunito','Trebuchet MS',system-ui,sans-serif",background:"#0f1923",minHeight:"100vh",display:"flex"}}>
      {/* Responsive Nav — sidebar on desktop, bottom on mobile */}
      <Nav tabs={tabs} tab={tab} setTab={setTab} player={player} isAdmin={isAdmin}
        onLogout={onLogout} saving={saving} stageInfo={stageInfo}/>
      {/* Main area */}
      <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>
        {/* Mobile-only top header (desktop has sidebar header) */}
        <MobileOnly>
          <div style={S.header}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <WC26Ball size={26}/>
              <div>
                <div style={{fontWeight:900,fontSize:13,background:"linear-gradient(90deg,#f0c040,#f9a825)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>WC 2026</div>
                <div style={{fontSize:11,color:"#A5D6A7"}}>{isAdmin?"⚙️ Admin":`👤 ${player}`}</div>
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              {saving&&<span style={{fontSize:13,opacity:.7}}>💾</span>}
              <div style={{background:"rgba(255,255,255,.15)",borderRadius:20,padding:"3px 10px",fontSize:10,color:"#fff",fontWeight:600}}>{stageInfo.stage}</div>
              <button style={{background:"none",border:"2px solid rgba(255,255,255,.3)",color:"#fff",borderRadius:8,padding:"4px 10px",cursor:"pointer",fontSize:12}} onClick={onLogout}>✕</button>
            </div>
          </div>
        </MobileOnly>
        {/* Content — extra bottom padding on mobile to clear the bottom nav */}
        <div style={{padding:"16px 16px 90px",flex:1,overflowY:"auto",background:"#0f1923"}}>
          <div style={{maxWidth:860,margin:"0 auto"}}>
            {tab==="home"          && <HomeTab ranked={ranked} scores={scores} player={player} upcoming={upcoming} recentResults={recentResults} data={data} isAdmin={isAdmin} stageInfo={stageInfo} playerTZ={playerTZ}/>}
            {tab==="leaderboard"   && <Leaderboard ranked={ranked} scores={scores} player={player} data={data}/>}
            {tab==="dashboard"     && <Dashboard ranked={ranked} scores={scores} player={player} data={data} isAdmin={isAdmin}/>}
            {tab==="predictions"   && !isAdmin && <PredictionsTab player={player} data={data} update={update} toast_={toast_} stageInfo={stageInfo}/>}
            {tab==="matches"       && !isAdmin && <MatchesTab player={player} data={data} update={update} toast_={toast_} matchFilter={matchFilter} setMatchFilter={setMatchFilter} playerTZ={playerTZ}/>}
            {tab==="qualifiers"    && !isAdmin && <PlayerQualifiers player={player} data={data} update={update} toast_={toast_}/>}
            {tab==="profile"       && !isAdmin && <PlayerProfile player={player} data={data} update={update} toast_={toast_}/>}
            {tab==="picks"          && <AllPicksTab ranked={ranked} data={data} player={player} groupStageOver={groupStageOver}/>}
            {tab==="h2h"           && <H2HTab ranked={ranked} scores={scores} data={data} h2hA={h2hA} setH2hA={setH2hA} h2hB={h2hB} setH2hB={setH2hB}/>}
            {tab==="groups"        && <GroupsTab/>}
            {tab==="schedule"      && <ScheduleTab data={data} playerTZ={playerTZ}/>}
            {tab==="rules"         && <RulesTab/>}
            {tab==="admin_results" && isAdmin && <AdminResults data={data} update={update} toast_={toast_}/>}
            {tab==="admin_qualifiers" && isAdmin && <AdminQualifiers data={data} update={update} toast_={toast_}/>}
            {tab==="admin_deductions" && isAdmin && <AdminDeductions data={data} update={update} toast_={toast_} ranked={ranked}/>}
            {tab==="admin_bracket"   && isAdmin && <AdminBracket data={data} update={update} toast_={toast_}/>}
            {tab==="admin_settings" && isAdmin && <AdminSettings data={data} update={update} toast_={toast_}/>}
          </div>
        </div>
      </div>
      {toast && <Toast toast={toast}/>}
      {showOnboarding && !isAdmin && (
        <OnboardingModal
          player={player}
          onClose={()=>setShowOnboarding(false)}
          onGoTo={(t)=>{ setShowOnboarding(false); setTab(t); }}
          tournamentStarted={new Date()>=new Date("2026-06-11T19:00:00Z")}
        />
      )}
    </div>
  );
}

// ─── SPLASH ───────────────────────────────────────────────────────────────────
function Splash() {
  return (
    <div style={{minHeight:"100vh",position:"relative",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
      <Fifa26Background/>
      <div style={{position:"relative",zIndex:1,textAlign:"center"}}>
        <WC26Ball size={80}/>
        <div style={{color:"#FFD700",fontSize:22,fontWeight:900,fontFamily:"Georgia,serif",marginTop:16}}>Loading…</div>
      </div>
    </div>
  );
}

// ─── FIFA 26 BALL SVG ────────────────────────────────────────────────────────
function WC26Ball({size=80}) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id="ballClip"><circle cx="50" cy="50" r="46"/></clipPath>
        <radialGradient id="ballShine" cx="35%" cy="30%" r="60%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.9)"/>
          <stop offset="100%" stopColor="rgba(255,255,255,0)"/>
        </radialGradient>
      </defs>
      {/* Base white */}
      <circle cx="50" cy="50" r="46" fill="#fff" stroke="#ddd" strokeWidth="1"/>
      {/* Coloured panels inspired by Trionda */}
      <g clipPath="url(#ballClip)">
        <path d="M50 4 Q70 15 80 35 Q65 30 50 40 Q35 30 20 35 Q30 15 50 4Z" fill="#E53935"/>
        <path d="M80 35 Q90 50 80 65 Q70 55 65 50 Q70 40 80 35Z" fill="#1E88E5"/>
        <path d="M80 65 Q70 85 50 96 Q55 75 65 70 Q73 68 80 65Z" fill="#43A047"/>
        <path d="M50 96 Q30 85 20 65 Q27 68 35 70 Q45 75 50 96Z" fill="#FFD700"/>
        <path d="M20 65 Q10 50 20 35 Q30 40 35 50 Q30 55 20 65Z" fill="#8E24AA"/>
        <path d="M20 35 Q35 30 50 40 Q50 55 35 50 Q27 42 20 35Z" fill="#00ACC1"/>
        <path d="M80 35 Q65 30 50 40 Q50 55 65 50 Q73 42 80 35Z" fill="#FB8C00"/>
        <path d="M50 40 Q65 50 65 70 Q55 75 50 96 Q45 75 35 70 Q35 50 50 40Z" fill="#fff" opacity="0.15"/>
        {/* Pentagon patches */}
        <polygon points="50,40 62,48 58,62 42,62 38,48" fill="#111" opacity="0.85"/>
        <polygon points="50,4 60,12 56,24 44,24 40,12" fill="#111" opacity="0.75"/>
        <polygon points="80,35 88,46 84,58 74,55 72,43" fill="#111" opacity="0.75"/>
        <polygon points="72,68 80,65 84,58 74,55 65,65" fill="#111" opacity="0.6"/>
        <polygon points="20,35 12,46 16,58 26,55 28,43" fill="#111" opacity="0.75"/>
        <polygon points="28,68 20,65 16,58 26,55 35,65" fill="#111" opacity="0.6"/>
        <polygon points="50,96 60,88 56,76 44,76 40,88" fill="#111" opacity="0.7"/>
      </g>
      {/* Shine overlay */}
      <circle cx="50" cy="50" r="46" fill="url(#ballShine)"/>
      {/* Outline */}
      <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="1.5"/>
    </svg>
  );
}

// ─── FIFA 26 BACKGROUND SVG ──────────────────────────────────────────────────
function Fifa26Background() {
  // Recreates the bold concentric coloured stripe aesthetic from the WC2026 branding
  const stripes = [
    "#E53935","#FB8C00","#FDD835","#43A047","#00ACC1",
    "#1E88E5","#8E24AA","#D81B60","#F4511E","#00897B",
    "#546E7A","#6D4C41","#1E88E5","#43A047","#E53935",
  ];
  return (
    <div style={{position:"absolute",inset:0,overflow:"hidden",zIndex:0}}>
      <svg width="100%" height="100%" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <rect width="800" height="600" fill="#1a0a2e"/>
        {/* Concentric perspective stripes — top */}
        {stripes.map((c,i)=>(
          <path key={`t${i}`}
            d={`M${-50+i*28},0 L${850-i*28},0 L${500-i*22},${310-i*18} L${300+i*22},${310-i*18} Z`}
            fill={c} opacity={0.7+i*0.01}/>
        ))}
        {/* Concentric perspective stripes — bottom */}
        {stripes.map((c,i)=>(
          <path key={`b${i}`}
            d={`M${-50+i*28},600 L${850-i*28},600 L${500-i*22},${310+i*18} L${300+i*22},${310+i*18} Z`}
            fill={c} opacity={0.7+i*0.01}/>
        ))}
        {/* Dark centre oval for readability */}
        <ellipse cx="400" cy="300" rx="260" ry="220" fill="rgba(10,5,20,0.55)"/>
        {/* "26" large background text */}
        <text x="400" y="340" textAnchor="middle" fontSize="320" fontWeight="900"
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2"
          fontFamily="Georgia,serif">26</text>
      </svg>
    </div>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function Login({playerInput,setPlayerInput,adminInput,setAdminInput,setPlayer,setIsAdmin,toast_,toast,data,update}) {
  const checkAdminPw = pw => pw===ADMIN_PASSWORD || (data?.adminPassword && pw===data.adminPassword);
  const passwords = data?.playerPasswords || {};

  const [step, setStep] = useState("entry");
  const [nameInput, setNameInput] = useState(playerInput||"");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwInput, setPwInput] = useState("");
  const [err, setErr] = useState("");

  function handleNameNext() {
    const name = nameInput.trim();
    if (!name) return;
    setErr("");
    if (passwords[name]) { setStep("existing_password"); }
    else { setStep("new_password"); }
  }
  function handleNewPassword() {
    if (pw1.length < 4) { setErr("Password must be at least 4 characters."); return; }
    if (pw1 !== pw2)    { setErr("Passwords don't match."); return; }
    const name = nameInput.trim();
    update(d => { d.playerPasswords = d.playerPasswords||{}; d.playerPasswords[name] = pw1; return d; });
    setPlayer(name);
  }
  function handleExistingPassword() {
    const name = nameInput.trim();
    if (pwInput === passwords[name] || checkAdminPw(pwInput)) {
      setPlayer(name);
    } else {
      setErr("Wrong password. Ask admin to reset it if needed.");
    }
  }

  // Shared input style — dark themed for the new bg
  const inp2 = {border:"2px solid rgba(255,255,255,0.25)",borderRadius:10,padding:"11px 14px",fontSize:14,outline:"none",fontFamily:"inherit",width:"100%",boxSizing:"border-box",background:"rgba(255,255,255,0.12)",color:"#fff","::placeholder":{color:"rgba(255,255,255,0.5)"}};
  const lbl2 = {fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.7)",textTransform:"uppercase",letterSpacing:.8,display:"block",marginBottom:4};
  const btn2 = (bg="#1B5E20") => ({background:bg,color:"#fff",border:"none",borderRadius:10,padding:"12px 20px",fontSize:14,fontWeight:700,cursor:"pointer",width:"100%",boxShadow:"0 4px 14px rgba(0,0,0,0.3)"});

  return (
    <div style={{minHeight:"100vh",position:"relative",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <Fifa26Background/>

      {/* Card */}
      <div style={{position:"relative",zIndex:1,background:"rgba(15,10,30,0.82)",backdropFilter:"blur(12px)",borderRadius:24,padding:"32px 28px",maxWidth:400,width:"100%",boxShadow:"0 24px 60px rgba(0,0,0,0.6)",border:"1px solid rgba(255,255,255,0.12)"}}>

        {/* Logo area */}
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{display:"flex",justifyContent:"center",marginBottom:12}}>
            <WC26Ball size={90}/>
          </div>
          <h1 style={{margin:"0 0 4px",fontSize:28,fontWeight:900,color:"#fff",fontFamily:"Georgia,serif",lineHeight:1.1}}>
            FIFA World Cup
          </h1>
          <div style={{fontSize:52,fontWeight:900,color:"#FFD700",fontFamily:"Georgia,serif",lineHeight:1,margin:"2px 0"}}>
            2026
          </div>
          <p style={{margin:"6px 0 0",color:"rgba(255,255,255,0.5)",fontSize:13,fontWeight:600,letterSpacing:3,textTransform:"uppercase"}}>
            Betting Tracker
          </p>
          <div style={{display:"flex",justifyContent:"center",gap:8,marginTop:10,flexWrap:"wrap"}}>
            {["🇺🇸 USA","🇨🇦 Canada","🇲🇽 Mexico"].map(h=>(
              <span key={h} style={{background:"rgba(255,255,255,0.1)",borderRadius:20,padding:"3px 10px",fontSize:11,color:"rgba(255,255,255,0.7)"}}>{h}</span>
            ))}
          </div>
        </div>

        <div style={{height:1,background:"rgba(255,255,255,0.12)",margin:"0 0 20px"}}/>

        {/* Step 1: Name */}
        {step==="entry" && (
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
            <label style={lbl2}>Your Name</label>
            <input style={inp2} placeholder="Type your name…" value={nameInput}
              onChange={e=>{setNameInput(e.target.value);setErr("");}}
              onKeyDown={e=>e.key==="Enter"&&nameInput.trim()&&handleNameNext()}/>
            {err&&<div style={{color:"#FF8A80",fontSize:12}}>{err}</div>}
            <button style={btn2("#FFD700")} onClick={handleNameNext}>
              <span style={{color:"#1A1A1A",fontWeight:800}}>Continue →</span>
            </button>
          </div>
        )}

        {/* Step 2a: New password */}
        {step==="new_password" && (
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
            <div style={{background:"rgba(76,175,80,0.2)",border:"1px solid rgba(76,175,80,0.4)",borderRadius:8,padding:"8px 12px",fontSize:13,color:"#A5D6A7"}}>
              👋 Welcome <strong>{nameInput}</strong>! Create a password.
            </div>
            <label style={lbl2}>Create Password</label>
            <input style={inp2} type="password" placeholder="Min 4 characters" value={pw1}
              onChange={e=>{setPw1(e.target.value);setErr("");}}/>
            <label style={lbl2}>Confirm Password</label>
            <input style={inp2} type="password" placeholder="Repeat password" value={pw2}
              onChange={e=>{setPw2(e.target.value);setErr("");}}
              onKeyDown={e=>e.key==="Enter"&&handleNewPassword()}/>
            {err&&<div style={{color:"#FF8A80",fontSize:12}}>{err}</div>}
            <button style={btn2("#FFD700")} onClick={handleNewPassword}>
              <span style={{color:"#1A1A1A",fontWeight:800}}>Create Account →</span>
            </button>
            <button style={{...btn2("rgba(255,255,255,0.1)"),marginTop:2}} onClick={()=>{setStep("entry");setErr("");}}>← Back</button>
          </div>
        )}

        {/* Step 2b: Existing password */}
        {step==="existing_password" && (
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
            <div style={{background:"rgba(30,136,229,0.2)",border:"1px solid rgba(30,136,229,0.4)",borderRadius:8,padding:"8px 12px",fontSize:13,color:"#90CAF9"}}>
              👋 Welcome back <strong>{nameInput}</strong>!
            </div>
            <label style={lbl2}>Password</label>
            <input style={inp2} type="password" placeholder="Your password" value={pwInput}
              onChange={e=>{setPwInput(e.target.value);setErr("");}}
              onKeyDown={e=>e.key==="Enter"&&handleExistingPassword()}/>
            {err&&<div style={{background:"rgba(198,40,40,0.2)",border:"1px solid rgba(198,40,40,0.4)",borderRadius:8,padding:"8px 10px",fontSize:12,color:"#FF8A80"}}>{err}</div>}
            <button style={btn2("#FFD700")} onClick={handleExistingPassword}>
              <span style={{color:"#1A1A1A",fontWeight:800}}>Log In →</span>
            </button>
            <button style={{...btn2("rgba(255,255,255,0.1)"),marginTop:2}} onClick={()=>{setStep("entry");setErr("");setPwInput("");}}>← Back</button>
          </div>
        )}

        <div style={{height:1,background:"rgba(255,255,255,0.12)",margin:"0 0 20px"}}/>

        {/* Admin */}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <label style={lbl2}>Admin Access</label>
          <input style={inp2} type="password" placeholder="Admin password…" value={adminInput}
            onChange={e=>setAdminInput(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"){if(checkAdminPw(adminInput))setIsAdmin(true);else toast_("Wrong password","error");}}}/>
          <button style={btn2("#E65100")} onClick={()=>{if(checkAdminPw(adminInput))setIsAdmin(true);else toast_("Wrong password","error");}}>
            Enter as Admin ⚙️
          </button>
        </div>

        <div style={{marginTop:16,textAlign:"center",fontSize:10,color:"rgba(255,255,255,0.3)",letterSpacing:1}}>
          Jun 11 – Jul 19, 2026 · 48 Teams · 104 Matches
        </div>
      </div>
      {toast&&<Toast toast={toast}/>}
    </div>
  );
}

// ─── RESPONSIVE NAV ───────────────────────────────────────────────────────────
function Nav({tabs,tab,setTab,player,isAdmin,onLogout,saving,stageInfo}) {
  const [mobileOpen,setMobileOpen]=useState(false);

  // Sidebar (desktop ≥ 768px)
  const sidebar = (
    <div style={{
      width:220,flexShrink:0,
      background:"linear-gradient(180deg,#111c2a 0%,#0d1520 100%)",
      borderRight:"1px solid rgba(240,192,64,0.12)",
      minHeight:"100vh",display:"flex",flexDirection:"column",position:"sticky",top:0,
      boxShadow:"4px 0 24px rgba(0,0,0,.4)",zIndex:90,
    }}>
      {/* Logo */}
      <div style={{padding:"20px 16px 16px",borderBottom:"1px solid rgba(240,192,64,0.12)"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
          <WC26Ball size={32}/>
          <div style={{fontWeight:900,fontSize:16,background:"linear-gradient(90deg,#f0c040,#f9a825)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",letterSpacing:"-0.5px"}}>WC 2026</div>
        </div>
        <div style={{fontSize:11,color:"#64748b",marginTop:2,fontWeight:600}}>{isAdmin?"⚙️ Admin":`👤 ${player}`}</div>
        {saving&&<div style={{fontSize:10,color:"#f0c040",marginTop:2}}>💾 Saving…</div>}
      </div>
      {/* Stage pill */}
      <div style={{padding:"8px 12px",borderBottom:"1px solid rgba(240,192,64,0.1)"}}>
        <div style={{background:"rgba(240,192,64,0.12)",borderRadius:20,padding:"4px 10px",fontSize:11,color:"#f0c040",fontWeight:700,textAlign:"center",letterSpacing:"0.5px"}}>{stageInfo.stage}</div>
      </div>
      {/* Nav items */}
      <div style={{flex:1,overflowY:"auto",padding:"8px 0"}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            width:"100%",display:"flex",alignItems:"center",gap:10,
            padding:"10px 16px",
            background:tab===t.id?"rgba(240,192,64,0.1)":"none",
            border:"none",borderLeft:tab===t.id?"3px solid #f0c040":"3px solid transparent",
            cursor:"pointer",textAlign:"left",transition:"all .12s",borderRadius:"0 8px 8px 0",margin:"1px 0",
          }}>
            <span style={{fontSize:16,flexShrink:0}}>{t.label}</span>
            <span style={{fontSize:12,fontWeight:tab===t.id?800:500,color:tab===t.id?"#f0c040":"#475569",whiteSpace:"nowrap"}}>{t.tip}</span>
          </button>
        ))}
      </div>
      {/* Logout */}
      <div style={{padding:"12px",borderTop:"1px solid rgba(255,255,255,.1)"}}>
        <button style={{...sBtn,background:"rgba(239,68,68,0.12)",color:"#ef4444",fontSize:12,padding:"8px 12px",border:"1px solid rgba(239,68,68,0.2)",borderRadius:8}} onClick={onLogout}>
          ✕ Log Out
        </button>
      </div>
    </div>
  );

  // Bottom nav (mobile < 768px)
  const bottomNav = (
    <div style={{
      position:"fixed",bottom:0,left:0,right:0,
      background:"#111c2a",borderTop:"1px solid rgba(240,192,64,0.15)",
      display:"flex",justifyContent:"space-around",
      zIndex:99,padding:"4px 0 6px",
      boxShadow:"0 -4px 20px rgba(0,0,0,.5)",
    }}>
      {tabs.map(t=>(
        <button key={t.id} title={t.tip} onClick={()=>setTab(t.id)} style={{
          flex:1,background:"none",border:"none",
          padding:"4px 2px 2px",cursor:"pointer",
          display:"flex",flexDirection:"column",alignItems:"center",gap:1,
          color:tab===t.id?"#f0c040":"#475569",
          minWidth:0,maxWidth:64,
        }}>
          <span style={{fontSize:17,lineHeight:1}}>{t.label}</span>
          <span style={{fontSize:8,fontWeight:tab===t.id?800:400,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",width:"100%",textAlign:"center"}}>
            {t.tip}
          </span>
          {tab===t.id&&<div style={{width:16,height:2,background:"#f0c040",borderRadius:999,marginTop:1}}/>}
        </button>
      ))}
    </div>
  );

  return (
    <>
      {/* Desktop sidebar — hidden on mobile via media query workaround using ref */}
      <DesktopOnly>{sidebar}</DesktopOnly>
      {/* Mobile bottom nav — hidden on desktop */}
      <MobileOnly>{bottomNav}</MobileOnly>
    </>
  );
}

// Helper components to conditionally render based on screen width
function DesktopOnly({children}) {
  const [show,setShow]=useState(window.innerWidth>=768);
  useEffect(()=>{
    const fn=()=>setShow(window.innerWidth>=768);
    window.addEventListener("resize",fn);
    return ()=>window.removeEventListener("resize",fn);
  },[]);
  return show?children:null;
}
function MobileOnly({children}) {
  const [show,setShow]=useState(window.innerWidth<768);
  useEffect(()=>{
    const fn=()=>setShow(window.innerWidth<768);
    window.addEventListener("resize",fn);
    return ()=>window.removeEventListener("resize",fn);
  },[]);
  return show?children:null;
}
// Shared button style for nav logout
const sBtn={background:"#1B5E20",color:"#fff",border:"none",borderRadius:8,padding:"10px 16px",fontSize:14,fontWeight:700,cursor:"pointer",width:"100%"};

// ─── HOME TAB ─────────────────────────────────────────────────────────────────
function HomeTab({ranked,scores,player,upcoming,recentResults,data,isAdmin,stageInfo,playerTZ}) {
  const myScore = scores[player];
  const myRank = ranked.findIndex(([n])=>n===player)+1;
  const leader = ranked[0];
  const gap = leader&&player&&leader[0]!==player ? leader[1].total - (myScore?.total||0) : 0;
  const totalPlayed = MATCHES.filter(m=>data.matchActuals[m.id]?.score).length;
  const remaining = MATCHES.length - totalPlayed;
  const tz = playerTZ || "ET";
  const motd = upcoming[0];

  return (
    <div style={S.sec}>
      {/* Welcome hero */}
      <div style={{background:"linear-gradient(135deg,#1a2535 0%,#0d1520 60%,#111c2a 100%)",border:"1px solid rgba(240,192,64,0.15)",borderRadius:16,padding:"20px 20px 16px",marginBottom:16,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",right:-10,top:-10,fontSize:80,opacity:.08}}>⚽</div>
        <div style={{color:"#A5D6A7",fontSize:12,fontWeight:700,textTransform:"uppercase",letterSpacing:2,marginBottom:4}}>
          {isAdmin ? "Admin Dashboard" : `Welcome back`}
        </div>
        <div style={{color:"#FFD700",fontSize:26,fontWeight:900,fontFamily:"Georgia,serif",marginBottom:12}}>
          {isAdmin ? "⚙️ Control Panel" : player || "Guest"}
        </div>
        <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
          {[
            ["🏟️","Matches Played",totalPlayed],
            ["⏳","Remaining",remaining],
            ["📅","Stage",stageInfo.stage],
            ...(myScore?[["🏆","My Points",myScore.total],["🎯","My Rank",`#${myRank}`]]:[]),
          ].map(([ic,l,v])=>(
            <div key={l} style={{background:"rgba(240,192,64,0.08)",border:"1px solid rgba(240,192,64,0.15)",borderRadius:10,padding:"8px 12px",minWidth:70}}>
              <div style={{color:"#FFD700",fontSize:11,marginBottom:2}}>{ic} {l}</div>
              <div style={{color:"#fff",fontSize:18,fontWeight:900}}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Gap tracker */}
      {!isAdmin && myScore && ranked.length > 1 && (
        <div style={{background:T.bgCard,border:"1px solid rgba(255,255,255,0.07)",borderRadius:14,padding:16,marginBottom:16,boxShadow:"0 4px 20px rgba(0,0,0,.25)"}}>
          <div style={S.blockTitle}>🎯 Can You Still Win?</div>
          {ranked.map(([name,s],i)=>{
            const maxPerMatch = getStagePts(stageInfo?.stage||"Group Stage").exact;
            const maxRemaining = remaining * maxPerMatch;
            const canCatch = name!==player && (s.total - (myScore.total)) <= maxRemaining;
            const isMe = name===player;
            const w = ranked.length>1?Math.max(10,Math.round((s.total/Math.max(ranked[0][1].total,1))*100)):100;
            return (
              <div key={name} style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:13,fontWeight:isMe?800:500,marginBottom:3}}>
                  <span style={{color:playerColor(name)}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":`#${i+1}`} {name}{isMe?" (you)":""}</span>
                  <span style={{fontWeight:800}}>{s.total}pts {!isMe&&name!==ranked[0][0]&&<span style={{color:canCatch?"#43A047":"#ef5350",fontSize:11}}>{canCatch?"✅ catchable":"❌ out of reach"}</span>}</span>
                </div>
                <div style={{background:"#f0f0f0",borderRadius:999,height:8,overflow:"hidden"}}>
                  <div style={{width:`${w}%`,height:"100%",background:isMe?"#FFD700":playerColor(name),borderRadius:999,transition:"width .5s"}}/>
                </div>
              </div>
            );
          })}
          <div style={{fontSize:11,color:"#64748b",marginTop:8}}>Max pts still available from match predictions: varies by stage</div>
        </div>
      )}

      {/* Match of the Day */}
      {motd && (()=>{
        const converted = convertToTZ(motd.date, motd.time, tz);
        return (
          <div style={{background:"linear-gradient(135deg,#7c1d1d 0%,#4a0e2b 100%)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:14,padding:16,marginBottom:16,color:"#fff"}}>
            <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:2,opacity:.7,marginBottom:6}}>⚡ Next Match</div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
              <div style={{fontWeight:900,fontSize:16,flex:1}}>{motd.home}</div>
              <div style={{background:"rgba(255,255,255,.2)",borderRadius:8,padding:"6px 12px",fontWeight:900,fontSize:13}}>VS</div>
              <div style={{fontWeight:900,fontSize:16,flex:1,textAlign:"right"}}>{motd.away}</div>
            </div>
            <div style={{marginTop:8,fontSize:12,opacity:.8}}>📅 {converted.date} · ⏰ {converted.time} · 📍 {motd.city}</div>
            {converted.dayShift!==0&&<div style={{fontSize:10,opacity:.6,marginTop:2}}>⚠️ Date shifted from ET</div>}
            <div style={{marginTop:6}}><Countdown etDate={motd.date} etTime={motd.time}/></div>
            <div style={{marginTop:4,fontSize:11,opacity:.6}}>{motd.venue}</div>
          </div>
        );
      })()}

      {/* Upcoming */}
      {upcoming.length>0 && (
        <div style={{background:T.bgCard,border:"1px solid rgba(255,255,255,0.07)",borderRadius:14,padding:16,marginBottom:16,boxShadow:"0 4px 20px rgba(0,0,0,.25)"}}>
          <div style={S.blockTitle}>📅 Upcoming Matches <span style={{fontSize:11,color:"#64748b",fontWeight:400}}>({TIMEZONES.find(t=>t.id===tz)?.abbr||"ET"})</span></div>
          {upcoming.slice(0,5).map(m=>{
            const c = convertToTZ(m.date, m.time, tz);
            const { home, away } = getMatchTeams(m, data);
            return (
              <div key={m.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
                <div style={{background:STAGE_COLORS[m.stage]||"#333",color:"#fff",borderRadius:6,padding:"2px 6px",fontSize:10,fontWeight:700,minWidth:24,textAlign:"center"}}>{m.id}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:13,color:T.text}}>{home} <span style={{color:"#475569",fontWeight:400}}>vs</span> {away}</div>
                  <div style={{fontSize:11,color:"#64748b"}}>{c.date} · {c.time}{c.dayShift!==0&&" ⚠️"}</div>
                </div>
                <div style={{fontSize:10,color:"#64748b",textAlign:"right"}}>{m.city}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Recent results */}
      {recentResults.length>0 && (
        <div style={{background:"#fff",borderRadius:14,padding:16,boxShadow:"0 2px 8px rgba(0,0,0,.08)"}}>
          <div style={S.blockTitle}>🏁 Recent Results</div>
          {recentResults.map(m=>{
            const r=data.matchActuals[m.id];
            return (
              <div key={m.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
                <div style={{background:STAGE_COLORS[m.stage]||"#333",color:"#fff",borderRadius:6,padding:"2px 6px",fontSize:10,fontWeight:700}}>{m.id}</div>
                <div style={{flex:1,fontSize:13,fontWeight:600,color:"#f1f5f9"}}>{m.home} <span style={{color:"#22c55e",fontWeight:900,background:"rgba(34,197,94,0.12)",padding:"1px 6px",borderRadius:4}}>{r?.score}</span> {m.away}</div>
                {r?.winner&&<div style={{fontSize:11,color:"#22c55e",fontWeight:700}}>⚽ {r.winner}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── LEADERBOARD ──────────────────────────────────────────────────────────────
function Leaderboard({ranked,scores,player,data}) {
  const medals=["🥇","🥈","🥉"];
  const BUY_IN = 2000; // ₹ per person
  const numPlayers = ranked.length || 1;
  const pot = BUY_IN * numPlayers;
  const payouts=[Math.round(pot*0.6),Math.round(pot*0.3),Math.round(pot*0.1)];
  return (
    <div style={S.sec}>
      <h2 style={S.h2}>🏆 Live Leaderboard</h2>
      {/* Points key */}
      <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:14}}>
        {[["🏆","20"],["🥈","12"],["🥉","8"],["⚽","15"],["🎖","15"],["🧤","12"],["🎯","8"],["✅","3"],["👥","2"]].map(([l,v])=>(
          <div key={l} style={{background:"rgba(34,197,94,0.1)",borderRadius:20,padding:"3px 9px",fontSize:11,border:"1px solid rgba(34,197,94,0.2)",display:"flex",gap:4,color:T.text}}><span>{l}</span><strong>{v}pt</strong></div>
        ))}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {ranked.map(([name,s],i)=>{
          const isMe=name===player;
          const payout=i<3?`💰 ₹${payouts[i].toLocaleString("en-IN")}`:"";
          return (
            <div key={name} style={{background:i===0?"linear-gradient(135deg,rgba(240,192,64,0.15),rgba(249,168,37,0.08))":T.bgCard,borderRadius:14,padding:"14px 16px",border:`1px solid ${isMe?"#22c55e":i===0?"rgba(240,192,64,0.4)":T.border}`,boxShadow:i===0?"0 4px 20px rgba(240,192,64,0.15)":"0 2px 8px rgba(0,0,0,.2)"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{fontSize:24,width:32,textAlign:"center"}}>{medals[i]||`#${i+1}`}</div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                    <div style={{width:10,height:10,borderRadius:"50%",background:playerColor(name),flexShrink:0}}/>
                    <span style={{fontWeight:800,fontSize:15,color:"#f1f5f9"}}>{name}</span>
                    {isMe&&<span style={{background:"rgba(34,197,94,0.2)",color:"#22c55e",border:"1px solid rgba(34,197,94,0.3)",borderRadius:10,padding:"1px 7px",fontSize:10,fontWeight:700}}>you</span>}
                    {payout&&<span style={{marginLeft:"auto",fontSize:12,fontWeight:700,color:"#E65100"}}>{payout}</span>}
                  </div>
                  <div style={{display:"flex",gap:8,fontSize:11,color:"#64748b"}}>
                    <span>🔮 {s.predPts}</span><span>⚽ {s.matchPts}</span><span>👥 {s.qualPts}</span>
                    {s.ded>0&&<span style={{color:"#ef5350"}}>−{s.ded}</span>}
                    <span style={{marginLeft:"auto",fontWeight:700,color:"#94a3b8"}}>🎯 {s.exactCount} exact · ✅ {s.resultCount} correct</span>
                  </div>
                </div>
                <div style={{fontWeight:900,fontSize:24,background:"linear-gradient(90deg,#f0c040,#f9a825)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",minWidth:44,textAlign:"right"}}>{s.total}</div>
              </div>
              {/* progress bar */}
              <div style={{marginTop:8,background:"rgba(255,255,255,0.08)",borderRadius:999,height:5,overflow:"hidden"}}>
                <div style={{width:`${ranked.length>0?Math.max(4,Math.round((s.total/Math.max(ranked[0][1].total,1))*100)):0}%`,height:"100%",background:i===0?"#FFD700":playerColor(name),borderRadius:999}}/>
              </div>
            </div>
          );
        })}
      </div>
      <p style={{color:T.textDim,fontSize:12,marginTop:12,textAlign:"center"}}>₹{BUY_IN.toLocaleString("en-IN")}/person · {numPlayers} player{numPlayers!==1?"s":""} · Total pot: <strong style={{color:T.gold}}>₹{pot.toLocaleString("en-IN")}</strong> · 60/30/10% split</p>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ranked,scores,player,data,isAdmin}) {
  const [view,setView]=useState("trends");

  // Build match-by-match cumulative points data
  const playedMatches = MATCHES.filter(m=>data.matchActuals[m.id]?.score);
  const trendData = playedMatches.map((m,idx)=>{
    const pt={name:`M${m.id}`,date:fmtShort(m.date)};
    ranked.forEach(([name,])=>{
      let cum=0;
      const pred0=data.predictions[name]||{};
      if(data.matchActuals._winner&&pred0.winner===data.matchActuals._winner)cum+=POINTS.winner;
      if(data.matchActuals._runnerUp&&pred0.runnerUp===data.matchActuals._runnerUp)cum+=POINTS.runnerUp;
      if(data.matchActuals._thirdPlace&&pred0.thirdPlace===data.matchActuals._thirdPlace)cum+=POINTS.thirdPlace;
      if(data.matchActuals._goldenBoot&&pred0.goldenBoot===data.matchActuals._goldenBoot)cum+=POINTS.goldenBoot;
      if(data.matchActuals._goldenBall&&pred0.goldenBall===data.matchActuals._goldenBall)cum+=POINTS.goldenBall;
      if(data.matchActuals._goldenGlove&&pred0.goldenGlove===data.matchActuals._goldenGlove)cum+=POINTS.goldenGlove;
      playedMatches.slice(0,idx+1).forEach(mm=>{
        const key=`${name}_${mm.id}`,pred=data.matchPredictions[key],actual=data.matchActuals[mm.id]?.score;
        if(actual&&pred)cum+=calcMatchPts(actual,pred,null,null,m.stage);
      });
      Object.keys(GROUPS).forEach(grp=>{ for(let s=0;s<2;s++){const q=data.groupQualifiers[`${name}_${grp}_${s}`];if(q?.qualified===true)cum+=POINTS.groupQualifier;}});
      cum-=(data.deductions[name]||0);
      pt[name]=cum;
    });
    return pt;
  });

  // Accuracy data
  const accuracyData = ranked.map(([name,s])=>{
    const totalPredictions = playedMatches.length;
    const exactPct=totalPredictions>0?Math.round((s.exactCount/totalPredictions)*100):0;
    const resultPct=totalPredictions>0?Math.round(((s.exactCount+s.resultCount)/totalPredictions)*100):0;
    return {name,exact:exactPct,result:resultPct,total:s.total,color:playerColor(name)};
  });

  // Category breakdown
  const categoryData = ranked.map(([name,s])=>({
    name, predPts:s.predPts, matchPts:s.matchPts, qualPts:s.qualPts, color:playerColor(name)
  }));

  return (
    <div style={S.sec}>
      <h2 style={S.h2}>📊 Dashboard</h2>
      <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
        {[["trends","📈 Trends"],["accuracy","🎯 Accuracy"],["breakdown","🍕 Breakdown"]].map(([v,l])=>(
          <button key={v} style={{...S.chip,...(view===v?S.chipActive:{})}} onClick={()=>setView(v)}>{l}</button>
        ))}
      </div>

      {view==="trends" && (
        <div style={S.card}>
          <div style={S.blockTitle}>📈 Points Over Time</div>
          {trendData.length===0 ? <div style={S.empty}>No results entered yet</div> : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={trendData} margin={{top:5,right:10,left:-20,bottom:5}}>
                <XAxis dataKey="name" tick={{fontSize:10}} interval="preserveStartEnd"/>
                <YAxis tick={{fontSize:10}}/>
                <Tooltip contentStyle={{fontSize:12,borderRadius:8}}/>
                {ranked.map(([name])=><Line key={name} type="monotone" dataKey={name} stroke={playerColor(name)} strokeWidth={name===player?3:1.5} dot={false} activeDot={{r:4}}/>)}
              </LineChart>
            </ResponsiveContainer>
          )}
          <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:10,justifyContent:"center"}}>
            {ranked.map(([name])=><div key={name} style={{display:"flex",alignItems:"center",gap:4,fontSize:12}}><div style={{width:12,height:3,background:playerColor(name),borderRadius:2}}/>{name}</div>)}
          </div>
        </div>
      )}

      {view==="accuracy" && (
        <div style={S.card}>
          <div style={S.blockTitle}>🎯 Prediction Accuracy</div>
          {playedMatches.length===0?<div style={S.empty}>No results yet</div>:(
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {accuracyData.map(d=>(
                <div key={d.name} style={{background:d.name===player?"#F1F8F1":"#fafafa",borderRadius:10,padding:"10px 14px",border:`1px solid ${d.name===player?"#4CAF50":"#eee"}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                    <span style={{fontWeight:700,color:d.color}}>{d.name}</span>
                    <span style={{fontSize:12,color:"#64748b"}}>{d.result}% correct results · {d.exact}% exact</span>
                  </div>
                  <div style={{background:"#e0e0e0",borderRadius:999,height:8,overflow:"hidden",position:"relative"}}>
                    <div style={{width:`${d.result}%`,height:"100%",background:d.color,opacity:.4,borderRadius:999,position:"absolute"}}/>
                    <div style={{width:`${d.exact}%`,height:"100%",background:d.color,borderRadius:999,position:"absolute"}}/>
                  </div>
                  <div style={{display:"flex",gap:12,fontSize:11,color:"#64748b",marginTop:4}}>
                    <span>🎯 {d.exact}% exact scores</span><span>✅ {d.result}% any correct</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{fontSize:11,color:"#475569",marginTop:10,textAlign:"center"}}>Dark bar = exact score · Light bar = correct result (W/D/L)</div>
        </div>
      )}

      {view==="breakdown" && (
        <div style={S.card}>
          <div style={S.blockTitle}>🍕 Points Breakdown by Category</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={categoryData} margin={{top:5,right:10,left:-20,bottom:5}}>
              <XAxis dataKey="name" tick={{fontSize:11}}/>
              <YAxis tick={{fontSize:10}}/>
              <Tooltip contentStyle={{fontSize:12,borderRadius:8}}/>
              <Bar dataKey="predPts" name="Predictions" stackId="a" fill="#FFD700"/>
              <Bar dataKey="matchPts" name="Matches" stackId="a" fill="#1B5E20"/>
              <Bar dataKey="qualPts" name="Qualifiers" stackId="a" fill="#01579B" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
          <div style={{display:"flex",gap:12,justifyContent:"center",marginTop:8,fontSize:11}}>
            {[["#FFD700","Predictions"],["#1B5E20","Matches"],["#01579B","Qualifiers"]].map(([c,l])=>(
              <div key={l} style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:10,height:10,background:c,borderRadius:2}}/>{l}</div>
            ))}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:14}}>
            {categoryData.map(d=>(
              <div key={d.name} style={{display:"flex",alignItems:"center",gap:8,fontSize:13}}>
                <div style={{width:10,height:10,borderRadius:"50%",background:d.color,flexShrink:0}}/>
                <span style={{minWidth:70,fontWeight:600,color:"#e2e8f0"}}>{d.name}</span>
                <span style={{color:"#FFD700",fontWeight:700,minWidth:50}}>🔮 {d.predPts}</span>
                <span style={{color:"#22c55e",fontWeight:700,minWidth:50}}>⚽ {d.matchPts}</span>
                <span style={{color:"#60a5fa",fontWeight:700}}>👥 {d.qualPts}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── HEAD TO HEAD ─────────────────────────────────────────────────────────────
function H2HTab({ranked,scores,data,h2hA,setH2hA,h2hB,setH2hB}) {
  const allPlayers=ranked.map(([n])=>n);
  const sA=scores[h2hA], sB=scores[h2hB];
  const predA=data.predictions[h2hA]||{}, predB=data.predictions[h2hB]||{};
  const playedMatches=MATCHES.filter(m=>data.matchActuals[m.id]?.score);
  const rankings=data.teamRankings||{};

  const matchComparison=playedMatches.map(m=>{
    const actual=data.matchActuals[m.id]?.score;
    const predAScore=data.matchPredictions[`${h2hA}_${m.id}`];
    const predBScore=data.matchPredictions[`${h2hB}_${m.id}`];
    const {home,away}=getMatchTeams(m,data);
    const ptsA=actual&&predAScore?calcMatchPts(actual,predAScore,rankings[home],rankings[away],m.stage):0;
    const ptsB=actual&&predBScore?calcMatchPts(actual,predBScore,rankings[home],rankings[away],m.stage):0;
    return {m,actual,predAScore,predBScore,ptsA,ptsB};
  });
  const matchWinsA=matchComparison.filter(r=>r.ptsA>r.ptsB).length;
  const matchWinsB=matchComparison.filter(r=>r.ptsB>r.ptsA).length;
  const matchDraws=matchComparison.filter(r=>r.ptsA===r.ptsB&&r.ptsA>0).length;

  const predFields=[
    {key:"winner",label:"🏆 Winner",pts:20},{key:"runnerUp",label:"🥈 Runner-Up",pts:12},
    {key:"thirdPlace",label:"🥉 3rd Place",pts:8},{key:"goldenBoot",label:"⚽ Golden Boot",pts:15},
    {key:"goldenBall",label:"🎖 Golden Ball",pts:15},{key:"goldenGlove",label:"🧤 Golden Glove",pts:12},
  ];

  return (
    <div style={S.sec}>
      <h2 style={S.h2}>⚔️ Head-to-Head</h2>
      <div style={{display:"flex",gap:10,marginBottom:16}}>
        <div style={{flex:1}}>
          <label style={S.lbl}>Player A</label>
          <select style={S.sel} value={h2hA} onChange={e=>setH2hA(e.target.value)}>
            <option value="">— Select —</option>
            {allPlayers.filter(p=>p!==h2hB).map(p=><option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div style={{display:"flex",alignItems:"flex-end",padding:"0 4px 8px",fontWeight:900,color:T.textMute}}>VS</div>
        <div style={{flex:1}}>
          <label style={S.lbl}>Player B</label>
          <select style={S.sel} value={h2hB} onChange={e=>setH2hB(e.target.value)}>
            <option value="">— Select —</option>
            {allPlayers.filter(p=>p!==h2hA).map(p=><option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {h2hA&&h2hB&&sA&&sB&&(
        <>
          {/* Score banner */}
          <div style={{background:"linear-gradient(135deg,#1a2535,#0d1520)",border:"1px solid rgba(240,192,64,0.15)",borderRadius:14,padding:20,marginBottom:14,color:"#fff",textAlign:"center"}}>
            <div style={{display:"flex",justifyContent:"space-around",alignItems:"center"}}>
              <div>
                <div style={{width:12,height:12,borderRadius:"50%",background:playerColor(h2hA),margin:"0 auto 6px"}}/>
                <div style={{fontWeight:900,fontSize:18,color:T.text}}>{h2hA}</div>
                <div style={{fontSize:36,fontWeight:900,color:T.gold,margin:"4px 0"}}>{sA.total}</div>
                <div style={{fontSize:11,color:T.textDim}}>pts</div>
              </div>
              <div style={{fontSize:22,color:T.textMute}}>⚔️</div>
              <div>
                <div style={{width:12,height:12,borderRadius:"50%",background:playerColor(h2hB),margin:"0 auto 6px"}}/>
                <div style={{fontWeight:900,fontSize:18,color:T.text}}>{h2hB}</div>
                <div style={{fontSize:36,fontWeight:900,color:T.gold,margin:"4px 0"}}>{sB.total}</div>
                <div style={{fontSize:11,color:T.textDim}}>pts</div>
              </div>
            </div>
            <div style={{marginTop:12,fontSize:13,color:T.textDim}}>
              {sA.total>sB.total?`${h2hA} leads by ${sA.total-sB.total} pts`:sB.total>sA.total?`${h2hB} leads by ${sB.total-sA.total} pts`:"Tied!"}
            </div>
          </div>

          {/* Category comparison */}
          <div style={S.card}>
            <div style={S.blockTitle}>📊 Category Comparison</div>
            {[["🔮 Predictions",sA.predPts,sB.predPts],["⚽ Matches",sA.matchPts,sB.matchPts],["👥 Qualifiers",sA.qualPts,sB.qualPts],["📉 Deductions",-sA.ded,-sB.ded],["🎯 Exact Scores",sA.exactCount,sB.exactCount,"×"],["✅ Correct Results",sA.resultCount,sB.resultCount,"×"]].map(([l,a,b,unit="pts"])=>{
              const max=Math.max(Math.abs(a),Math.abs(b),1);
              return (
                <div key={l} style={{marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:12,fontWeight:600,marginBottom:3}}>
                    <span style={{color:a>=b?playerColor(h2hA):T.textMute,fontWeight:a>=b?800:400}}>{a}{unit}</span>
                    <span style={{color:T.textDim}}>{l}</span>
                    <span style={{color:b>=a?playerColor(h2hB):T.textMute,fontWeight:b>=a?800:400}}>{b}{unit}</span>
                  </div>
                  <div style={{display:"flex",gap:2,height:8}}>
                    <div style={{flex:1,display:"flex",justifyContent:"flex-end"}}>
                      <div style={{width:`${Math.abs(a)/max*100}%`,height:"100%",background:playerColor(h2hA),borderRadius:"4px 0 0 4px"}}/>
                    </div>
                    <div style={{width:2,background:T.border}}/>
                    <div style={{flex:1}}>
                      <div style={{width:`${Math.abs(b)/max*100}%`,height:"100%",background:playerColor(h2hB),borderRadius:"0 4px 4px 0"}}/>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tournament predictions comparison */}
          <div style={S.card}>
            <div style={S.blockTitle}>🔮 Tournament Predictions</div>
            {predFields.map(f=>{
              const va=predA[f.key]||"—", vb=predB[f.key]||"—";
              const match=va!=="—"&&vb!=="—"&&va===vb;
              return (
                <div key={f.key} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderBottom:`1px solid ${T.border}`,fontSize:13}}>
                  <span style={{minWidth:20}}>{f.label.split(" ")[0]}</span>
                  <span style={{flex:1,fontWeight:700,color:playerColor(h2hA),textAlign:"right"}}>{va}</span>
                  <span style={{background:match?"rgba(34,197,94,0.15)":T.bgCard2,borderRadius:6,padding:"2px 8px",fontSize:11,color:match?T.green:T.textMute,fontWeight:600}}>{match?"🤝 Same":"vs"}</span>
                  <span style={{flex:1,fontWeight:700,color:playerColor(h2hB)}}>{vb}</span>
                </div>
              );
            })}
          </div>

          {/* Match wins */}
          {playedMatches.length>0&&(
            <div style={S.card}>
              <div style={S.blockTitle}>⚽ Match-by-Match Record</div>
              <div style={{display:"flex",justifyContent:"space-around",textAlign:"center",marginBottom:12}}>
                {[[h2hA,matchWinsA,playerColor(h2hA)],["Draws",matchDraws,T.textMute],[h2hB,matchWinsB,playerColor(h2hB)]].map(([l,v,c])=>(
                  <div key={l}><div style={{fontSize:28,fontWeight:900,color:c}}>{v}</div><div style={{fontSize:11,color:T.textDim}}>{l}</div></div>
                ))}
              </div>
              <div style={{maxHeight:200,overflowY:"auto"}}>
                {matchComparison.slice(0,20).map(({m,actual,predAScore,predBScore,ptsA,ptsB})=>(
                  <div key={m.id} style={{display:"flex",gap:6,padding:"5px 0",borderBottom:`1px solid ${T.border}`,fontSize:11,alignItems:"center"}}>
                    <span style={{color:T.textMute,minWidth:28}}>#{m.id}</span>
                    <span style={{flex:1,color:ptsA>ptsB?playerColor(h2hA):T.textMute,fontWeight:ptsA>ptsB?700:400}}>{predAScore||"—"} ({ptsA}pt)</span>
                    <span style={{color:T.green,fontWeight:700,background:"rgba(34,197,94,0.12)",padding:"1px 5px",borderRadius:4}}>{actual}</span>
                    <span style={{flex:1,textAlign:"right",color:ptsB>ptsA?playerColor(h2hB):T.textMute,fontWeight:ptsB>ptsA?700:400}}>{predBScore||"—"} ({ptsB}pt)</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      {(!h2hA||!h2hB)&&<div style={S.empty}>Select two players above to compare</div>}
    </div>
  );
}


// ─── PREDICTIONS TAB ──────────────────────────────────────────────────────────
function PredictionsTab({player,data,update,toast_,stageInfo}) {
  const pred=data.predictions[player]||{};
  const locked=new Date()>=new Date("2026-06-11T19:00:00Z");
  const [form,setForm]=useState({winner:pred.winner||"",runnerUp:pred.runnerUp||"",thirdPlace:pred.thirdPlace||"",goldenBoot:pred.goldenBoot||"",goldenBall:pred.goldenBall||"",goldenGlove:pred.goldenGlove||""});
  const [changed,setChanged]=useState(false);

  // Countdown to tournament start — uses Countdown component directly

  const fields=[
    {key:"winner",label:"🏆 Tournament Winner",pts:20,color:"#FFD700"},
    {key:"runnerUp",label:"🥈 Runner-Up",pts:12,color:"#C0C0C0"},
    {key:"thirdPlace",label:"🥉 3rd Place",pts:8,color:"#CD7F32"},
    {key:"goldenBoot",label:"⚽ Golden Boot",pts:15,color:"#22c55e"},
    {key:"goldenBall",label:"🎖 Golden Ball",pts:15,color:"#c084fc"},
    {key:"goldenGlove",label:"🧤 Golden Glove",pts:12,color:"#60a5fa"},
  ];

  function save() {
    const isChange=data.predictions[player]&&Object.keys(data.predictions[player]).length>0;
    if(isChange&&locked&&stageInfo.pts>0&&!window.confirm(`Changing predictions (${stageInfo.stage}) costs ${stageInfo.pts} pts. Continue?`))return;
    update(d=>{
      d.predictions[player]={...form};
      if(isChange&&locked&&stageInfo.pts>0){
        d.deductions[player]=(d.deductions[player]||0)+stageInfo.pts;
        d.changeLog.push({date:new Date().toISOString().slice(0,10),player,what:"Predictions changed",stage:stageInfo.stage,deduction:stageInfo.pts});
      }
      return d;
    });
    setChanged(false);
    toast_("Predictions saved! ✅");
  }

  return (
    <div style={S.sec}>
      <h2 style={S.h2}>🔮 Your Predictions</h2>
      {!locked&&<Countdown etDate="2026-06-11" etTime="15:00" label="Predictions lock at tournament kickoff"/>}
      {locked&&<div style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:13,color:"#fca5a5"}}>⚠️ Tournament started. Changes cost <strong>{stageInfo.pts} pts</strong> ({stageInfo.stage}).</div>}
      <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
        {fields.map(f=>{
          const actualKey=`_${f.key}`;
          const actual=data.matchActuals[actualKey];
          const correct=actual&&form[f.key]===actual;
          const isTextInput = f.key==="goldenBoot"||f.key==="goldenBall"||f.key==="goldenGlove";
          return (
            <div key={f.key} style={{background:T.bgCard,border:"1px solid rgba(255,255,255,0.07)",borderRadius:14,padding:14,boxShadow:"0 2px 12px rgba(0,0,0,.2)",borderLeft:`4px solid ${f.color}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div style={{fontWeight:800,fontSize:14}}>{f.label}</div>
                <div style={{background:f.color,color:"#fff",borderRadius:20,padding:"2px 10px",fontSize:12,fontWeight:700}}>{f.pts} pts</div>
              </div>
              {isTextInput ? (
                <input
                  style={{...S.inp,borderColor:form[f.key]?"#4CAF50":"#e0e0e0",fontSize:14}}
                  placeholder="Type player name (e.g. Messi, Mbappé…)"
                  value={form[f.key]}
                  readOnly={locked}
                  onChange={e=>{setForm(v=>({...v,[f.key]:e.target.value}));setChanged(true);}}
                />
              ) : (
                <select style={{...S.sel,borderColor:form[f.key]?"#4CAF50":"#e0e0e0"}} value={form[f.key]} onChange={e=>{setForm(v=>({...v,[f.key]:e.target.value}));setChanged(true);}}>
                  <option value="">— Select Team —</option>
                  {ALL_TEAMS.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              )}
              {actual&&<div style={{marginTop:8,fontSize:12,background:correct?"#E8F5E9":"#FFEBEE",borderRadius:6,padding:"4px 10px",color:correct?"#1B5E20":"#C62828"}}>
                Actual: <strong>{actual}</strong> {correct?"✅ +"+f.pts+"pts":"❌ 0pts"}
              </div>}
            </div>
          );
        })}
      </div>
      {changed&&<button style={S.btn} onClick={save}>💾 Save Predictions</button>}
      {!changed&&pred.winner&&<div style={{color:"#22c55e",fontWeight:700,fontSize:14,textAlign:"center",padding:8}}>✅ Predictions saved</div>}
    </div>
  );
}

// ─── MATCHES TAB ──────────────────────────────────────────────────────────────
function MatchesTab({player,data,update,toast_,matchFilter,setMatchFilter,playerTZ}) {
  const tz = playerTZ||"ET";
  const tzLabel = TIMEZONES.find(t=>t.id===tz)?.abbr||"ET";
  const stages=["All",...Object.keys(STAGE_COLORS)];
  const filtered=matchFilter==="All"?MATCHES:MATCHES.filter(m=>m.stage===matchFilter);
  const setPred=(matchId,val)=>{ update(d=>{d.matchPredictions[`${player}_${matchId}`]=val;return d;}); };
  const totalPts=MATCHES.reduce((sum,m)=>{
    const actual=data.matchActuals[m.id]?.score, pred=data.matchPredictions[`${player}_${m.id}`];
    const {home,away}=getMatchTeams(m,data); const r=data.teamRankings||{};
    return sum+(actual&&pred?calcMatchPts(actual,pred,r[home],r[away],m.stage):0);
  },0);
  const exactCount=MATCHES.filter(m=>{
    const a=data.matchActuals[m.id]?.score,p=data.matchPredictions[`${player}_${m.id}`];
    const {home,away}=getMatchTeams(m,data); const r=data.teamRankings||{};
    return a&&p&&calcMatchPts(a,p,r[home],r[away],m.stage)>=getStagePts(m.stage).exact;
  }).length;

  return (
    <div style={S.sec}>
      <h2 style={S.h2}>⚽ Match Predictions <span style={{fontSize:13,color:"#64748b",fontWeight:400}}>({tzLabel})</span></h2>
      <div style={{display:"flex",gap:8,marginBottom:12,background:T.bgCard,borderRadius:12,padding:12,border:"1px solid rgba(255,255,255,0.07)"}}>
        {[["⚽ Total Pts",totalPts],["🎯 Exact Scores",exactCount],["📝 Predicted",MATCHES.filter(m=>data.matchPredictions[`${player}_${m.id}`]).length]].map(([l,v])=>(
          <div key={l} style={{flex:1,textAlign:"center"}}><div style={{fontWeight:900,fontSize:20,color:T.gold}}>{v}</div><div style={{fontSize:10,color:T.textDim}}>{l}</div></div>
        ))}
      </div>
      <div style={{display:"flex",gap:5,marginBottom:12,flexWrap:"wrap"}}>
        {stages.map(s=><button key={s} style={{...S.chip,...(matchFilter===s?S.chipActive:{})}} onClick={()=>setMatchFilter(s)}>{s}</button>)}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {filtered.map(m=>(
          <MatchCard key={m.id} m={m} player={player} data={data} setPred={setPred} tz={tz}/>
        ))}
      </div>
    </div>
  );
}

// ─── MATCH CARD (extracted so it can have its own local input state) ──────────
function MatchCard({m, player, data, setPred, tz}) {
  const locked2  = isLocked(m);
  const actual   = data.matchActuals[m.id]?.score;
  const saved    = data.matchPredictions[`${player}_${m.id}`]||"";
  const rankings = data.teamRankings||{};
  const sc       = STAGE_COLORS[m.stage]||"#333";
  const c        = convertToTZ(m.date, m.time, tz);
  const { home, away } = getMatchTeams(m, data);
  const rankHome = rankings[home], rankAway = rankings[away];
  const upsetTier = rankHome && rankAway ? getUpsetTier(rankHome, rankAway) : null;
  const pts      = actual&&saved ? calcMatchPts(actual, saved, rankHome, rankAway, m.stage) : null;

  const [localVal, setLocalVal] = useState(saved);
  useEffect(()=>{ setLocalVal(saved); }, [saved]);

  const predResult = !locked2 && localVal ? getPredictionResult(localVal, home, away) : null;

  function handleChange(e) {
    const val = e.target.value;
    setLocalVal(val);
    if (/^\d+-\d+$/.test(val.trim())) setPred(m.id, val.trim());
    else if (val === "") setPred(m.id, "");
  }
  function handleBlur() { if (localVal !== saved) setPred(m.id, localVal); }

  return (
    <div style={{background:T.bgCard,borderRadius:12,padding:"12px 14px",boxShadow:"0 2px 12px rgba(0,0,0,.2)",border:"1px solid rgba(255,255,255,0.06)"}}>
      {/* Header row */}
      <div style={{display:"flex",alignItems:"flex-start",gap:6,marginBottom:4,flexWrap:"wrap"}}>
        <div style={{background:sc,color:"#fff",borderRadius:5,padding:"2px 7px",fontSize:10,fontWeight:700,flexShrink:0}}>{m.stage}</div>
        <div style={{fontSize:11,color:"#64748b"}}>{c.date} · {c.time} · {m.city}{c.dayShift!==0&&" ⚠️"}</div>
        {locked2&&!actual&&<div style={{marginLeft:"auto",fontSize:10,color:"#475569"}}>🔒 Locked</div>}
      </div>

      {/* Countdown */}
      {!locked2 && <Countdown etDate={m.date} etTime={m.time}/>}

      {/* Teams with rankings */}
      <div style={{display:"flex",alignItems:"center",gap:8,margin:"8px 0"}}>
        <div style={{flex:1}}>
          <div style={{fontWeight:800,fontSize:14,color:T.text}}>{home}</div>
          {rankHome && (
            <div style={{display:"flex",alignItems:"center",gap:4,marginTop:2}}>
              <span style={{width:6,height:6,borderRadius:"50%",background:getRankTier(rankHome).color,flexShrink:0,display:"inline-block"}}/>
              <span style={{fontSize:10,color:getRankTier(rankHome).color,fontWeight:700}}>#{rankHome}</span>
            </div>
          )}
        </div>
        <span style={{color:T.textMute,fontSize:12,fontWeight:700}}>VS</span>
        <div style={{flex:1,textAlign:"right"}}>
          <div style={{fontWeight:800,fontSize:14,color:T.text}}>{away}</div>
          {rankAway && (
            <div style={{display:"flex",alignItems:"center",gap:4,marginTop:2,justifyContent:"flex-end"}}>
              <span style={{fontSize:10,color:getRankTier(rankAway).color,fontWeight:700}}>#{rankAway}</span>
              <span style={{width:6,height:6,borderRadius:"50%",background:getRankTier(rankAway).color,flexShrink:0,display:"inline-block"}}/>
            </div>
          )}
        </div>
      </div>

      {/* Stage points badge — shows available points for this stage */}
      {(()=>{
        const sp=getStagePts(m.stage);
        const isKO=m.stage!=="Group Stage";
        if(!isKO)return null;
        const stageColor=STAGE_COLORS[m.stage]||"#333";
        return(
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6,background:`${stageColor}20`,border:`1px solid ${stageColor}50`,borderRadius:6,padding:"4px 10px"}}>
            <span style={{fontSize:10,color:stageColor,fontWeight:700}}>🏆 {m.stage}:</span>
            <span style={{fontSize:10,color:stageColor,fontWeight:900}}>+{sp.correct} correct</span>
            <span style={{fontSize:10,color:T.textMute}}>·</span>
            <span style={{fontSize:10,color:stageColor,fontWeight:900}}>+{sp.exact} exact</span>
            <span style={{fontSize:10,color:T.textMute,marginLeft:"auto"}}>pts available</span>
          </div>
        );
      })()}

      {/* Upset bonus indicator */}
      {upsetTier && upsetTier.bonus > 0 && (
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8,background:`${upsetTier.color}15`,border:`1px solid ${upsetTier.color}40`,borderRadius:6,padding:"4px 8px"}}>
          <span style={{fontSize:10,color:upsetTier.color,fontWeight:700}}>⚡ Upset bonus available:</span>
          <span style={{fontSize:10,color:upsetTier.color,fontWeight:900}}>{upsetTier.label}</span>
          <span style={{fontSize:10,color:T.textMute,marginLeft:"auto"}}>if lower-ranked team wins</span>
        </div>
      )}

      {/* Result + scorers row */}
      <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
        <div style={{flex:1}}>
          <div style={{fontSize:10,color:"#64748b",marginBottom:3}}>Your prediction</div>
          <input
            style={{border:`2px solid ${locked2?T.border:localVal?T.green:"rgba(255,255,255,0.15)"}`,borderRadius:8,padding:"7px 10px",fontSize:14,fontWeight:700,width:70,textAlign:"center",outline:"none",background:T.bgCard2,color:locked2?T.textMute:T.text}}
            placeholder="2-1" value={localVal} readOnly={locked2}
            onChange={handleChange} onBlur={handleBlur}
          />
        </div>
        {actual&&(
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:10,color:"#64748b",marginBottom:3}}>Result</div>
            <div style={{fontWeight:900,fontSize:16,color:"#22c55e",background:"rgba(34,197,94,0.15)",padding:"4px 10px",borderRadius:8}}>{actual}</div>
          </div>
        )}
        {pts!==null&&(
          <div style={{background:pts>0?"linear-gradient(135deg,#22c55e,#15803d)":"rgba(255,255,255,0.05)",color:pts>0?"#fff":T.textMute,borderRadius:8,padding:"6px 10px",fontWeight:900,fontSize:13,textAlign:"center",minWidth:44}}>
            {pts>0?`+${pts}`:"-"}<div style={{fontSize:9}}>pts</div>
          </div>
        )}
      </div>

      {/* Scorers — shown when result is known */}
      {actual && (() => {
        const scorers = data.matchScorers?.[m.id];
        if(!scorers) return null;
        const hasGoals = (scorers.home?.length||0)+(scorers.away?.length||0)>0;
        if(!hasGoals) return null;
        return (
          <div style={{marginTop:8,display:"flex",gap:6,fontSize:11}}>
            <div style={{flex:1}}>
              {scorers.home?.map((g,i)=>(
                <div key={i} style={{color:T.textDim,padding:"1px 0"}}>⚽ {g}</div>
              ))}
            </div>
            <div style={{width:1,background:T.border}}/>
            <div style={{flex:1,textAlign:"right"}}>
              {scorers.away?.map((g,i)=>(
                <div key={i} style={{color:T.textDim,padding:"1px 0"}}>{g} ⚽</div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Prediction result indicator */}
      {predResult&&(
        <div style={{marginTop:8,background:predResult.bg,borderRadius:8,padding:"6px 10px",display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",border:`1px solid ${predResult.color}30`}}>
          <span style={{fontWeight:800,fontSize:12,color:predResult.color}}>{predResult.label}</span>
          <span style={{fontSize:11,color:T.textDim}}>— {predResult.detail}</span>
        </div>
      )}
    </div>
  );
}


function GroupsTab() {
  const GC={A:"#B71C1C",B:"#1A237E",C:"#1B5E20",D:"#E65100",E:"#4A148C",F:"#006064",G:"#880E4F",H:"#F57F17",I:"#01579B",J:"#33691E",K:"#37474F",L:"#6A1B9A"};
  const CONF={"Mexico":"CONCACAF","South Korea":"AFC","South Africa":"CAF","Czechia":"UEFA","Canada":"CONCACAF","Bosnia & Herz.":"UEFA","Qatar":"AFC","Switzerland":"UEFA","Brazil":"CONMEBOL","Morocco":"CAF","Haiti":"CONCACAF","Scotland":"UEFA","USA":"CONCACAF","Paraguay":"CONMEBOL","Australia":"AFC","Türkiye":"UEFA","Germany":"UEFA","Curaçao":"CONCACAF","Ivory Coast":"CAF","Ecuador":"CONMEBOL","Netherlands":"UEFA","Japan":"AFC","Sweden":"UEFA","Tunisia":"CAF","Belgium":"UEFA","Egypt":"CAF","Iran":"AFC","New Zealand":"OFC","Spain":"UEFA","Cape Verde":"CAF","Saudi Arabia":"AFC","Uruguay":"CONMEBOL","France":"UEFA","Senegal":"CAF","Iraq":"AFC","Norway":"UEFA","Argentina":"CONMEBOL","Algeria":"CAF","Austria":"UEFA","Jordan":"AFC","Portugal":"UEFA","DR Congo":"CAF","Uzbekistan":"AFC","Colombia":"CONMEBOL","England":"UEFA","Croatia":"UEFA","Ghana":"CAF","Panama":"CONCACAF"};
  return (
    <div style={S.sec}>
      <h2 style={S.h2}>🌍 Group Stage Draw</h2>
      <p style={{color:"#64748b",fontSize:12,marginBottom:14}}>48 teams · 12 groups · Top 2 + 8 best 3rd-place advance to R32</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10}}>
        {Object.entries(GROUPS).map(([grp,teams])=>(
          <div key={grp} style={{borderRadius:12,overflow:"hidden",boxShadow:"0 4px 20px rgba(0,0,0,.35)",border:"1px solid rgba(255,255,255,0.07)"}}>
            <div style={{background:GC[grp],color:"#fff",fontWeight:900,fontSize:13,padding:"8px 12px",letterSpacing:1}}>GROUP {grp}</div>
            {teams.map((t,i)=>(
              <div key={t} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 12px",background:i%2===0?"rgba(255,255,255,0.04)":"rgba(255,255,255,0.02)",fontSize:13,color:T.text}}>
                <span style={{color:"#475569",fontSize:11,width:14}}>{i+1}</span>
                <span style={{flex:1,fontWeight:600,color:"#e2e8f0"}}>{t}</span>
                <span style={{fontSize:10,color:"#475569",fontWeight:600}}>{CONF[t]||""}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SCHEDULE TAB ─────────────────────────────────────────────────────────────
function ScheduleTab({data,playerTZ}) {
  const [filter,setFilter]=useState("All");
  const tz = playerTZ||"ET";
  const tzLabel = TIMEZONES.find(t=>t.id===tz)?.abbr||"ET";
  const filtered=filter==="All"?MATCHES:MATCHES.filter(m=>m.stage===filter);
  return (
    <div style={S.sec}>
      <h2 style={S.h2}>📅 Full Schedule</h2>
      <p style={{color:"#64748b",fontSize:12,marginBottom:10}}>All 104 matches · Times in <strong>{tzLabel}</strong></p>
      <div style={{display:"flex",gap:5,marginBottom:12,flexWrap:"wrap"}}>
        {["All",...Object.keys(STAGE_COLORS)].map(s=><button key={s} style={{...S.chip,...(filter===s?S.chipActive:{})}} onClick={()=>setFilter(s)}>{s}</button>)}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:5}}>
        {filtered.map(m=>{
          const r=data.matchActuals[m.id];
          const sc=STAGE_COLORS[m.stage]||"#333";
          const locked2=isLocked(m);
          const c=convertToTZ(m.date,m.time,tz);
          const { home, away } = getMatchTeams(m, data);
          const isPlaceholder = m.id >= 73 && (!data?.knockoutTeams?.[m.id]);
          return (
            <div key={m.id} style={{background:T.bgCard,borderRadius:10,padding:"10px 12px",border:"1px solid rgba(255,255,255,0.06)",display:"flex",gap:8,alignItems:"center"}}>
              <div style={{background:sc,color:"#fff",borderRadius:6,padding:"3px 7px",fontSize:11,fontWeight:700,minWidth:26,textAlign:"center"}}>{m.id}</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:13,color:isPlaceholder?T.textMute:T.text}}>
                  {home} <span style={{color:T.textMute,opacity:.6}}>vs</span> {away}
                  {isPlaceholder&&<span style={{fontSize:10,color:T.textMute,marginLeft:6}}>(TBD)</span>}
                </div>
                <div style={{fontSize:11,color:"#64748b",marginBottom:1}}>{c.date} · {c.time} · {m.city}{c.dayShift!==0&&<span style={{color:"#E65100"}}> ⚠️ date shifted</span>}</div>
                {r&&<div style={{fontSize:11,color:"#22c55e",fontWeight:700,marginTop:2}}>{r.score} · {r.winner}</div>}
              </div>
              <div style={{fontSize:10,color:locked2?"#aaa":"#4CAF50",fontWeight:700}}>{locked2?"🔒":"⏳"}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── RULES TAB ────────────────────────────────────────────────────────────────
function RulesTab() {
  const [open,setOpen]=useState(0);
  const sections=[
    {icon:"🎯",title:"Overview",color:"#22c55e",body:<>
      <p style={S.rp}>A points-based prediction competition across all 104 matches of FIFA World Cup 2026 (Jun 11 – Jul 19). Three scoring categories:</p>
      {[["🔮","Tournament Predictions","Pick Winner, Runner-Up, 3rd, Golden Boot, Ball & Glove before kick-off"],["⚽","Match Predictions","Predict the score of each match before it kicks off"],["👥","Group Qualifiers","Predict which 2 teams advance from each of 12 groups"]].map(([ic,t,d])=>(
        <div key={t} style={S.ri}><span style={{fontSize:20}}>{ic}</span><div><strong>{t}</strong><br/><span style={{fontSize:12,color:"#94a3b8"}}>{d}</span></div></div>
      ))}
    </>},
    {icon:"🏆",title:"Tournament Prediction Points",color:"#E65100",body:<>
      <p style={S.rp}>Enter before <strong>Jun 11, 3:00 PM ET</strong>. Worth the most points.</p>
      {[["🏆","Winner","20 pts","#FFD700"],["🥈","Runner-Up","12 pts","#C0C0C0"],["🥉","3rd Place","8 pts","#CD7F32"],["⚽","Golden Boot","15 pts","#1B5E20"],["🎖","Golden Ball","15 pts","#4A148C"],["🧤","Golden Glove","12 pts","#01579B"]].map(([ic,t,p,c])=>(
        <div key={t} style={{display:"flex",alignItems:"center",gap:10,padding:"8px",background:"rgba(255,255,255,0.04)",borderRadius:8,marginBottom:6}}>
          <span style={{fontSize:18}}>{ic}</span><span style={{flex:1,fontWeight:700}}>{t}</span>
          <span style={{background:c,color:"#fff",borderRadius:20,padding:"2px 10px",fontWeight:800,fontSize:12}}>{p}</span>
        </div>
      ))}
    </>},
    {icon:"⚽",title:"Match Prediction Points",color:"#60a5fa",body:<>
      <p style={S.rp}>Predict the exact scoreline for any of the 104 matches. Locks at kickoff.</p>
      {[["🎯","Exact Score","Predict precise final score e.g. 2-1","8 pts","#1B5E20"],["✅","Correct Result","Right W/D/L but wrong score","3 pts","#01579B"],["❌","Wrong","Neither correct","0 pts","#aaa"]].map(([ic,t,d,p,c])=>(
        <div key={t} style={{display:"flex",alignItems:"center",gap:10,padding:"8px",background:"rgba(255,255,255,0.04)",borderRadius:8,marginBottom:6}}>
          <span style={{fontSize:18}}>{ic}</span><div style={{flex:1}}><strong>{t}</strong><br/><span style={{fontSize:12,color:"#94a3b8"}}>{d}</span></div>
          <span style={{background:c,color:"#fff",borderRadius:20,padding:"2px 10px",fontWeight:800,fontSize:12}}>{p}</span>
        </div>
      ))}
      <div style={{background:"#E3F2FD",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#60a5fa",marginTop:6}}>💡 Exact score (8pts) replaces correct result (3pts) — max 8pts per match.</div>
    </>},
    {icon:"👥",title:"Group Qualifier Points",color:"#c084fc",body:<>
      <p style={S.rp}>Predict 2 teams that advance from each of 12 groups = 24 predictions per player. <strong>2 pts each</strong>, max 48 pts. Admin marks YES/NO after Jun 27.</p>
    </>},
    {icon:"📉",title:"Prediction Changes & Deductions",color:"#B71C1C",body:<>
      <p style={S.rp}>Tournament predictions can be changed after Jun 11 but with a point penalty:</p>
      {DEDUCTIONS.map(d=>(
        <div key={d.stage} style={{display:"flex",justifyContent:"space-between",padding:"7px 10px",background:"rgba(255,255,255,0.04)",borderRadius:8,marginBottom:4,fontSize:13,color:"#cbd5e1"}}>
          <span style={{fontWeight:600,color:"#e2e8f0"}}>{d.stage}</span>
          <span style={{color:d.pts===0?"#22c55e":"#ef4444",fontWeight:800}}>{d.label}</span>
        </div>
      ))}
      <div style={{background:"rgba(249,115,22,0.08)",border:"1px solid rgba(249,115,22,0.2)",borderRadius:8,padding:"8px 12px",fontSize:12,marginTop:8,color:"#fdba74",marginBottom:6}}>
        ⚠️ <strong>Group Qualifier Penalties</strong> — changing qualifier picks after a group's matches start also costs points. Groups lock individually as their matchday begins.
      </div>
      {QUAL_PENALTY_TIERS.map((t,i)=>(
        <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 10px",background:"rgba(255,255,255,0.02)",borderRadius:8,marginBottom:3,fontSize:12,color:T.textDim}}>
          <span>{t.label}</span>
          <span style={{color:t.pts===0?"#22c55e":"#f97316",fontWeight:700}}>{t.pts===0?"Free":"−"+t.pts+" pts"}</span>
        </div>
      ))}
    </>},
    {icon:"🏆",title:"Knockout Stage Bonus Points",color:"#01579B",body:<>
      <p style={S.rp}>Match predictions are worth more as the tournament progresses — knockout rounds carry higher stakes!</p>
      <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:10}}>
        {Object.entries(STAGE_POINTS).map(([stage,pts])=>(
          <div key={stage} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:"rgba(255,255,255,0.03)",borderRadius:8,border:`1px solid ${STAGE_COLORS[stage]||"#333"}30`}}>
            <div style={{width:10,height:10,borderRadius:"50%",background:STAGE_COLORS[stage]||"#333",flexShrink:0}}/>
            <span style={{flex:1,fontWeight:700,color:T.text,fontSize:13}}>{stage}</span>
            <span style={{color:"#60a5fa",fontWeight:700,fontSize:12}}>✅ {pts.correct} pts</span>
            <span style={{color:T.textMute,fontSize:11}}>·</span>
            <span style={{color:T.gold,fontWeight:700,fontSize:12}}>🎯 {pts.exact} pts</span>
          </div>
        ))}
      </div>
      <div style={{background:"rgba(1,87,155,0.1)",border:"1px solid rgba(1,87,155,0.3)",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#90CAF9"}}>
        💡 Upset bonuses stack on top — a correct Final prediction for a major underdog could be worth <strong>18 + 50 = 68 pts!</strong>
      </div>
    </>},
    {icon:"⚡",title:"Upset Bonus Points",color:"#ef4444",body:<>
      <p style={S.rp}>When a <strong style={{color:T.text}}>lower-ranked team wins</strong>, players who correctly predicted that upset earn bonus points on top of the normal match points. Applies to match predictions only — not tournament prizes.</p>
      <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:10}}>
        {UPSET_TIERS.map((tier,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 10px",background:"rgba(255,255,255,0.03)",borderRadius:8,border:`1px solid ${tier.color}25`}}>
            <div style={{width:10,height:10,borderRadius:"50%",background:tier.color,flexShrink:0}}/>
            <span style={{flex:1,fontSize:12,color:T.textDim}}>
              Rank gap {i===0?"0–5":i===1?"6–10":i===2?"11–15":i===3?"16–25":i===4?"26–50":i===5?"51–75":i===6?"76–100":"100+"}
            </span>
            <span style={{fontWeight:800,color:tier.color,fontSize:13}}>{tier.bonus===0?"No bonus":"+"+tier.bonus+" pts"}</span>
          </div>
        ))}
      </div>
      <div style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#fca5a5"}}>
        ⚡ Example: If you predict a rank #80 team to beat a rank #5 team (gap = 75), and they win, you get <strong>8 pts exact/3 pts result + 25 bonus pts!</strong><br/>
        Ranking badges (🔴 Top 10 · 🟠 Top 25 · 🟡 Top 50 · ⚫ Others) are shown on each match card.
      </div>
    </>},
    {icon:"🤝",title:"Tiebreakers",color:"#33691E",body:<>
      <p style={S.rp}>If total points are tied at the end:</p>
      {["1. Most exact scores (8-pt)","2. Most correct results (3-pt)","3. Most correct tournament predictions","4. Most correct group qualifier picks","5. Coin flip / admin's call 🙂"].map((t,i)=>(
        <div key={i} style={{padding:"6px 10px",background:"rgba(255,255,255,0.04)",borderRadius:8,marginBottom:4,fontSize:13,color:"#cbd5e1",fontWeight:i===0?700:400}}>{t}</div>
      ))}
    </>},
    {icon:"📊",title:"Max Points Reference",color:"#006064",body:<>
      {[["🏆 Winner","1×20","20"],["🥈 Runner-Up","1×12","12"],["🥉 3rd Place","1×8","8"],["⚽ Golden Boot","1×15","15"],["🎖 Golden Ball","1×15","15"],["🧤 Golden Glove","1×12","12"],["🎯 Exact Scores","Group 8/KO up to 30","varies"],["✅ Correct Results","Group 3/KO up to 18","varies"],["👥 Qualifiers","24×2","48"]].map(([c,v,mx])=>(
        <div key={c} style={{display:"flex",padding:"6px 10px",background:"rgba(255,255,255,0.04)",borderRadius:8,marginBottom:4,fontSize:13,color:"#cbd5e1"}}>
          <span style={{flex:1,fontWeight:600}}>{c}</span><span style={{color:"#64748b",minWidth:60}}>{v}</span><span style={{fontWeight:800,color:"#22c55e",minWidth:50,textAlign:"right"}}>{mx} pts</span>
        </div>
      ))}
      <div style={{background:"#1A5C2E",color:"#FFD700",borderRadius:8,padding:"10px 12px",fontWeight:800,fontSize:15,textAlign:"center",marginTop:8}}>🏆 Theoretical Max: 962 pts</div>
    </>},
    {icon:"🌍",title:"Timezone Setup",color:"#60a5fa",body:<>
      <p style={S.rp}>All match times are stored in <strong>Eastern Time (ET)</strong> — the host country time zone. You can set your own timezone so all dates and times display correctly for your location.</p>
      <div style={{background:"#E3F2FD",borderRadius:8,padding:"10px 12px",fontSize:13,color:"#60a5fa",marginBottom:10}}>
        💡 <strong>Set your timezone in the 👤 Profile tab.</strong> It takes effect immediately across the whole app — match schedule, upcoming games, and home screen.
      </div>
      <p style={S.rp}>Supported timezones:</p>
      {TIMEZONES.map(t=>(
        <div key={t.id} style={{display:"flex",justifyContent:"space-between",padding:"6px 10px",background:"rgba(255,255,255,0.04)",borderRadius:8,marginBottom:4,fontSize:13,color:"#cbd5e1"}}>
          <span style={{fontWeight:700,minWidth:50,color:"#60a5fa"}}>{t.abbr}</span>
          <span style={{flex:1,color:"#cbd5e1"}}>{t.label.split("—")[1]?.trim()||t.label}</span>
        </div>
      ))}
      <div style={{background:"#FFF3E0",borderRadius:8,padding:"8px 12px",fontSize:12,marginTop:8}}>
        ⚠️ <strong>Date shifts:</strong> Some matches may fall on a different calendar date in your timezone compared to ET. Where this happens, a ⚠️ indicator is shown next to the date. If you don't set a timezone, <strong>ET is used by default</strong>.
      </div>
    </>},
  ];
  return (
    <div style={S.sec}>
      <h2 style={S.h2}>📖 Rules & Regulations</h2>
      <div style={{background:"linear-gradient(135deg,#1a2535,#0d1520)",border:"1px solid rgba(240,192,64,0.15)",borderRadius:14,padding:"16px 20px",marginBottom:16,color:"#fff"}}>
        <div style={{fontWeight:900,fontSize:20,color:"#FFD700",fontFamily:"Georgia,serif"}}>⚽ FIFA WC 2026 Betting Tracker</div>
        <div style={{fontSize:12,color:"#A5D6A7",marginTop:4}}>June 11 – July 19, 2026 · USA, Canada, Mexico</div>
        <div style={{display:"flex",gap:12,marginTop:12,flexWrap:"wrap"}}>
          {[["48","Teams"],["104","Matches"],["950","Max Pts"],["∞","Players"]].map(([n,l])=>(
            <div key={l} style={{background:"rgba(255,255,255,.1)",borderRadius:8,padding:"6px 12px",textAlign:"center"}}>
              <div style={{fontWeight:900,fontSize:20,color:"#FFD700"}}>{n}</div>
              <div style={{fontSize:10,color:"#A5D6A7",textTransform:"uppercase"}}>{l}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {sections.map((s,i)=>(
          <div key={i} style={{borderRadius:12,overflow:"hidden",boxShadow:"0 2px 12px rgba(0,0,0,.25)",border:"1px solid rgba(255,255,255,0.07)"}}>
            <button style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"13px 16px",background:T.bgCard,border:"none",borderLeft:`4px solid ${s.color}`,cursor:"pointer",textAlign:"left"}} onClick={()=>setOpen(open===i?-1:i)}>
              <span style={{fontSize:18}}>{s.icon}</span>
              <span style={{fontWeight:800,fontSize:14,flex:1,color:T.text}}>{s.title}</span>
              <span style={{color:s.color,fontWeight:900,fontSize:18}}>{open===i?"−":"+"}</span>
            </button>
            {open===i&&<div style={{background:T.bgCard2,padding:"14px 16px",borderTop:"1px solid rgba(255,255,255,0.06)"}}>{s.body}</div>}
          </div>
        ))}
      </div>
      <div style={{textAlign:"center",color:"#f0c040",fontWeight:700,fontSize:14,padding:"16px",background:"rgba(240,192,64,0.08)",borderRadius:12,marginTop:12,border:"1px solid rgba(240,192,64,0.2)"}}>
        Good luck — may the best Villa win! 🏆⚽
      </div>
    </div>
  );
}

// ─── ADMIN: RESULTS ───────────────────────────────────────────────────────────
function AdminResults({data,update,toast_}) {
  const [filter,setFilter]=useState("All");
  const [form,setForm]=useState({});
  const [tForm,setTForm]=useState({_winner:data?.matchActuals?._winner||"",_runnerUp:data?.matchActuals?._runnerUp||"",_thirdPlace:data?.matchActuals?._thirdPlace||"",_goldenBoot:data?.matchActuals?._goldenBoot||"",_goldenBall:data?.matchActuals?._goldenBall||"",_goldenGlove:data?.matchActuals?._goldenGlove||""});
  const filtered=filter==="All"?MATCHES:MATCHES.filter(m=>m.stage===filter);
  const [syncing,setSyncing]=useState(false);
  const [syncLog,setSyncLog]=useState(null);

  async function handleSync() {
    setSyncing(true);
    setSyncLog(null);
    try {
      const { newData, summary } = await syncAllResults(data);
      update(() => newData);
      setSyncLog(summary);
      const msg = summary.errors.length > 0
        ? `Sync done with ${summary.errors.length} error(s)`
        : `✅ Synced! ${summary.matchesUpdated} matches, ${summary.qualifiersUpdated} qualifiers updated`;
      toast_(msg, summary.errors.length > 0 ? "error" : "success");
    } catch (e) {
      toast_(`Sync failed: ${e.message}`, "error");
      setSyncLog({ errors: [e.message], matchesUpdated:0, qualifiersUpdated:0 });
    }
    setSyncing(false);
  }

  return (
    <div style={S.sec}>
      <h2 style={S.h2}>⚙️ Enter Results</h2>

      {/* AUTO SYNC CARD */}
      <div style={{...S.card,border:"1px solid rgba(34,197,94,0.3)",background:"rgba(34,197,94,0.05)"}}>
        <div style={{...S.blockTitle,color:"#22c55e"}}>🔄 Auto-Sync from API-Football</div>
        <p style={{fontSize:13,color:"#94a3b8",marginBottom:12,lineHeight:1.6}}>
          Pulls all completed match results, group standings and top scorer automatically from <strong>api-football.com</strong>. Run this after each matchday — takes about 5 seconds.
        </p>
        <div style={{background:"#E8F5E9",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#22c55e",marginBottom:12}}>
          💡 <strong>What gets synced automatically:</strong> All finished match scores · Group qualifier results · Golden Boot (top scorer)<br/>
          📝 <strong>Still manual:</strong> Golden Ball · Golden Glove · Knockout round qualifiers (after R32+)
        </div>
        <button
          style={{...S.btn,background:syncing?"#aaa":"#1B5E20",display:"flex",alignItems:"center",justifyContent:"center",gap:8,fontSize:15}}
          onClick={handleSync}
          disabled={syncing}
        >
          {syncing ? "⏳ Syncing…" : "🔄 Sync Results Now"}
        </button>

        {/* Rankings sync */}
        <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid rgba(255,255,255,0.07)"}}>
          <div style={{fontSize:12,color:T.textDim,marginBottom:6}}>
            🏅 <strong style={{color:T.text}}>FIFA Rankings</strong> — sync once before the tournament to enable upset bonuses on match cards.
            {data.teamRankings&&Object.keys(data.teamRankings).length>0&&
              <span style={{color:T.green,marginLeft:6}}>✅ {Object.keys(data.teamRankings).length} teams loaded</span>}
          </div>
          <button
            style={{...S.btn,background:"rgba(240,192,64,0.12)",color:T.gold,border:"1px solid rgba(240,192,64,0.25)",fontSize:13,padding:"9px 14px",boxShadow:"none"}}
            onClick={async()=>{
              try {
                const r=await fetchFIFARankings();
                update(d=>{d.teamRankings=r;return d;});
                toast_(`✅ ${Object.keys(r).length} team rankings loaded`);
              } catch(e){ toast_("Rankings sync failed: "+e.message,"error"); }
            }}
          >
            🏅 Sync FIFA Rankings
          </button>
        </div>
        {syncLog && (
          <div style={{marginTop:12,fontSize:12}}>
            <div style={{fontWeight:700,color:T.green,marginBottom:6}}>Last sync results:</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:6}}>
              {[
                [`⚽ ${syncLog.matchesUpdated} matches updated`,T.green],
                [`🏟️ ${syncLog.knockoutNamesUpdated||0} knockout slots`,T.textDim],
                [`👥 ${syncLog.qualifiersUpdated} qualifiers`,T.blue],
                ...(syncLog.topScorer?[[`🥾 ${syncLog.topScorer.name} (${syncLog.topScorer.goals}g)`,"#fb923c"]]:[] ),
              ].map(([l,c])=>(
                <span key={l} style={{background:T.bgCard2,borderRadius:6,padding:"2px 8px",color:c,fontWeight:600,border:`1px solid rgba(255,255,255,0.08)`,fontSize:11}}>{l}</span>
              ))}
            </div>
            {/* Show raw API names for debugging name mismatches */}
            {syncLog.rawAPINames?.length > 0 && (
              <details style={{marginBottom:6}}>
                <summary style={{color:T.gold,cursor:"pointer",fontSize:11,fontWeight:700}}>🔍 Debug: Raw API team names ({syncLog.rawAPINames.length} finished matches)</summary>
                <div style={{background:T.bgCard2,borderRadius:6,padding:"8px",marginTop:4,maxHeight:120,overflowY:"auto"}}>
                  {syncLog.rawAPINames.map((n,i)=>(
                    <div key={i} style={{color:T.textDim,fontSize:10,padding:"1px 0"}}>{n}</div>
                  ))}
                </div>
              </details>
            )}
            {syncLog.errors?.length > 0 && syncLog.errors.map((e,i)=>(
              <div key={i} style={{color:"#ef4444",background:"rgba(239,68,68,0.1)",borderRadius:6,padding:"4px 8px",marginBottom:3,fontSize:11}}>⚠️ {e}</div>
            ))}
          </div>
        )}
      </div>
      <div style={S.card}>
        <div style={S.blockTitle}>🏅 Tournament Awards</div>
        {[{k:"_winner",l:"🏆 Winner"},{k:"_runnerUp",l:"🥈 Runner-Up"},{k:"_thirdPlace",l:"🥉 3rd Place"},{k:"_goldenBoot",l:"⚽ Golden Boot"},{k:"_goldenBall",l:"🎖 Golden Ball"},{k:"_goldenGlove",l:"🧤 Golden Glove"}].map(f=>{
          const isText = f.k==="_goldenBoot"||f.k==="_goldenBall"||f.k==="_goldenGlove";
          return (
          <div key={f.k} style={{marginBottom:10}}>
            <label style={S.lbl}>{f.l}</label>
            {isText ? (
              <input style={S.inp} placeholder="Type player name (e.g. Messi, Mbappé…)" value={tForm[f.k]} onChange={e=>setTForm(v=>({...v,[f.k]:e.target.value}))}/>
            ) : (
              <select style={S.sel} value={tForm[f.k]} onChange={e=>setTForm(v=>({...v,[f.k]:e.target.value}))}>
                <option value="">— Select —</option>
                {ALL_TEAMS.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            )}
          </div>
        )})}
        <button style={S.btn} onClick={()=>{update(d=>{Object.assign(d.matchActuals,tForm);return d;});toast_("Awards saved ✅");}}>Save Awards</button>
      </div>
      <div style={S.card}>
        <div style={S.blockTitle}>⚽ Match Scores</div>
        <div style={{display:"flex",gap:5,marginBottom:12,flexWrap:"wrap"}}>
          {["All",...Object.keys(STAGE_COLORS)].map(s=><button key={s} style={{...S.chip,...(filter===s?S.chipActive:{})}} onClick={()=>setFilter(s)}>{s}</button>)}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {filtered.map(m=>{
            const ex=data.matchActuals[m.id];
            const f=form[m.id]||{score:ex?.score||"",winner:ex?.winner||""};
            const sc=STAGE_COLORS[m.stage]||"#333";
            return (
              <div key={m.id} style={{background:T.bgCard2,borderRadius:10,padding:"10px 12px",border:`1px solid ${ex?"#A5D6A7":"#eee"}`}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                  <div style={{background:sc,color:"#fff",borderRadius:5,padding:"2px 7px",fontSize:10,fontWeight:700}}>#{m.id}</div>
                  <span style={{fontWeight:700,fontSize:13}}>{m.home} vs {m.away}</span>
                  <span style={{fontSize:11,color:"#64748b",marginLeft:"auto"}}>{fmtDate(m.date)}</span>
                </div>
                <TimeBadges time={m.time}/>
                <div style={{display:"flex",gap:8,alignItems:"flex-end",flexWrap:"wrap"}}>
                  <div><label style={S.lbl}>Score</label><input style={{...S.inp,width:70,textAlign:"center"}} placeholder="2-1" value={f.score} onChange={e=>setForm(v=>({...v,[m.id]:{...f,score:e.target.value}}))}/></div>
                  <div><label style={S.lbl}>Winner</label><input style={{...S.inp,width:120}} placeholder="Team / Draw" value={f.winner} onChange={e=>setForm(v=>({...v,[m.id]:{...f,winner:e.target.value}}))}/></div>
                  <button style={{...S.btn,padding:"8px 14px",fontSize:12,width:"auto"}} onClick={()=>{if(!f.score){toast_("Enter score first","error");return;}update(d=>{d.matchActuals[m.id]={score:f.score,winner:f.winner};return d;});toast_(`Match ${m.id} saved ✅`);}}>
                    {ex?"Update":"Save"}
                  </button>
                </div>
                {ex&&<div style={{fontSize:11,color:"#22c55e",marginTop:4,fontWeight:600}}>✅ {ex.score} · {ex.winner}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── PLAYER PROFILE (change password) ────────────────────────────────────────
function PlayerProfile({player,data,update,toast_}) {
  const [form,setForm]=useState({current:"",next:"",confirm:""});
  const [err,setErr]=useState("");
  const passwords = data?.playerPasswords||{};
  const currentTZ = getPlayerTZ(data,player);

  function changePassword() {
    setErr("");
    const isAdminOverride = form.current===ADMIN_PASSWORD||(data?.adminPassword&&form.current===data.adminPassword);
    if (!isAdminOverride && form.current !== passwords[player]) {
      setErr("Current password is incorrect."); return;
    }
    if (form.next.length < 4) { setErr("New password must be at least 4 characters."); return; }
    if (form.next !== form.confirm) { setErr("New passwords don't match."); return; }
    update(d=>{ d.playerPasswords=d.playerPasswords||{}; d.playerPasswords[player]=form.next; return d; });
    setForm({current:"",next:"",confirm:""});
    toast_("Password updated ✅");
  }

  function saveTZ(tzId) {
    update(d=>{ d.playerTimezones=d.playerTimezones||{}; d.playerTimezones[player]=tzId; return d; });
    toast_(`Timezone set to ${tzId} ✅`);
  }

  return (
    <div style={S.sec}>
      <h2 style={S.h2}>👤 My Profile</h2>

      {/* Account info */}
      <div style={S.card}>
        <div style={S.blockTitle}>Account</div>
        <div style={{display:"flex",alignItems:"center",gap:12,padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.05)",marginBottom:16}}>
          <div style={{width:44,height:44,borderRadius:"50%",background:playerColor(player),display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:900,fontSize:18}}>
            {player[0]?.toUpperCase()}
          </div>
          <div>
            <div style={{fontWeight:800,fontSize:16,color:"#f1f5f9"}}>{player}</div>
            <div style={{fontSize:12,color:"#64748b"}}>Player account · {TIMEZONES.find(t=>t.id===currentTZ)?.abbr||"ET"}</div>
          </div>
        </div>

        {/* Timezone selector */}
        <div style={S.blockTitle}>🌍 My Timezone</div>
        <p style={{fontSize:13,color:"#94a3b8",marginBottom:10,lineHeight:1.6}}>
          Choose your timezone. All match dates and times will be shown in your local time throughout the app.
        </p>
        <select style={{...S.sel,marginBottom:8}} value={currentTZ} onChange={e=>saveTZ(e.target.value)}>
          {TIMEZONES.map(t=>(
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
        {/* Preview current time for a known match */}
        {(()=>{
          const sample = MATCHES[0];
          const c = convertToTZ(sample.date, sample.time, currentTZ);
          return (
            <div style={{background:"#E8F5E9",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#22c55e"}}>
              ✅ Preview: Match #1 (Mexico vs South Africa) → <strong>{c.date} at {c.time}</strong>
              {c.dayShift!==0&&<span style={{color:"#E65100"}}> ⚠️ date differs from ET</span>}
            </div>
          );
        })()}
      </div>

      {/* Change password */}
      <div style={S.card}>
        <div style={S.blockTitle}>🔑 Change Password</div>
        <p style={{fontSize:13,color:"#94a3b8",marginBottom:12,lineHeight:1.6}}>
          You can also use the <strong>admin password</strong> as your current password if you've forgotten yours.
        </p>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <div>
            <label style={S.lbl}>Current Password</label>
            <input style={S.inp} type="password" placeholder="Current password" value={form.current}
              onChange={e=>{setForm(v=>({...v,current:e.target.value}));setErr("");}}/>
          </div>
          <div>
            <label style={S.lbl}>New Password</label>
            <input style={S.inp} type="password" placeholder="Min 4 characters" value={form.next}
              onChange={e=>{setForm(v=>({...v,next:e.target.value}));setErr("");}}/>
          </div>
          <div>
            <label style={S.lbl}>Confirm New Password</label>
            <input style={S.inp} type="password" placeholder="Repeat new password" value={form.confirm}
              onChange={e=>{setForm(v=>({...v,confirm:e.target.value}));setErr("");}}
              onKeyDown={e=>e.key==="Enter"&&changePassword()}/>
          </div>
          {err&&<div style={{background:"#FFEBEE",borderRadius:8,padding:"8px 12px",color:"#C62828",fontSize:13}}>{err}</div>}
          <button style={{...S.btn,background:"#01579B"}} onClick={changePassword}>🔑 Update Password</button>
        </div>
      </div>
    </div>
  );
}

// ─── PLAYER: QUALIFIERS ───────────────────────────────────────────────────────
function PlayerQualifiers({player,data,update,toast_}) {
  const tournamentStarted = new Date() >= new Date("2026-06-11T19:00:00Z");
  const GC={A:"#B71C1C",B:"#1A237E",C:"#1B5E20",D:"#E65100",E:"#4A148C",F:"#006064",G:"#880E4F",H:"#F57F17",I:"#01579B",J:"#33691E",K:"#37474F",L:"#6A1B9A"};

  const getT=(grp,slot)=>data.groupQualifiers[`${player}_${grp}_${slot}`]?.team||"";
  const getQ=(grp,slot)=>data.groupQualifiers[`${player}_${grp}_${slot}`]?.qualified??null;
  const qualPenalty = getQualPenalty();

  function setTeam(grp,slot,team){
    const grpLocked = isGroupLocked(grp);
    const penalty = grpLocked ? qualPenalty.pts : 0;
    if(grpLocked && penalty>0){
      if(!window.confirm(`Changing Group ${grp} pick after matches started costs ${penalty} pts. Continue?`)) return;
    }
    update(d=>{
      const key=`${player}_${grp}_${slot}`;
      const prev = d.groupQualifiers[key]?.team;
      d.groupQualifiers[key]={...d.groupQualifiers[key],team};
      // Apply deduction if changing after group started
      if(grpLocked && penalty>0 && prev && prev!==team){
        d.deductions[player]=(d.deductions[player]||0)+penalty;
        d.changeLog.push({date:new Date().toISOString().slice(0,10),player,what:`Group ${grp} qualifier changed`,stage:qualPenalty.label,deduction:penalty});
      }
      return d;
    });
  }

  // Countdown for qualifier lock — uses Countdown component directly

  // Count how many picks made and points earned so far
  const totalPicks = Object.keys(GROUPS).reduce((sum,grp)=>{
    return sum + [0,1].filter(s=>getT(grp,s)).length;
  },0);
  const maxPicks = Object.keys(GROUPS).length * 2; // 24
  const ptsSoFar = Object.keys(GROUPS).reduce((sum,grp)=>{
    return sum + [0,1].filter(s=>getQ(grp,s)===true).length * 2;
  },0);

  return (
    <div style={S.sec}>
      <h2 style={S.h2}>👥 Group Qualifier Predictions</h2>
      {/* Stats bar */}
      <div style={{display:"flex",gap:8,marginBottom:12,background:T.bgCard,borderRadius:12,padding:12,border:"1px solid rgba(255,255,255,0.07)"}}>
        {[["👥 Picks Made",`${totalPicks}/${maxPicks}`],["✅ Pts Earned",ptsSoFar],["💰 Max Possible",maxPicks*2]].map(([l,v])=>(
          <div key={l} style={{flex:1,textAlign:"center"}}>
            <div style={{fontWeight:900,fontSize:18,color:T.gold}}>{v}</div>
            <div style={{fontSize:10,color:T.textDim}}>{l}</div>
          </div>
        ))}
      </div>

      {!tournamentStarted && <Countdown etDate="2026-06-11" etTime="15:00" label="Qualifier picks lock at tournament kickoff"/>}
      {tournamentStarted && qualPenalty.pts>0 && (
        <div style={{background:"rgba(249,115,22,0.1)",border:"1px solid rgba(249,115,22,0.3)",borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:13,color:"#fdba74"}}>
          ⚠️ Tournament started — qualifier changes now cost <strong>{qualPenalty.pts} pts</strong> ({qualPenalty.label}).
          Groups with ongoing/completed matches are locked individually.
        </div>
      )}
      {!tournamentStarted && (
        <div style={{background:"rgba(34,197,94,0.08)",border:"1px solid rgba(34,197,94,0.25)",borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:13,color:T.green}}>
          ⏰ Pick <strong>2 teams per group</strong> that you think will advance. Locks per-group as matches kick off. Worth <strong>2 pts each</strong>, max 48 pts.
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:10}}>
        {Object.entries(GROUPS).map(([grp,teams])=>{
          const pick0=getT(grp,0), pick1=getT(grp,1);
          const q0=getQ(grp,0), q1=getQ(grp,1);
          return (
            <div key={grp} style={{background:T.bgCard,borderRadius:12,overflow:"hidden",boxShadow:"0 4px 16px rgba(0,0,0,.3)",border:"1px solid rgba(255,255,255,0.07)"}}>
              <div style={{background:GC[grp],color:"#fff",fontWeight:900,fontSize:13,padding:"8px 12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span>GROUP {grp}</span>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  {isGroupLocked(grp)&&<span style={{fontSize:10,background:"rgba(0,0,0,0.3)",borderRadius:4,padding:"1px 5px"}}>🔒 Locked</span>}
                  {(pick0||pick1) && <span style={{fontSize:11,opacity:.8}}>{[q0,q1].filter(q=>q===true).length * 2} pts</span>}
                </div>
              </div>
              <div style={{padding:"10px 12px",display:"flex",flexDirection:"column",gap:8}}>
                {[0,1].map(slot=>{
                  const pick = slot===0?pick0:pick1;
                  const qual = slot===0?q0:q1;
                  return (
                    <div key={slot}>
                      <div style={{fontSize:10,color:"#64748b",marginBottom:3,fontWeight:700,textTransform:"uppercase",letterSpacing:.5}}>
                        Pick {slot+1}
                      </div>
                      <select
                        style={{...S.sel,
                          borderColor: qual===true?"#22c55e":qual===false?"#ef4444":pick?T.gold:"rgba(255,255,255,0.15)",
                          background: qual===true?"rgba(34,197,94,0.12)":qual===false?"rgba(239,68,68,0.12)":T.bgCard2,
                          color: (isGroupLocked(grp)||tournamentStarted&&!isGroupLocked(grp)===false)?T.text:T.textMute,
                        }}
                        value={pick}
                        disabled={isGroupLocked(grp)}
                        onChange={e=>setTeam(grp,slot,e.target.value)}
                      >
                        <option value="">— Select team —</option>
                        {teams.map(t=><option key={t} value={t}>{t}</option>)}
                      </select>
                      {qual===true && <div style={{fontSize:11,color:T.green,fontWeight:700,marginTop:3}}>✅ Qualified! +2 pts</div>}
                      {qual===false && <div style={{fontSize:11,color:T.red,fontWeight:700,marginTop:3}}>❌ Did not qualify</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── ADMIN: QUALIFIERS ────────────────────────────────────────────────────────
function AdminQualifiers({data,update,toast_}) {
  const players = [...new Set([...Object.keys(data.predictions),...Object.keys(data.deductions),...Object.keys(data.matchPredictions).map(k=>k.split("_").slice(0,-1).join("_"))])].sort();
  const setTeam=(p,grp,slot,team)=>{ update(d=>{d.groupQualifiers[`${p}_${grp}_${slot}`]={...d.groupQualifiers[`${p}_${grp}_${slot}`],team};return d;}); };
  const setQual=(p,grp,slot,val)=>{ update(d=>{d.groupQualifiers[`${p}_${grp}_${slot}`]={...d.groupQualifiers[`${p}_${grp}_${slot}`],qualified:val};return d;}); };
  const getT=(p,grp,slot)=>data.groupQualifiers[`${p}_${grp}_${slot}`]?.team||"";
  const getQ=(p,grp,slot)=>data.groupQualifiers[`${p}_${grp}_${slot}`]?.qualified??null;

  return (
    <div style={S.sec}>
      <h2 style={S.h2}>✅ Group Qualifiers</h2>
      <p style={{color:"#64748b",fontSize:12,marginBottom:12}}>2 pts per correct pick. Mark YES/NO after Jun 27.</p>
      {players.length===0 && (
        <div style={{...S.card,textAlign:"center",color:"#64748b",padding:24}}>
          No players have joined yet. Players will appear here once they log in and enter predictions.
        </div>
      )}
      {Object.entries(GROUPS).map(([grp,teams])=>(
        <div key={grp} style={{...S.card,marginBottom:10}}>
          <div style={S.blockTitle}>Group {grp} — {teams.join(", ")}</div>
          {players.length===0 && <div style={{color:"#475569",fontSize:12,padding:"8px 0"}}>No players yet</div>}
          {players.map(p=>(
            <div key={p} style={{display:"grid",gridTemplateColumns:"80px 1fr 70px 1fr 70px",gap:6,alignItems:"center",padding:"5px 0",borderBottom:"1px solid rgba(255,255,255,0.05)",fontSize:12}}>
              <span style={{fontWeight:700,fontSize:12}}>{p}</span>
              {[0,1].map(slot=>(
                <div key={slot} style={{display:"contents"}}>
                  <select style={{...S.sel,fontSize:11,padding:"4px 6px"}} value={getT(p,grp,slot)} onChange={e=>setTeam(p,grp,slot,e.target.value)}>
                    <option value="">—</option>{teams.map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                  <select style={{...S.sel,fontSize:11,padding:"4px 6px",background:getQ(p,grp,slot)===true?"rgba(34,197,94,0.2)":getQ(p,grp,slot)===false?"rgba(239,68,68,0.2)":T.bgCard2}}
                    value={getQ(p,grp,slot)===null?"":getQ(p,grp,slot)?"YES":"NO"}
                    onChange={e=>setQual(p,grp,slot,e.target.value===""?null:e.target.value==="YES")}>
                    <option value="">—</option><option value="YES">✅ YES</option><option value="NO">❌ NO</option>
                  </select>
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── ADMIN: DEDUCTIONS ────────────────────────────────────────────────────────
function AdminDeductions({data,update,toast_,ranked}) {
  const stageInfo=getCurrentStage();
  const players = ranked.length > 0 ? ranked.map(([n])=>n) : [...new Set([...Object.keys(data.predictions),...Object.keys(data.deductions)])];
  const apply=(p,amt)=>{ update(d=>{d.deductions[p]=(d.deductions[p]||0)+amt;d.changeLog.push({date:new Date().toISOString().slice(0,10),player:p,what:"Deduction",stage:stageInfo.stage,deduction:amt});return d;}); toast_(`−${amt}pts applied to ${p}`); };
  const reset=p=>{ update(d=>{d.deductions[p]=0;return d;}); toast_(`Reset ${p}`); };
  return (
    <div style={S.sec}>
      <h2 style={S.h2}>📉 Deductions</h2>
      <div style={S.card}>
        <div style={S.blockTitle}>Current Stage: <strong>{stageInfo.stage}</strong> · Penalty: <strong style={{color:"#ef5350"}}>{stageInfo.pts}pts</strong></div>
        {players.map(p=>(
          <div key={p} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.05)",flexWrap:"wrap"}}>
            <span style={{fontWeight:700,minWidth:70}}>{p}</span>
            <span style={{color:"#ef5350",fontWeight:700,minWidth:50}}>−{data.deductions[p]||0}pts</span>
            <button style={{...S.btn,background:"#E65100",padding:"6px 12px",fontSize:12,width:"auto"}} onClick={()=>apply(p,stageInfo.pts)}>−{stageInfo.pts}pts</button>
            <button style={{...S.btn,background:"#37474F",padding:"6px 12px",fontSize:12,width:"auto"}} onClick={()=>reset(p)}>Reset</button>
          </div>
        ))}
      </div>
      <div style={S.card}>
        <div style={S.blockTitle}>📝 Change Log</div>
        {data.changeLog.length===0?<p style={{color:"#475569",fontSize:13}}>No changes yet.</p>:data.changeLog.map((l,i)=>(
          <div key={i} style={{display:"flex",gap:8,padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,0.05)",fontSize:12}}>
            <span style={{color:"#64748b"}}>{l.date}</span>
            <span style={{fontWeight:700}}>{l.player}</span>
            <span style={{flex:1,color:"#94a3b8"}}>{l.what}</span>
            <span style={{color:"#ef5350",fontWeight:700}}>−{l.deduction}pts ({l.stage})</span>
          </div>
        ))}
      </div>
      <div style={S.card}>
        <div style={S.blockTitle}>📉 Deduction Scale</div>
        {DEDUCTIONS.map(d=>(
          <div key={d.stage} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,0.05)",fontSize:13}}>
            <span style={{fontWeight:600,color:"#e2e8f0"}}>{d.stage}</span>
            <span style={{color:d.pts===0?"#1B5E20":"#ef5350",fontWeight:700}}>{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ADMIN: BRACKET ───────────────────────────────────────────────────────────
function AdminBracket({data,update,toast_}) {
  const R32_SLOTS=[
    {id:73,home:"Runner-up A",away:"Runner-up B"},
    {id:74,home:"Winner E",away:"Best 3rd"},
    {id:75,home:"Winner F",away:"Runner-up C"},
    {id:76,home:"Winner C",away:"Runner-up F"},
    {id:77,home:"Winner I",away:"Best 3rd"},
    {id:78,home:"Runner-up E",away:"Runner-up I"},
    {id:79,home:"Winner A",away:"Best 3rd"},
    {id:80,home:"Winner L",away:"Best 3rd"},
    {id:81,home:"Winner D",away:"Best 3rd"},
    {id:82,home:"Winner G",away:"Best 3rd"},
    {id:83,home:"Runner-up K",away:"Runner-up L"},
    {id:84,home:"Winner H",away:"Runner-up J"},
    {id:85,home:"Winner B",away:"Best 3rd"},
    {id:86,home:"Winner J",away:"Runner-up H"},
    {id:87,home:"Winner K",away:"Best 3rd"},
    {id:88,home:"Runner-up D",away:"Runner-up G"},
  ];

  const [form,setForm]=useState(()=>{
    const f={};
    R32_SLOTS.forEach(({id})=>{
      f[`${id}_home`]=data.knockoutTeams?.[id]?.home||"";
      f[`${id}_away`]=data.knockoutTeams?.[id]?.away||"";
    });
    return f;
  });

  function calcStandings(){
    const st={};
    Object.keys(GROUPS).forEach(g=>{
      st[g]={};
      GROUPS[g].forEach(t=>{st[g][t]={pts:0,gd:0,gf:0,ga:0,pl:0};});
    });
    MATCHES.filter(mm=>mm.id<=72&&mm.grp).forEach(mm=>{
      const res=data.matchActuals[mm.id];
      if(!res?.score)return;
      const [hg,ag]=res.score.split("-").map(Number);
      if(isNaN(hg)||isNaN(ag))return;
      const g=mm.grp;
      if(!st[g]?.[mm.home])st[g][mm.home]={pts:0,gd:0,gf:0,ga:0,pl:0};
      if(!st[g]?.[mm.away])st[g][mm.away]={pts:0,gd:0,gf:0,ga:0,pl:0};
      st[g][mm.home].pl++;st[g][mm.away].pl++;
      st[g][mm.home].gf+=hg;st[g][mm.away].gf+=ag;
      st[g][mm.home].ga+=ag;st[g][mm.away].ga+=hg;
      st[g][mm.home].gd+=(hg-ag);st[g][mm.away].gd+=(ag-hg);
      if(hg>ag)st[g][mm.home].pts+=3;
      else if(ag>hg)st[g][mm.away].pts+=3;
      else{st[g][mm.home].pts+=1;st[g][mm.away].pts+=1;}
    });
    return st;
  }

  function getTop2(st,g){
    const sorted=Object.entries(st[g]||{}).sort((a,b)=>b[1].pts-a[1].pts||b[1].gd-a[1].gd||b[1].gf-a[1].gf);
    return[sorted[0]?.[0]||"",sorted[1]?.[0]||""];
  }

  function getBest8Thirds(st,rankings){
    const thirds=[];
    Object.keys(GROUPS).forEach(g=>{
      const sorted=Object.entries(st[g]||{}).sort((a,b)=>b[1].pts-a[1].pts||b[1].gd-a[1].gd||b[1].gf-a[1].gf);
      const third=sorted[2];
      if(third&&third[1].pl>=3){
        thirds.push({team:third[0],group:g,pts:third[1].pts,gd:third[1].gd,gf:third[1].gf,ga:third[1].ga,rank:rankings?.[third[0]]||999});
      }
    });
    thirds.sort((a,b)=>b.pts-a.pts||b.gd-a.gd||b.gf-a.gf||a.ga-b.ga||a.rank-b.rank);
    return thirds.slice(0,8);
  }

  function autoPopulate(){
    const st=calcStandings();
    const rankings=data.teamRankings||{};
    const allDone=Object.keys(GROUPS).every(g=>{
      const total=Object.values(st[g]||{}).reduce((s,t)=>s+t.pl,0)/2;
      return total>=6;
    });
    if(!allDone) toast_("⚠️ Not all groups finished — results may be incomplete","error");
    const best8=getBest8Thirds(st,rankings).map(t=>t.team);
    let b8i=0;
    const newForm={...form};
    R32_SLOTS.forEach(({id,home:hp,away:ap})=>{
      const resolve=p=>{
        if(p.startsWith("Winner ")){const g=p.replace("Winner ","");return getTop2(st,g)[0]||p;}
        if(p.startsWith("Runner-up ")){const g=p.replace("Runner-up ","");return getTop2(st,g)[1]||p;}
        if(p.startsWith("Best 3rd"))return best8[b8i++]||p;
        return p;
      };
      newForm[`${id}_home`]=resolve(hp);
      newForm[`${id}_away`]=resolve(ap);
    });
    setForm(newForm);
    toast_("✅ Bracket auto-populated! Review and click Save.");
  }

  function saveAll(){
    update(d=>{
      R32_SLOTS.forEach(({id})=>{
        const h=form[`${id}_home`]?.trim();
        const a=form[`${id}_away`]?.trim();
        if(h&&a)d.knockoutTeams[id]={home:h,away:a};
      });
      return d;
    });
    toast_("✅ Bracket saved — fixtures updated for all players");
  }

  const st=calcStandings();
  const best8=getBest8Thirds(st,data.teamRankings||{});
  const filled=R32_SLOTS.filter(({id})=>{
    const h=form[`${id}_home`];
    return h&&!h.includes("Winner")&&!h.includes("Runner-up")&&!h.includes("Best 3rd");
  }).length;

  return (
    <div style={S.sec}>
      <h2 style={S.h2}>🏟️ Knockout Bracket</h2>

      {/* Auto-populate card */}
      <div style={{...S.card,border:"1px solid rgba(240,192,64,0.3)",background:"rgba(240,192,64,0.05)"}}>
        <div style={{...S.blockTitle,color:T.gold}}>🤖 Auto-Populate from Group Results</div>
        <p style={{fontSize:13,color:T.textDim,marginBottom:10,lineHeight:1.6}}>
          Fills all 16 R32 slots using current group standings and FIFA tiebreaker rules for best 3rd-placed teams.
          Run <strong style={{color:T.text}}>after all 12 groups have finished</strong> (Jun 27).
        </p>
        <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
          <span style={{background:"rgba(34,197,94,0.1)",borderRadius:8,padding:"5px 10px",fontSize:12,color:T.green,fontWeight:700}}>
            ✅ {filled}/16 slots set
          </span>
          <span style={{background:"rgba(255,255,255,0.05)",borderRadius:8,padding:"5px 10px",fontSize:12,color:T.textDim}}>
            🥉 {best8.length} third-placed teams ranked
          </span>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button style={{...S.btn,flex:1,background:"linear-gradient(135deg,#f0c040,#f9a825)",color:"#111",fontWeight:800}}
            onClick={autoPopulate}>🤖 Auto-Populate</button>
          <button style={{...S.btn,flex:1}} onClick={saveAll}>💾 Save All to Fixtures</button>
        </div>
      </div>

      {/* Best 8 thirds */}
      {best8.length>0&&(
        <div style={S.card}>
          <div style={S.blockTitle}>🥉 Best 8 Third-Placed Teams (FIFA Rules)</div>
          <p style={{fontSize:11,color:T.textMute,marginBottom:10}}>Ranked by: Points → GD → GF → Goals Against → FIFA Ranking</p>
          <div style={{display:"flex",flexDirection:"column",gap:5}}>
            {best8.map((t,i)=>(
              <div key={t.team} style={{display:"flex",alignItems:"center",gap:8,background:T.bgCard2,borderRadius:8,padding:"8px 12px",border:"1px solid rgba(240,192,64,0.15)"}}>
                <span style={{fontWeight:900,color:T.gold,minWidth:24,fontSize:14}}>#{i+1}</span>
                <div style={{flex:1}}>
                  <span style={{fontWeight:700,color:T.text,fontSize:13}}>{t.team}</span>
                  <span style={{color:T.textDim,fontSize:11,marginLeft:8}}>Group {t.group}</span>
                </div>
                <div style={{display:"flex",gap:10,fontSize:11,color:T.textDim}}>
                  <span style={{color:T.gold,fontWeight:700}}>{t.pts}pts</span>
                  <span>GD{t.gd>=0?"+":""}{t.gd}</span>
                  <span>GF{t.gf}</span>
                  <span>GA{t.ga}</span>
                  <span>Rank#{t.rank}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Manual R32 entry */}
      <div style={S.card}>
        <div style={S.blockTitle}>✏️ Manual R32 Slots</div>
        <p style={{fontSize:12,color:T.textDim,marginBottom:10}}>Edit any slot manually. "Save All" pushes to all player fixtures.</p>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {R32_SLOTS.map(({id,home:hp,away:ap})=>{
            const saved=data.knockoutTeams?.[id];
            const isSet=saved?.home&&!saved.home.includes("Winner")&&!saved.home.includes("Runner-up")&&!saved.home.includes("Best 3rd");
            return (
              <div key={id} style={{background:T.bgCard2,borderRadius:10,padding:"10px 12px",border:`1px solid ${isSet?"rgba(34,197,94,0.2)":T.border}`}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                  <div style={{background:STAGE_COLORS["Round of 32"],color:"#fff",borderRadius:5,padding:"2px 7px",fontSize:10,fontWeight:700}}>#{id}</div>
                  <span style={{fontSize:10,color:T.textMute}}>{hp} vs {ap}</span>
                  {isSet&&<span style={{marginLeft:"auto",fontSize:10,color:T.green}}>✅ Set</span>}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 30px 1fr",gap:6,alignItems:"center"}}>
                  <input style={{...S.inp,fontSize:12,padding:"6px 10px"}} placeholder={hp}
                    value={form[`${id}_home`]}
                    onChange={e=>setForm(f=>({...f,[`${id}_home`]:e.target.value}))}/>
                  <span style={{color:T.textMute,textAlign:"center",fontSize:11,fontWeight:700}}>vs</span>
                  <input style={{...S.inp,fontSize:12,padding:"6px 10px"}} placeholder={ap}
                    value={form[`${id}_away`]}
                    onChange={e=>setForm(f=>({...f,[`${id}_away`]:e.target.value}))}/>
                </div>
              </div>
            );
          })}
        </div>
        <button style={{...S.btn,marginTop:12}} onClick={saveAll}>💾 Save All to Fixtures</button>
      </div>
    </div>
  );
}

// ─── ADMIN: SETTINGS (Backup / Restore / Password) ───────────────────────────
function AdminSettings({data,update,toast_}) {
  const [pwForm,setPwForm]=useState({current:"",next:"",confirm:""});
  const [pwError,setPwError]=useState("");
  const [adminPw,setAdminPw]=useState(ADMIN_PASSWORD);
  const [importText,setImportText]=useState("");
  const [importError,setImportError]=useState("");
  const [showConfirmReset,setShowConfirmReset]=useState(false);
  const [confirmDelete,setConfirmDelete]=useState(null); // player name to delete

  // ── Delete player ─────────────────────────────────────────────────────────
  function deletePlayer(name) {
    update(d => {
      // Remove tournament predictions
      delete d.predictions[name];
      // Remove deductions
      delete d.deductions[name];
      // Remove all match predictions for this player
      Object.keys(d.matchPredictions).forEach(k => {
        if (k.startsWith(name + "_")) delete d.matchPredictions[k];
      });
      // Remove all qualifier picks for this player
      Object.keys(d.groupQualifiers).forEach(k => {
        if (k.startsWith(name + "_")) delete d.groupQualifiers[k];
      });
      // Log the deletion
      d.changeLog.push({
        date: new Date().toISOString().slice(0,10),
        player: name,
        what: "Player deleted by admin",
        stage: getCurrentStage().stage,
        deduction: 0,
      });
      return d;
    });
    setConfirmDelete(null);
    toast_(`${name} deleted ✅`);
  }

  // ── Export ────────────────────────────────────────────────────────────────
  function exportBackup() {
    const payload = {
      exportedAt: new Date().toISOString(),
      version: "v2",
      data,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type:"application/json"});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `wc2026_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast_("Backup downloaded ✅");
  }

  // ── Import ────────────────────────────────────────────────────────────────
  function importBackup() {
    setImportError("");
    try {
      const parsed = JSON.parse(importText);
      const restored = parsed.data || parsed; // support both wrapped and raw
      // Basic validation
      if(typeof restored !== "object" || !restored.predictions || !restored.matchActuals) {
        setImportError("Invalid backup file — missing required fields.");
        return;
      }
      if(!window.confirm("⚠️ This will REPLACE all current data with the backup. Are you sure?")) return;
      update(() => restored);
      setImportText("");
      toast_("Data restored from backup ✅");
    } catch(e) {
      setImportError("Could not parse JSON — make sure you pasted the full backup file contents.");
    }
  }

  function handleFileUpload(e) {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ev => setImportText(ev.target.result);
    reader.readAsText(file);
  }

  // ── Password change ───────────────────────────────────────────────────────
  function changePassword() {
    setPwError("");
    if(pwForm.current !== adminPw) { setPwError("Current password is wrong."); return; }
    if(pwForm.next.length < 4)     { setPwError("New password must be at least 4 characters."); return; }
    if(pwForm.next !== pwForm.confirm) { setPwError("New passwords don't match."); return; }
    // Store new password in data so it persists
    update(d => { d.adminPassword = pwForm.next; return d; });
    setAdminPw(pwForm.next);
    setPwForm({current:"",next:"",confirm:""});
    toast_("Password updated ✅");
  }

  // ── Reset all data ────────────────────────────────────────────────────────
  function resetAllData() {
    update(() => initData());
    setShowConfirmReset(false);
    toast_("All data reset 🗑️");
  }

  const statRows = [
    ["👤 Players registered", [...new Set(Object.keys(data.predictions))].length],
    ["⚽ Match predictions entered", Object.keys(data.matchPredictions).length],
    ["📊 Match results logged", Object.keys(data.matchActuals).filter(k=>!k.startsWith("_")).length],
    ["👥 Qualifier picks entered", Object.keys(data.groupQualifiers).length],
    ["📝 Change log entries", data.changeLog.length],
  ];

  return (
    <div style={S.sec}>
      <h2 style={S.h2}>🔧 Admin Settings</h2>

      {/* Data snapshot */}
      <div style={S.card}>
        <div style={S.blockTitle}>📊 Data Snapshot</div>
        {statRows.map(([l,v])=>(
          <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid rgba(255,255,255,0.05)",fontSize:13}}>
            <span style={{color:"#94a3b8"}}>{l}</span>
            <span style={{fontWeight:800,color:"#22c55e"}}>{v}</span>
          </div>
        ))}
      </div>

      {/* Player management */}
      <div style={S.card}>
        <div style={S.blockTitle}>👤 Player Management</div>
        {(() => {
          const players = [...new Set([
            ...Object.keys(data.predictions),
            ...Object.keys(data.matchPredictions).map(k=>k.split("_").slice(0,-1).join("_")),
            ...Object.keys(data.deductions),
          ])].sort();
          if (players.length === 0) return (
            <p style={{color:"#475569",fontSize:13}}>No players have joined yet.</p>
          );
          return players.map(p => {
            const matchCount = Object.keys(data.matchPredictions).filter(k=>k.startsWith(p+"_")).length;
            const hasPreds = !!data.predictions[p]?.winner;
            const qualCount = Object.keys(data.groupQualifiers).filter(k=>k.startsWith(p+"_")).length;
            const isConfirming = confirmDelete === p;
            return (
              <div key={p} style={{padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
                <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                  <div style={{width:10,height:10,borderRadius:"50%",background:playerColor(p),flexShrink:0}}/>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:14,color:"#f1f5f9"}}>{p}</div>
                    <div style={{fontSize:11,color:"#64748b",marginTop:2,display:"flex",gap:10,flexWrap:"wrap"}}>
                      <span>{hasPreds?"✅ Predictions set":"⭕ No predictions"}</span>
                      <span>⚽ {matchCount} match picks</span>
                      <span>👥 {qualCount} qualifier picks</span>
                      {data.deductions[p]>0&&<span style={{color:"#ef5350"}}>📉 -{data.deductions[p]}pts deducted</span>}
                    </div>
                  </div>
                  {!isConfirming && (
                    <div style={{display:"flex",gap:6}}>
                      <button
                        style={{...S.btn,background:"#01579B",padding:"6px 12px",fontSize:12,width:"auto"}}
                        onClick={()=>{ update(d=>{d.playerPasswords=d.playerPasswords||{};delete d.playerPasswords[p];return d;}); toast_(`Password reset for ${p} ✅`); }}
                      >
                        🔑 Reset PW
                      </button>
                      <button
                        style={{...S.btn,background:"#C62828",padding:"6px 14px",fontSize:12,width:"auto"}}
                        onClick={()=>setConfirmDelete(p)}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  )}
                </div>
                {isConfirming && (
                  <div style={{background:"#FFEBEE",borderRadius:10,padding:"10px 12px",marginTop:8}}>
                    <div style={{fontWeight:700,color:"#C62828",fontSize:13,marginBottom:8}}>
                      Delete <strong>{p}</strong>? This removes all their predictions, picks and deductions permanently.
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      <button style={{...S.btn,background:"#C62828",flex:1,padding:"8px"}} onClick={()=>deletePlayer(p)}>
                        Yes, delete
                      </button>
                      <button style={{...S.btn,background:"#37474F",flex:1,padding:"8px"}} onClick={()=>setConfirmDelete(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          });
        })()}
      </div>

      {/* Export */}
      <div style={S.card}>
        <div style={S.blockTitle}>📤 Export Backup</div>
        <p style={{fontSize:13,color:"#94a3b8",marginBottom:12,lineHeight:1.6}}>
          Downloads a <code style={{background:"#f5f5f5",padding:"1px 5px",borderRadius:4,fontSize:12}}>.json</code> file of all app data — predictions, scores, qualifiers, deductions, change log. Save this somewhere safe. If the app ever resets, you can restore from it below.
        </p>
        <div style={{background:"#E8F5E9",borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:12,color:"#22c55e"}}>
          💡 <strong>Recommended:</strong> Export after entering each matchday's results. Takes 2 seconds and is your safety net for the whole tournament.
        </div>
        <button style={{...S.btn,background:"#1B5E20",display:"flex",alignItems:"center",justifyContent:"center",gap:8}} onClick={exportBackup}>
          📥 Download Backup JSON
        </button>
      </div>

      {/* Import */}
      <div style={S.card}>
        <div style={S.blockTitle}>📥 Restore from Backup</div>
        <p style={{fontSize:13,color:"#94a3b8",marginBottom:12,lineHeight:1.6}}>
          Paste the contents of your backup JSON file below, or upload the file directly. This will <strong style={{color:"#C62828"}}>overwrite all current data</strong> — use only to recover after a reset.
        </p>
        <div style={{marginBottom:10}}>
          <label style={S.lbl}>Upload .json file</label>
          <input type="file" accept=".json" onChange={handleFileUpload}
            style={{fontSize:13,padding:"6px 0",color:"#94a3b8",width:"100%"}}/>
        </div>
        <div style={{marginBottom:10}}>
          <label style={S.lbl}>Or paste JSON directly</label>
          <textarea
            style={{width:"100%",border:"2px solid #e0e0e0",borderRadius:10,padding:"10px",fontSize:12,fontFamily:"monospace",outline:"none",minHeight:100,boxSizing:"border-box",resize:"vertical"}}
            placeholder='{"exportedAt":"...","data":{...}}'
            value={importText}
            onChange={e=>{setImportText(e.target.value);setImportError("");}}
          />
        </div>
        {importError && <div style={{background:"#FFEBEE",borderRadius:8,padding:"8px 12px",color:"#C62828",fontSize:13,marginBottom:10}}>❌ {importError}</div>}
        <button
          style={{...S.btn,background:importText.trim()?"#E65100":"#ccc",cursor:importText.trim()?"pointer":"not-allowed"}}
          onClick={importBackup}
          disabled={!importText.trim()}
        >
          🔄 Restore Data from Backup
        </button>
      </div>

      {/* Password change */}
      <div style={S.card}>
        <div style={S.blockTitle}>🔑 Change Admin Password</div>
        <p style={{fontSize:13,color:"#94a3b8",marginBottom:12,lineHeight:1.6}}>
          Update the admin password. The new password takes effect immediately and is saved with the app data. <strong>Write it down somewhere</strong> — there's no recovery option.
        </p>
        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:12}}>
          <div>
            <label style={S.lbl}>Current Password</label>
            <input style={S.inp} type="password" placeholder="Current password" value={pwForm.current}
              onChange={e=>setPwForm(v=>({...v,current:e.target.value}))}/>
          </div>
          <div>
            <label style={S.lbl}>New Password</label>
            <input style={S.inp} type="password" placeholder="New password (min 4 chars)" value={pwForm.next}
              onChange={e=>setPwForm(v=>({...v,next:e.target.value}))}/>
          </div>
          <div>
            <label style={S.lbl}>Confirm New Password</label>
            <input style={S.inp} type="password" placeholder="Repeat new password" value={pwForm.confirm}
              onChange={e=>setPwForm(v=>({...v,confirm:e.target.value}))}/>
          </div>
        </div>
        {pwError && <div style={{background:"#FFEBEE",borderRadius:8,padding:"8px 12px",color:"#C62828",fontSize:13,marginBottom:10}}>❌ {pwError}</div>}
        <button style={{...S.btn,background:"#01579B"}} onClick={changePassword}>🔑 Update Password</button>
        <div style={{marginTop:8,fontSize:11,color:"#475569",textAlign:"center"}}>Default password: <code>admin2026</code> — change this before sharing the app</div>
      </div>

      {/* Danger zone */}
      <div style={{...S.card,border:"2px solid #FFCDD2"}}>
        <div style={{...S.blockTitle,color:"#C62828",borderBottomColor:"#FFCDD2"}}>⚠️ Danger Zone</div>
        <p style={{fontSize:13,color:"#94a3b8",marginBottom:12,lineHeight:1.6}}>
          Wipe all data and start fresh. This is <strong style={{color:"#C62828"}}>permanent and cannot be undone</strong>. Export a backup first if you want to keep the current data.
        </p>
        {!showConfirmReset ? (
          <button style={{...S.btn,background:"#C62828"}} onClick={()=>setShowConfirmReset(true)}>
            🗑️ Reset All Data
          </button>
        ) : (
          <div style={{background:"#FFEBEE",borderRadius:10,padding:14}}>
            <p style={{fontWeight:700,color:"#C62828",fontSize:14,marginBottom:12}}>Are you absolutely sure? All predictions, scores and results will be deleted.</p>
            <div style={{display:"flex",gap:10}}>
              <button style={{...S.btn,background:"#C62828",flex:1}} onClick={resetAllData}>Yes, delete everything</button>
              <button style={{...S.btn,background:"#37474F",flex:1}} onClick={()=>setShowConfirmReset(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ONBOARDING MODAL ────────────────────────────────────────────────────────
function OnboardingModal({player,onClose,onGoTo,tournamentStarted}) {
  const [step,setStep]=useState(0);

  const steps=[
    {
      icon:"🏆",
      title:"Welcome to WC 2026!",
      subtitle:`Hey ${player}! Before you start, here's what you need to do.`,
      color:T.gold,
      body:(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {[
            ["🔮","Tournament Predictions","Pick Winner, Runner-Up, 3rd Place, Golden Boot, Ball & Glove — worth the most points!","predictions"],
            ["👥","Group Qualifiers","Pick 2 teams to advance from each of 12 groups — 24 picks, 2 pts each","qualifiers"],
            ["⚽","Match Predictions","Predict scores for each match before kickoff — enter them as you go","matches"],
          ].map(([ic,t,d,tab])=>(
            <div key={t} style={{display:"flex",gap:12,alignItems:"flex-start",background:T.bgCard2,borderRadius:10,padding:"10px 12px",border:"1px solid rgba(255,255,255,0.07)"}}>
              <span style={{fontSize:22,flexShrink:0}}>{ic}</span>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,color:T.text,fontSize:14}}>{t}</div>
                <div style={{fontSize:12,color:T.textDim,marginTop:2}}>{d}</div>
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      icon:"🔮",
      title:"Step 1 — Tournament Predictions",
      subtitle:"These are your biggest point earners. Enter them NOW before Jun 11!",
      color:"#f0c040",
      body:(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {[
            ["🏆","Tournament Winner","20 pts — the big one"],
            ["🥈","Runner-Up","12 pts"],
            ["🥉","3rd Place","8 pts"],
            ["⚽","Golden Boot","15 pts — top scorer"],
            ["🎖","Golden Ball","15 pts — best player"],
            ["🧤","Golden Glove","12 pts — best goalkeeper"],
          ].map(([ic,t,d])=>(
            <div key={t} style={{display:"flex",alignItems:"center",gap:10,background:T.bgCard2,borderRadius:8,padding:"8px 12px"}}>
              <span style={{fontSize:16}}>{ic}</span>
              <span style={{flex:1,fontWeight:600,color:T.text,fontSize:13}}>{t}</span>
              <span style={{fontSize:11,color:T.gold,fontWeight:700}}>{d}</span>
            </div>
          ))}
          {!tournamentStarted&&(
            <div style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#fca5a5",marginTop:4}}>
              ⚠️ These lock on <strong>Jun 11 at 3:00 PM ET</strong>. Changes after that cost points!
            </div>
          )}
        </div>
      ),
      action:{label:"Go to Predictions →",tab:"predictions"},
    },
    {
      icon:"👥",
      title:"Step 2 — Group Qualifiers",
      subtitle:"Pick 2 teams to advance from each of the 12 groups.",
      color:T.green,
      body:(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <div style={{background:T.bgCard2,borderRadius:10,padding:"12px 14px",fontSize:13,color:T.textDim,lineHeight:1.7}}>
            There are <strong style={{color:T.text}}>12 groups (A–L)</strong>, each with 4 teams. The top 2 from each group advance. You pick which 2 you think will go through — <strong style={{color:T.gold}}>2 pts per correct pick</strong>, up to <strong style={{color:T.gold}}>48 pts total</strong>.
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
            {["A","B","C","D","E","F","G","H","I","J","K","L"].map(g=>(
              <div key={g} style={{background:T.bgCard2,borderRadius:8,padding:"6px 10px",fontSize:12,color:T.textDim,textAlign:"center"}}>
                Group {g} · {GROUPS[g]?.length||4} teams
              </div>
            ))}
          </div>
          {!tournamentStarted&&(
            <div style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#fca5a5"}}>
              ⚠️ Also locks on <strong>Jun 11</strong> — do this before the tournament starts!
            </div>
          )}
        </div>
      ),
      action:{label:"Go to Group Qualifiers →",tab:"qualifiers"},
    },
    {
      icon:"🌍",
      title:"Step 3 — Set Your Timezone",
      subtitle:"All match times will show in your local time across the whole app.",
      color:T.blue,
      body:(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <div style={{background:T.bgCard2,borderRadius:10,padding:"12px 14px",fontSize:13,color:T.textDim,lineHeight:1.7}}>
            The app defaults to <strong style={{color:T.text}}>Eastern Time (ET)</strong>. If you're in the UK, India, UAE or anywhere else, set your timezone so match dates and times show correctly for you — especially for late-night games that cross midnight.
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {[["🇮🇳","IST","India — +9.5h from ET"],["🇬🇧","BST","UK Summer — +5h from ET"],["🇩🇪🇫🇷","CEST","Central Europe — +6h from ET"],["🇦🇪","GST","UAE/Gulf — +8h from ET"],["🇸🇬🇲🇾","SGT","Singapore/Malaysia — +12h from ET"]].map(([fl,tz,note])=>(
              <div key={tz} style={{display:"flex",alignItems:"center",gap:8,background:T.bgCard2,borderRadius:8,padding:"7px 10px"}}>
                <span style={{fontSize:16}}>{fl}</span>
                <span style={{fontWeight:700,color:T.text,minWidth:40}}>{tz}</span>
                <span style={{fontSize:11,color:T.textDim}}>{note}</span>
              </div>
            ))}
          </div>
        </div>
      ),
      action:{label:"Go to Profile → Timezone →",tab:"profile"},
    },
    {
      icon:"✅",
      title:"You're all set!",
      subtitle:"One last thing — enter match predictions before each kickoff.",
      color:T.green,
      body:(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <div style={{background:T.bgCard2,borderRadius:10,padding:"12px 14px",fontSize:13,color:T.textDim,lineHeight:1.7}}>
            For each match predict the exact score — <strong style={{color:T.gold}}>8 pts</strong> for exact, <strong style={{color:T.gold}}>3 pts</strong> for correct result. Predictions lock at kickoff. And watch for <strong style={{color:"#ef4444"}}>⚡ upset bonuses</strong> — predicting a lower-ranked team to win earns you extra points!
          </div>
          <div style={{background:"rgba(34,197,94,0.08)",border:"1px solid rgba(34,197,94,0.2)",borderRadius:10,padding:"12px 14px",fontSize:13,color:T.green,lineHeight:1.7}}>
            🏆 <strong>Good luck!</strong> May the best Villa win! 🟣<br/>
            <span style={{fontSize:11,color:T.textDim}}>Check the 📖 Rules tab anytime for the full scoring guide.</span>
          </div>
        </div>
      ),
      action:{label:"Start Predicting →",tab:"predictions"},
    },
  ];

  const cur = steps[step];
  const isLast = step===steps.length-1;

  return (
    <div style={{
      position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",
      display:"flex",alignItems:"center",justifyContent:"center",
      zIndex:9998,padding:16,
    }}>
      <div style={{
        background:T.bgCard,borderRadius:20,padding:"28px 24px",
        maxWidth:440,width:"100%",
        border:`1px solid ${cur.color}40`,
        boxShadow:`0 0 60px ${cur.color}20, 0 24px 60px rgba(0,0,0,0.6)`,
        maxHeight:"90vh",overflowY:"auto",
      }}>
        {/* Progress dots */}
        <div style={{display:"flex",justifyContent:"center",gap:6,marginBottom:20}}>
          {steps.map((_,i)=>(
            <div key={i} style={{
              width:i===step?20:6,height:6,borderRadius:999,
              background:i===step?cur.color:T.bgCard2,
              transition:"all .2s",
            }}/>
          ))}
        </div>

        {/* Icon + title */}
        <div style={{textAlign:"center",marginBottom:16}}>
          <div style={{fontSize:44,lineHeight:1,marginBottom:8}}>{cur.icon}</div>
          <div style={{fontWeight:900,fontSize:18,color:T.text,marginBottom:4}}>{cur.title}</div>
          <div style={{fontSize:13,color:T.textDim,lineHeight:1.5}}>{cur.subtitle}</div>
        </div>

        {/* Body */}
        <div style={{marginBottom:20}}>{cur.body}</div>

        {/* Actions */}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {cur.action&&(
            <button
              style={{...S.btn,background:`linear-gradient(135deg,${cur.color},${cur.color}bb)`,color:"#111",fontWeight:800}}
              onClick={()=>onGoTo(cur.action.tab)}
            >
              {cur.action.label}
            </button>
          )}
          <div style={{display:"flex",gap:8}}>
            {step>0&&(
              <button style={{...S.btn,background:T.bgCard2,color:T.textDim,flex:1}} onClick={()=>setStep(s=>s-1)}>
                ← Back
              </button>
            )}
            {isLast?(
              <button style={{...S.btn,background:T.bgCard2,color:T.textDim,flex:1}} onClick={onClose}>
                Close
              </button>
            ):(
              <button style={{...S.btn,background:T.bgCard2,color:T.textDim,flex:1}} onClick={()=>setStep(s=>s+1)}>
                Next →
              </button>
            )}
          </div>
          <button style={{background:"none",border:"none",color:T.textMute,fontSize:12,cursor:"pointer",padding:4}} onClick={onClose}>
            Skip intro
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ALL PICKS TAB ────────────────────────────────────────────────────────────
function AllPicksTab({ranked, data, player, groupStageOver}) {
  const players = ranked.map(([n]) => n);
  const actuals = data.matchActuals || {};
  const medals = ["🥇","🥈","🥉"];

  const PRED_FIELDS = [
    { key:"winner",     label:"🏆 Winner",      pts:20, actualKey:"_winner"     },
    { key:"runnerUp",   label:"🥈 Runner-Up",    pts:12, actualKey:"_runnerUp"   },
    { key:"thirdPlace", label:"🥉 3rd Place",    pts:8,  actualKey:"_thirdPlace" },
    { key:"goldenBoot", label:"⚽ Golden Boot",  pts:15, actualKey:"_goldenBoot" },
    { key:"goldenBall", label:"🎖 Golden Ball",  pts:15, actualKey:"_goldenBall" },
    { key:"goldenGlove",label:"🧤 Golden Glove", pts:12, actualKey:"_goldenGlove"},
  ];

  if (players.length === 0) {
    return (
      <div style={S.sec}>
        <h2 style={S.h2}>👁 All Picks</h2>
        <div style={{...S.card, textAlign:"center", color:T.textMute, padding:32}}>
          No players have entered predictions yet.
        </div>
      </div>
    );
  }

  // ── Qualifier picks section ─────────────────────────────────────────────────
  const QualifierPicks = () => {
    const GC={A:"#B71C1C",B:"#1A237E",C:"#1B5E20",D:"#E65100",E:"#4A148C",F:"#006064",G:"#880E4F",H:"#F57F17",I:"#01579B",J:"#33691E",K:"#37474F",L:"#6A1B9A"};
    return (
      <div style={{...S.card, marginTop:16}}>
        <div style={S.blockTitle}>👥 Group Qualifier Picks (all players)</div>
        <p style={{fontSize:12,color:T.textDim,marginBottom:14}}>
          Each player's 2 picks per group. 🟢 = qualified · 🔴 = eliminated · ⬜ = result pending
        </p>
        {Object.entries(GROUPS).map(([grp, teams])=>{
          // Check if any results are known for this group
          const anyResult = players.some(p=>{
            const q0 = data.groupQualifiers[`${p}_${grp}_0`]?.qualified;
            const q1 = data.groupQualifiers[`${p}_${grp}_1`]?.qualified;
            return q0!==null&&q0!==undefined || q1!==null&&q1!==undefined;
          });

          return (
            <div key={grp} style={{marginBottom:10,borderRadius:10,overflow:"hidden",border:"1px solid rgba(255,255,255,0.06)"}}>
              {/* Group header */}
              <div style={{background:GC[grp],padding:"6px 12px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <span style={{color:"#fff",fontWeight:800,fontSize:12,letterSpacing:1}}>GROUP {grp}</span>
                <span style={{color:"rgba(255,255,255,0.7)",fontSize:11}}>{teams.join(" · ")}</span>
              </div>
              {/* Players grid */}
              <div style={{display:"grid",gridTemplateColumns:`120px repeat(${players.length},1fr)`,background:T.bgCard2}}>
                {/* Column headers */}
                <div style={{padding:"6px 10px",fontSize:10,color:T.textMute,fontWeight:700,borderBottom:"1px solid rgba(255,255,255,0.06)"}}>Pick</div>
                {players.map((p,i)=>(
                  <div key={p} style={{padding:"6px 6px",fontSize:10,fontWeight:800,color:p===player?T.gold:T.textDim,textAlign:"center",borderBottom:"1px solid rgba(255,255,255,0.06)",borderLeft:"1px solid rgba(255,255,255,0.04)"}}>
                    {medals[i]||`#${i+1}`} {p}
                  </div>
                ))}
                {/* Pick 1 row */}
                {["Pick 1","Pick 2"].map((label,slot)=>(
                  <>
                    <div key={label} style={{padding:"7px 10px",fontSize:11,color:T.textMute,borderBottom:slot===0?"1px solid rgba(255,255,255,0.04)":"none",display:"flex",alignItems:"center"}}>
                      {label}
                    </div>
                    {players.map(p=>{
                      const key=`${p}_${grp}_${slot}`;
                      const q=data.groupQualifiers[key];
                      const team=q?.team||"";
                      const qualified=q?.qualified;
                      return (
                        <div key={p} style={{
                          padding:"7px 6px",textAlign:"center",fontSize:11,fontWeight:600,
                          background: qualified===true?"rgba(34,197,94,0.1)":qualified===false?"rgba(239,68,68,0.08)":"transparent",
                          borderLeft:"1px solid rgba(255,255,255,0.04)",
                          borderBottom:slot===0?"1px solid rgba(255,255,255,0.04)":"none",
                          color: qualified===true?T.green:qualified===false?"#ef4444":T.text,
                        }}>
                          {team?(
                            <>
                              <div style={{fontSize:11}}>{team}</div>
                              <div style={{fontSize:9,marginTop:2}}>
                                {qualified===true?"✅ +2pts":qualified===false?"❌ 0pts":"⏳"}
                              </div>
                            </>
                          ):<span style={{color:T.textMute}}>—</span>}
                        </div>
                      );
                    })}
                  </>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={S.sec}>
      <h2 style={S.h2}>👁 All Tournament Picks</h2>
      <p style={{color:T.textDim, fontSize:13, marginBottom:16}}>
        Live view of everyone's tournament predictions. Updates immediately when anyone changes their picks.
        {actuals._winner && <span style={{color:T.green, marginLeft:6}}>✅ Actuals confirmed</span>}
      </p>

      {/* Tournament predictions table */}
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%", borderCollapse:"separate", borderSpacing:"0 0"}}>
          <thead>
            <tr>
              <th style={{...thStyle, textAlign:"left", minWidth:100}}>Prediction</th>
              {players.map((p, i) => (
                <th key={p} style={{...thStyle, minWidth:110}}>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                    <div style={{fontSize:16}}>{medals[i] || `#${i+1}`}</div>
                    <div style={{fontWeight:800, color:p===player?T.gold:T.text, fontSize:12}}>{p}</div>
                    {p===player && <div style={{background:"rgba(240,192,64,0.2)",color:T.gold,borderRadius:4,padding:"1px 6px",fontSize:9,fontWeight:700}}>YOU</div>}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PRED_FIELDS.map((f,fi) => {
              const actual = actuals[f.actualKey];
              const picks = players.map(p => data.predictions[p]?.[f.key] || "");
              const pickCounts = {};
              picks.forEach(pk => { if(pk) pickCounts[pk] = (pickCounts[pk]||0)+1; });
              const topPick = Object.entries(pickCounts).sort((a,b)=>b[1]-a[1])[0]?.[0];
              const isLastRow = fi === PRED_FIELDS.length - 1;

              return (
                <tr key={f.key}>
                  <td style={{...tdStyle, textAlign:"left", paddingLeft:12, borderBottom: isLastRow?"none":"1px solid rgba(255,255,255,0.04)"}}>
                    <div style={{fontWeight:700, fontSize:12, color:T.text}}>{f.label}</div>
                    <div style={{fontSize:10, color:T.textMute}}>{f.pts} pts</div>
                    {actual && <div style={{fontSize:10, color:T.green, fontWeight:700, marginTop:2}}>→ {actual}</div>}
                  </td>
                  {players.map(p => {
                    const pick = data.predictions[p]?.[f.key] || "";
                    const isCorrect = actual && pick && pick === actual;
                    const isWrong   = actual && pick && pick !== actual;
                    const isTop     = !actual && pick && pick === topPick && pickCounts[topPick] > 1;
                    const isMe      = p === player;
                    return (
                      <td key={p} style={{
                        ...tdStyle,
                        background: isCorrect?"rgba(34,197,94,0.12)":isWrong?"rgba(239,68,68,0.08)":isMe?"rgba(240,192,64,0.06)":T.bgCard2,
                        border:`1px solid ${isMe?"rgba(240,192,64,0.2)":"rgba(255,255,255,0.04)"}`,
                        borderBottom: isLastRow?"none":"1px solid rgba(255,255,255,0.04)",
                      }}>
                        {pick ? (
                          <div style={{textAlign:"center"}}>
                            <div style={{fontWeight:700,fontSize:12,color:isCorrect?T.green:isWrong?"#ef4444":T.text}}>{pick}</div>
                            {isCorrect && <div style={{fontSize:9,color:T.green}}>✅ +{f.pts}pts</div>}
                            {isWrong   && <div style={{fontSize:9,color:"#ef4444"}}>❌ 0pts</div>}
                            {isTop&&!actual && <div style={{fontSize:9,color:T.gold}}>👥 popular</div>}
                          </div>
                        ) : (
                          <div style={{textAlign:"center",color:T.textMute,fontSize:11}}>—</div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {/* Deductions row */}
            <tr>
              <td style={{...tdStyle,textAlign:"left",paddingLeft:12,borderTop:"1px solid rgba(255,255,255,0.08)"}}>
                <div style={{fontWeight:700,fontSize:12,color:"#ef4444"}}>📉 Deductions</div>
              </td>
              {players.map(p=>(
                <td key={p} style={{...tdStyle,borderTop:"1px solid rgba(255,255,255,0.08)"}}>
                  <div style={{textAlign:"center",color:(data.deductions[p]||0)>0?"#ef4444":T.textMute,fontWeight:700,fontSize:12}}>
                    {(data.deductions[p]||0)>0?`−${data.deductions[p]}`:"—"}
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Consensus insight */}
      <div style={{...S.card,marginTop:14}}>
        <div style={S.blockTitle}>🤝 Group Consensus</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:8}}>
          {PRED_FIELDS.map(f=>{
            const picks=players.map(p=>data.predictions[p]?.[f.key]||"").filter(Boolean);
            if(!picks.length) return null;
            const counts={};
            picks.forEach(pk=>{counts[pk]=(counts[pk]||0)+1;});
            const sorted=Object.entries(counts).sort((a,b)=>b[1]-a[1]);
            const top=sorted[0];
            const pct=Math.round((top[1]/players.length)*100);
            return (
              <div key={f.key} style={{background:T.bgCard2,borderRadius:10,padding:"10px 12px",border:"1px solid rgba(255,255,255,0.06)"}}>
                <div style={{fontSize:10,color:T.textDim,marginBottom:3}}>{f.label}</div>
                <div style={{fontWeight:800,fontSize:13,color:T.text}}>{top[0]}</div>
                <div style={{marginTop:5,background:"rgba(255,255,255,0.06)",borderRadius:999,height:4,overflow:"hidden"}}>
                  <div style={{width:`${pct}%`,height:"100%",background:T.gold,borderRadius:999}}/>
                </div>
                <div style={{fontSize:10,color:T.textMute,marginTop:3}}>{top[1]}/{players.length} ({pct}%)</div>
                {sorted.length>1&&<div style={{fontSize:10,color:T.textMute}}>2nd: {sorted[1][0]} ({sorted[1][1]})</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Qualifier picks — only after group stage ends */}
      {groupStageOver ? (
        <QualifierPicks/>
      ) : (
        <div style={{...S.card,marginTop:14,textAlign:"center",padding:"24px 16px"}}>
          <div style={{fontSize:24,marginBottom:8}}>⏳</div>
          <div style={{fontWeight:700,color:T.text,marginBottom:4}}>Group Qualifier picks revealed after Jun 27</div>
          <div style={{fontSize:12,color:T.textDim}}>
            Everyone's group qualifier predictions will appear here once the group stage ends on June 27 so nobody can copy each other's picks!
          </div>
        </div>
      )}
    </div>
  );
}

const thStyle = {
  padding:"10px 8px",
  background:T.bgCard,
  color:T.textDim,
  fontSize:11,
  fontWeight:700,
  textTransform:"uppercase",
  letterSpacing:"0.5px",
  textAlign:"center",
  borderBottom:`1px solid rgba(255,255,255,0.08)`,
};
const tdStyle = {
  padding:"10px 8px",
  background:T.bgCard2,
  textAlign:"center",
  borderRadius:0,
  transition:"background .2s",
};

// ─── TOAST ────────────────────────────────────────────────────────────────────
function Toast({toast}) {
  return (
    <div style={{
      position:"fixed",bottom:80,left:"50%",transform:"translateX(-50%)",
      background:toast.type==="error"?"rgba(239,68,68,0.95)":"rgba(34,197,94,0.95)",
      color:"#fff",padding:"12px 22px",borderRadius:12,fontWeight:700,
      fontSize:14,zIndex:9999,boxShadow:"0 4px 20px rgba(0,0,0,.25)",
      whiteSpace:"nowrap",
    }}>{toast.msg}</div>
  );
}