import { loadData, saveData, subscribeToData } from "./firebase.js";
import { useState, useEffect, useCallback, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis } from "recharts";

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
const POINTS = { winner:20,runnerUp:12,thirdPlace:8,goldenBoot:15,goldenBall:15,exactScore:8,correctResult:3,groupQualifier:2 };
const DEDUCTIONS = [
  {stage:"Pre-Tournament",before:"2026-06-11",pts:0,label:"Free"},
  {stage:"Group Stage",before:"2026-06-28",pts:5,label:"−5 pts"},
  {stage:"Round of 32",before:"2026-07-04",pts:8,label:"−8 pts"},
  {stage:"Round of 16",before:"2026-07-09",pts:12,label:"−12 pts"},
  {stage:"Quarterfinal",before:"2026-07-14",pts:18,label:"−18 pts"},
  {stage:"Semifinal",before:"2026-07-19",pts:25,label:"−25 pts"},
  {stage:"Post-Semis",before:"2099-01-01",pts:30,label:"−30 pts"},
];
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
const calcMatchPts = (actual,pred) => { const a=parseScore(actual),p=parseScore(pred); if(!a||!p)return 0; if(a.h===p.h&&a.a===p.a)return POINTS.exactScore; if(getResult(a)===getResult(p))return POINTS.correctResult; return 0; };
const isLocked = m => { const[h,mn]=m.time.split(":").map(Number); return new Date()>=new Date(`${m.date}T${String(h).padStart(2,"0")}:${String(mn).padStart(2,"0")}:00`); };
const getCurrentStage = () => { const now=new Date(); for(const d of DEDUCTIONS){if(now<new Date(d.before))return d;} return DEDUCTIONS[DEDUCTIONS.length-1]; };
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
const fmtDate = d => new Date(d+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",weekday:"short"});
const fmtShort = d => new Date(d+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"});
const playerColor = name => PLAYER_COLORS[FRIENDS.indexOf(name)%PLAYER_COLORS.length] || "#888";

// ─── STORAGE ──────────────────────────────────────────────────────────────────
// Storage handled by Firebase (see firebase.js)
const initData = () => ({ predictions:{}, matchPredictions:{}, matchActuals:{}, groupQualifiers:{}, deductions:{}, changeLog:[], pointsHistory:{}, prizePool:140, playerPasswords:{}, playerTimezones:{} });

// ─── TIME BADGES COMPONENT ────────────────────────────────────────────────────
function TimeBadges({time, inline=false}) {
  const tz = fmtAllTimes(time);
  if (inline) {
    return (
      <span style={{fontSize:11,color:"#888"}}>
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
    MATCHES.forEach(m => {
      const key=`${p}_${m.id}`, predicted=data.matchPredictions[key], actual=data.matchActuals[m.id]?.score;
      if(actual&&predicted){ const pts=calcMatchPts(actual,predicted); matchPts+=pts; if(pts===POINTS.exactScore)exactCount++; else if(pts===POINTS.correctResult)resultCount++; }
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

  // Persist session to localStorage whenever player/isAdmin changes
  useEffect(()=>{ localStorage.setItem("wc2026_player", player); },[player]);
  useEffect(()=>{ localStorage.setItem("wc2026_isAdmin", isAdmin); },[isAdmin]);

  useEffect(()=>{
    loadData().then(d=>{ setData(d||initData()); setLoading(false); });
    const unsub = subscribeToData(remote => {
      setData(prev => {
        // Only update from remote if we're not mid-edit (saves take priority)
        return remote || prev;
      });
    });
    return () => unsub();
  },[]);

  const persist = useCallback(async nd => { setSaving(true); await saveData(nd); setSaving(false); },[]);
  const update = useCallback(fn => { setData(prev => { const next=fn(JSON.parse(JSON.stringify(prev))); persist(next); return next; }); },[persist]);
  const toast_ = (msg,type="success") => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

  if(loading) return <Splash/>;

  const scores = calcScores(data);
  const ranked = Object.entries(scores)
    .filter(([p]) => data.predictions[p] || Object.keys(data.matchPredictions).some(k=>k.startsWith(p+"_")))
    .sort((a,b) => b[1].total - a[1].total);
  const stageInfo = getCurrentStage();

  // Upcoming matches (next 5 not yet kicked off)
  const upcoming = MATCHES.filter(m=>!isLocked(m)).slice(0,5);
  // Recent results (last 5 with actual scores)
  const recentResults = [...MATCHES].reverse().filter(m=>data.matchActuals[m.id]?.score).slice(0,5);

  if(!player&&!isAdmin) return <Login playerInput={playerInput} setPlayerInput={setPlayerInput} adminInput={adminInput} setAdminInput={setAdminInput} setPlayer={setPlayer} setIsAdmin={setIsAdmin} toast_={toast_} toast={toast} data={data} update={update}/>;

  const playerTabs=[
    {id:"home",label:"🏠",tip:"Home"},
    {id:"rules",label:"📖",tip:"Rules"},
    {id:"leaderboard",label:"🏆",tip:"Leaderboard"},
    {id:"dashboard",label:"📊",tip:"Dashboard"},
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
    {id:"admin_results",label:"⚙️",tip:"Results"},
    {id:"admin_qualifiers",label:"✅",tip:"Qualifiers"},
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
    <div style={{fontFamily:"'Trebuchet MS',sans-serif",background:"#F0F4F0",minHeight:"100vh",display:"flex"}}>
      {/* Responsive Nav — sidebar on desktop, bottom on mobile */}
      <Nav tabs={tabs} tab={tab} setTab={setTab} player={player} isAdmin={isAdmin}
        onLogout={onLogout} saving={saving} stageInfo={stageInfo}/>
      {/* Main area */}
      <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>
        {/* Mobile-only top header (desktop has sidebar header) */}
        <MobileOnly>
          <div style={S.header}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:22}}>⚽</span>
              <div>
                <div style={{fontWeight:900,fontSize:14,color:"#FFD700",fontFamily:"Georgia,serif"}}>WC 2026</div>
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
        <div style={{padding:"16px 16px 90px",flex:1,overflowY:"auto"}}>
          <div style={{maxWidth:860,margin:"0 auto"}}>
            {tab==="home"          && <HomeTab ranked={ranked} scores={scores} player={player} upcoming={upcoming} recentResults={recentResults} data={data} isAdmin={isAdmin} stageInfo={stageInfo} playerTZ={playerTZ}/>}
            {tab==="leaderboard"   && <Leaderboard ranked={ranked} scores={scores} player={player} data={data}/>}
            {tab==="dashboard"     && <Dashboard ranked={ranked} scores={scores} player={player} data={data} isAdmin={isAdmin}/>}
            {tab==="predictions"   && !isAdmin && <PredictionsTab player={player} data={data} update={update} toast_={toast_} stageInfo={stageInfo}/>}
            {tab==="matches"       && !isAdmin && <MatchesTab player={player} data={data} update={update} toast_={toast_} matchFilter={matchFilter} setMatchFilter={setMatchFilter} playerTZ={playerTZ}/>}
            {tab==="qualifiers"    && !isAdmin && <PlayerQualifiers player={player} data={data} update={update} toast_={toast_}/>}
            {tab==="profile"       && !isAdmin && <PlayerProfile player={player} data={data} update={update} toast_={toast_}/>}
            {tab==="h2h"           && <H2HTab ranked={ranked} scores={scores} data={data} h2hA={h2hA} setH2hA={setH2hA} h2hB={h2hB} setH2hB={setH2hB}/>}
            {tab==="groups"        && <GroupsTab/>}
            {tab==="schedule"      && <ScheduleTab data={data} playerTZ={playerTZ}/>}
            {tab==="rules"         && <RulesTab/>}
            {tab==="admin_results" && isAdmin && <AdminResults data={data} update={update} toast_={toast_}/>}
            {tab==="admin_qualifiers" && isAdmin && <AdminQualifiers data={data} update={update} toast_={toast_}/>}
            {tab==="admin_deductions" && isAdmin && <AdminDeductions data={data} update={update} toast_={toast_} ranked={ranked}/>}
            {tab==="admin_settings" && isAdmin && <AdminSettings data={data} update={update} toast_={toast_}/>}
          </div>
        </div>
      </div>
      {toast && <Toast toast={toast}/>}
    </div>
  );
}

// ─── SPLASH ───────────────────────────────────────────────────────────────────
function Splash() {
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100vh",background:"linear-gradient(135deg,#1A5C2E,#0D3B1E)"}}>
      <div style={{fontSize:72,marginBottom:16}}>⚽</div>
      <div style={{color:"#FFD700",fontSize:22,fontWeight:900,fontFamily:"Georgia,serif"}}>Loading…</div>
    </div>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function Login({playerInput,setPlayerInput,adminInput,setAdminInput,setPlayer,setIsAdmin,toast_,toast,data,update}) {
  const checkAdminPw = pw => pw===ADMIN_PASSWORD || (data?.adminPassword && pw===data.adminPassword);
  const passwords = data?.playerPasswords || {};

  // Steps: "entry" → "new_password" (first time) → "existing_password" (returning)
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
    if (passwords[name]) {
      setStep("existing_password");
    } else {
      setStep("new_password");
    }
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
    const adminPw = data?.adminPassword || ADMIN_PASSWORD;
    if (pwInput === passwords[name] || checkAdminPw(pwInput)) {
      setPlayer(name);
    } else {
      setErr("Wrong password. Ask admin to reset it if needed.");
    }
  }

  return (
    <div style={S.loginWrap}>
      <div style={S.loginCard}>
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{fontSize:56,lineHeight:1}}>⚽</div>
          <h1 style={{margin:"12px 0 4px",fontSize:30,fontWeight:900,color:"#1A5C2E",fontFamily:"Georgia,serif",lineHeight:1.1}}>
            FIFA World Cup<br/><span style={{color:"#FFD700",fontSize:38}}>2026</span>
          </h1>
          <p style={{margin:0,color:"#888",fontSize:15,fontWeight:600,letterSpacing:2,textTransform:"uppercase"}}>Betting Tracker</p>
        </div>

        <div style={{height:1,background:"#eee",margin:"0 0 20px"}}/>

        {/* ── Step 1: Enter name ── */}
        {step==="entry" && (
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
            <label style={S.lbl}>Your Name</label>
            <input style={S.inp} placeholder="Type your name…" value={nameInput}
              onChange={e=>{setNameInput(e.target.value);setErr("");}}
              onKeyDown={e=>e.key==="Enter"&&nameInput.trim()&&handleNameNext()}/>
            {err&&<div style={{color:"#C62828",fontSize:12}}>{err}</div>}
            <button style={S.btn} onClick={handleNameNext}>Continue →</button>
          </div>
        )}

        {/* ── Step 2a: New player — create password ── */}
        {step==="new_password" && (
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
            <div style={{background:"#E8F5E9",borderRadius:8,padding:"8px 12px",fontSize:13,color:"#1B5E20",marginBottom:4}}>
              👋 Welcome <strong>{nameInput}</strong>! Create a password to secure your account.
            </div>
            <label style={S.lbl}>Create Password</label>
            <input style={S.inp} type="password" placeholder="Min 4 characters" value={pw1}
              onChange={e=>{setPw1(e.target.value);setErr("");}}/>
            <label style={S.lbl}>Confirm Password</label>
            <input style={S.inp} type="password" placeholder="Repeat password" value={pw2}
              onChange={e=>{setPw2(e.target.value);setErr("");}}
              onKeyDown={e=>e.key==="Enter"&&handleNewPassword()}/>
            {err&&<div style={{color:"#C62828",fontSize:12}}>{err}</div>}
            <button style={S.btn} onClick={handleNewPassword}>Create Account →</button>
            <button style={{...S.btn,background:"#888",marginTop:2}} onClick={()=>{setStep("entry");setErr("");}}>← Back</button>
          </div>
        )}

        {/* ── Step 2b: Returning player — enter password ── */}
        {step==="existing_password" && (
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
            <div style={{background:"#E3F2FD",borderRadius:8,padding:"8px 12px",fontSize:13,color:"#01579B",marginBottom:4}}>
              👋 Welcome back <strong>{nameInput}</strong>! Enter your password to continue.
            </div>
            <label style={S.lbl}>Password</label>
            <input style={S.inp} type="password" placeholder="Your password" value={pwInput}
              onChange={e=>{setPwInput(e.target.value);setErr("");}}
              onKeyDown={e=>e.key==="Enter"&&handleExistingPassword()}/>
            {err&&(
              <div style={{background:"#FFEBEE",borderRadius:8,padding:"8px 10px",fontSize:12,color:"#C62828"}}>
                {err}
              </div>
            )}
            <button style={S.btn} onClick={handleExistingPassword}>Log In →</button>
            <button style={{...S.btn,background:"#888",marginTop:2}} onClick={()=>{setStep("entry");setErr("");setPwInput("");}}>← Back</button>
          </div>
        )}

        <div style={{height:1,background:"#eee",margin:"0 0 20px"}}/>

        {/* ── Admin login ── */}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <label style={S.lbl}>Admin Access</label>
          <input style={S.inp} type="password" placeholder="Admin password…" value={adminInput}
            onChange={e=>setAdminInput(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"){if(checkAdminPw(adminInput))setIsAdmin(true);else toast_("Wrong password","error");}}}/>
          <button style={{...S.btn,background:"#E65100"}} onClick={()=>{if(checkAdminPw(adminInput))setIsAdmin(true);else toast_("Wrong password","error");}}>
            Enter as Admin ⚙️
          </button>
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
      width:200,flexShrink:0,background:"#1A5C2E",minHeight:"100vh",
      display:"flex",flexDirection:"column",position:"sticky",top:0,
      boxShadow:"2px 0 12px rgba(0,0,0,.15)",zIndex:90,
    }}>
      {/* Logo */}
      <div style={{padding:"20px 16px 16px",borderBottom:"1px solid rgba(255,255,255,.1)"}}>
        <div style={{fontSize:28,lineHeight:1}}>⚽</div>
        <div style={{fontWeight:900,fontSize:14,color:"#FFD700",fontFamily:"Georgia,serif",marginTop:6}}>WC 2026</div>
        <div style={{fontSize:11,color:"#A5D6A7",marginTop:2}}>{isAdmin?"⚙️ Admin":`👤 ${player}`}</div>
        {saving&&<div style={{fontSize:10,color:"#FFD700",marginTop:2}}>💾 Saving…</div>}
      </div>
      {/* Stage pill */}
      <div style={{padding:"8px 12px",borderBottom:"1px solid rgba(255,255,255,.1)"}}>
        <div style={{background:"rgba(255,255,255,.12)",borderRadius:20,padding:"3px 10px",fontSize:11,color:"#fff",fontWeight:600,textAlign:"center"}}>{stageInfo.stage}</div>
      </div>
      {/* Nav items */}
      <div style={{flex:1,overflowY:"auto",padding:"8px 0"}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            width:"100%",display:"flex",alignItems:"center",gap:10,
            padding:"10px 16px",background:tab===t.id?"rgba(255,255,255,.15)":"none",
            border:"none",borderLeft:tab===t.id?"3px solid #FFD700":"3px solid transparent",
            cursor:"pointer",textAlign:"left",transition:"all .15s",
          }}>
            <span style={{fontSize:16,flexShrink:0}}>{t.label}</span>
            <span style={{fontSize:12,fontWeight:tab===t.id?800:400,color:tab===t.id?"#FFD700":"#A5D6A7",whiteSpace:"nowrap"}}>{t.tip}</span>
          </button>
        ))}
      </div>
      {/* Logout */}
      <div style={{padding:"12px",borderTop:"1px solid rgba(255,255,255,.1)"}}>
        <button style={{...sBtn,background:"rgba(255,255,255,.1)",color:"#fff",fontSize:12,padding:"8px 12px"}} onClick={onLogout}>
          ✕ Log Out
        </button>
      </div>
    </div>
  );

  // Bottom nav (mobile < 768px)
  const bottomNav = (
    <div style={{
      position:"fixed",bottom:0,left:0,right:0,
      background:"#fff",borderTop:"1px solid #e0e0e0",
      display:"flex",justifyContent:"space-around",
      zIndex:99,padding:"4px 0 6px",
      boxShadow:"0 -2px 12px rgba(0,0,0,.08)",
    }}>
      {tabs.map(t=>(
        <button key={t.id} title={t.tip} onClick={()=>setTab(t.id)} style={{
          flex:1,background:"none",border:"none",
          padding:"4px 2px 2px",cursor:"pointer",
          display:"flex",flexDirection:"column",alignItems:"center",gap:1,
          color:tab===t.id?"#1B5E20":"#aaa",
          minWidth:0,maxWidth:64,
        }}>
          <span style={{fontSize:17,lineHeight:1}}>{t.label}</span>
          <span style={{fontSize:8,fontWeight:tab===t.id?800:400,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",width:"100%",textAlign:"center"}}>
            {t.tip}
          </span>
          {tab===t.id&&<div style={{width:16,height:2,background:"#1B5E20",borderRadius:999,marginTop:1}}/>}
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
      <div style={{background:"linear-gradient(135deg,#1A5C2E,#0D3B1E)",borderRadius:16,padding:"20px 20px 16px",marginBottom:16,position:"relative",overflow:"hidden"}}>
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
            <div key={l} style={{background:"rgba(255,255,255,.1)",borderRadius:10,padding:"8px 12px",minWidth:70}}>
              <div style={{color:"#FFD700",fontSize:11,marginBottom:2}}>{ic} {l}</div>
              <div style={{color:"#fff",fontSize:18,fontWeight:900}}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Gap tracker */}
      {!isAdmin && myScore && ranked.length > 1 && (
        <div style={{background:"#fff",borderRadius:14,padding:16,marginBottom:16,boxShadow:"0 2px 8px rgba(0,0,0,.08)"}}>
          <div style={S.blockTitle}>🎯 Can You Still Win?</div>
          {ranked.map(([name,s],i)=>{
            const maxPerMatch = POINTS.exactScore;
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
          <div style={{fontSize:11,color:"#999",marginTop:8}}>Max pts still available from match predictions: {remaining * POINTS.exactScore}</div>
        </div>
      )}

      {/* Match of the Day */}
      {motd && (()=>{
        const converted = convertToTZ(motd.date, motd.time, tz);
        return (
          <div style={{background:"linear-gradient(135deg,#B71C1C,#880E4F)",borderRadius:14,padding:16,marginBottom:16,color:"#fff"}}>
            <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:2,opacity:.7,marginBottom:6}}>⚡ Next Match</div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
              <div style={{fontWeight:900,fontSize:16,flex:1}}>{motd.home}</div>
              <div style={{background:"rgba(255,255,255,.2)",borderRadius:8,padding:"6px 12px",fontWeight:900,fontSize:13}}>VS</div>
              <div style={{fontWeight:900,fontSize:16,flex:1,textAlign:"right"}}>{motd.away}</div>
            </div>
            <div style={{marginTop:8,fontSize:12,opacity:.8}}>📅 {converted.date} · ⏰ {converted.time} · 📍 {motd.city}</div>
            {converted.dayShift!==0&&<div style={{fontSize:10,opacity:.6,marginTop:2}}>⚠️ Date shifted from ET</div>}
            <div style={{marginTop:4,fontSize:11,opacity:.6}}>{motd.venue}</div>
          </div>
        );
      })()}

      {/* Upcoming */}
      {upcoming.length>0 && (
        <div style={{background:"#fff",borderRadius:14,padding:16,marginBottom:16,boxShadow:"0 2px 8px rgba(0,0,0,.08)"}}>
          <div style={S.blockTitle}>📅 Upcoming Matches <span style={{fontSize:11,color:"#888",fontWeight:400}}>({TIMEZONES.find(t=>t.id===tz)?.abbr||"ET"})</span></div>
          {upcoming.slice(0,5).map(m=>{
            const c = convertToTZ(m.date, m.time, tz);
            return (
              <div key={m.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderBottom:"1px solid #f5f5f5"}}>
                <div style={{background:STAGE_COLORS[m.stage]||"#333",color:"#fff",borderRadius:6,padding:"2px 6px",fontSize:10,fontWeight:700,minWidth:24,textAlign:"center"}}>{m.id}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:13}}>{m.home} <span style={{color:"#ccc",fontWeight:400}}>vs</span> {m.away}</div>
                  <div style={{fontSize:11,color:"#888"}}>{c.date} · {c.time}{c.dayShift!==0&&" ⚠️"}</div>
                </div>
                <div style={{fontSize:10,color:"#888",textAlign:"right"}}>{m.city}</div>
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
              <div key={m.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderBottom:"1px solid #f5f5f5"}}>
                <div style={{background:STAGE_COLORS[m.stage]||"#333",color:"#fff",borderRadius:6,padding:"2px 6px",fontSize:10,fontWeight:700}}>{m.id}</div>
                <div style={{flex:1,fontSize:13,fontWeight:600}}>{m.home} <span style={{color:"#1B5E20",fontWeight:900,background:"#E8F5E9",padding:"1px 6px",borderRadius:4}}>{r?.score}</span> {m.away}</div>
                {r?.winner&&<div style={{fontSize:11,color:"#1B5E20",fontWeight:700}}>⚽ {r.winner}</div>}
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
  const pot=data.prizePool||140;
  const payouts=[Math.round(pot*0.6),Math.round(pot*0.3),Math.round(pot*0.1)];
  return (
    <div style={S.sec}>
      <h2 style={S.h2}>🏆 Live Leaderboard</h2>
      {/* Points key */}
      <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:14}}>
        {[["🏆","20"],["🥈","12"],["🥉","8"],["⚽","15"],["🎖","15"],["🎯","8"],["✅","3"],["👥","2"]].map(([l,v])=>(
          <div key={l} style={{background:"#E8F5E9",borderRadius:20,padding:"3px 9px",fontSize:11,border:"1px solid #C8E6C9",display:"flex",gap:4}}><span>{l}</span><strong>{v}pt</strong></div>
        ))}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {ranked.map(([name,s],i)=>{
          const isMe=name===player;
          const payout=i<3?`💰 $${payouts[i]}`:"";
          return (
            <div key={name} style={{background:i===0?"linear-gradient(135deg,#FFF9C4,#FFFDE7)":"#fff",borderRadius:14,padding:"14px 16px",border:`2px solid ${isMe?"#4CAF50":i===0?"#FFD700":"transparent"}`,boxShadow:"0 2px 8px rgba(0,0,0,.07)"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{fontSize:24,width:32,textAlign:"center"}}>{medals[i]||`#${i+1}`}</div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                    <div style={{width:10,height:10,borderRadius:"50%",background:playerColor(name),flexShrink:0}}/>
                    <span style={{fontWeight:900,fontSize:15}}>{name}</span>
                    {isMe&&<span style={{background:"#4CAF50",color:"#fff",borderRadius:10,padding:"1px 7px",fontSize:10,fontWeight:700}}>you</span>}
                    {payout&&<span style={{marginLeft:"auto",fontSize:12,fontWeight:700,color:"#E65100"}}>{payout}</span>}
                  </div>
                  <div style={{display:"flex",gap:8,fontSize:11,color:"#888"}}>
                    <span>🔮 {s.predPts}</span><span>⚽ {s.matchPts}</span><span>👥 {s.qualPts}</span>
                    {s.ded>0&&<span style={{color:"#ef5350"}}>−{s.ded}</span>}
                    <span style={{marginLeft:"auto",fontWeight:700,color:"#555"}}>🎯 {s.exactCount} exact · ✅ {s.resultCount} correct</span>
                  </div>
                </div>
                <div style={{fontWeight:900,fontSize:24,color:"#1A5C2E",minWidth:44,textAlign:"right"}}>{s.total}</div>
              </div>
              {/* progress bar */}
              <div style={{marginTop:8,background:"#f0f0f0",borderRadius:999,height:5,overflow:"hidden"}}>
                <div style={{width:`${ranked.length>0?Math.max(4,Math.round((s.total/Math.max(ranked[0][1].total,1))*100)):0}%`,height:"100%",background:i===0?"#FFD700":playerColor(name),borderRadius:999}}/>
              </div>
            </div>
          );
        })}
      </div>
      <p style={{color:"#999",fontSize:12,marginTop:12,textAlign:"center"}}>Prize pool: ${pot} · 60/30/10% split · Auto-updated live</p>
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
      playedMatches.slice(0,idx+1).forEach(mm=>{
        const key=`${name}_${mm.id}`,pred=data.matchPredictions[key],actual=data.matchActuals[mm.id]?.score;
        if(actual&&pred)cum+=calcMatchPts(actual,pred);
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
                    <span style={{fontSize:12,color:"#888"}}>{d.result}% correct results · {d.exact}% exact</span>
                  </div>
                  <div style={{background:"#e0e0e0",borderRadius:999,height:8,overflow:"hidden",position:"relative"}}>
                    <div style={{width:`${d.result}%`,height:"100%",background:d.color,opacity:.4,borderRadius:999,position:"absolute"}}/>
                    <div style={{width:`${d.exact}%`,height:"100%",background:d.color,borderRadius:999,position:"absolute"}}/>
                  </div>
                  <div style={{display:"flex",gap:12,fontSize:11,color:"#999",marginTop:4}}>
                    <span>🎯 {d.exact}% exact scores</span><span>✅ {d.result}% any correct</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{fontSize:11,color:"#bbb",marginTop:10,textAlign:"center"}}>Dark bar = exact score · Light bar = correct result (W/D/L)</div>
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
                <span style={{minWidth:70,fontWeight:600}}>{d.name}</span>
                <span style={{color:"#FFD700",fontWeight:700,minWidth:50}}>🔮 {d.predPts}</span>
                <span style={{color:"#1B5E20",fontWeight:700,minWidth:50}}>⚽ {d.matchPts}</span>
                <span style={{color:"#01579B",fontWeight:700}}>👥 {d.qualPts}</span>
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

  // Per-match comparison
  const matchComparison=playedMatches.map(m=>{
    const actual=data.matchActuals[m.id]?.score;
    const predAScore=data.matchPredictions[`${h2hA}_${m.id}`];
    const predBScore=data.matchPredictions[`${h2hB}_${m.id}`];
    const ptsA=actual&&predAScore?calcMatchPts(actual,predAScore):0;
    const ptsB=actual&&predBScore?calcMatchPts(actual,predBScore):0;
    return {m,actual,predAScore,predBScore,ptsA,ptsB};
  });
  const matchWinsA=matchComparison.filter(r=>r.ptsA>r.ptsB).length;
  const matchWinsB=matchComparison.filter(r=>r.ptsB>r.ptsA).length;
  const matchDraws=matchComparison.filter(r=>r.ptsA===r.ptsB&&r.ptsA>0).length;

  const predFields=[
    {key:"winner",label:"🏆 Winner",pts:20},{key:"runnerUp",label:"🥈 Runner-Up",pts:12},
    {key:"thirdPlace",label:"🥉 3rd Place",pts:8},{key:"goldenBoot",label:"⚽ Golden Boot",pts:15},
    {key:"goldenBall",label:"🎖 Golden Ball",pts:15},
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
        <div style={{display:"flex",alignItems:"flex-end",padding:"0 4px 8px",fontWeight:900,color:"#888"}}>VS</div>
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
          <div style={{background:"linear-gradient(135deg,#1A5C2E,#0D3B1E)",borderRadius:14,padding:20,marginBottom:14,color:"#fff",textAlign:"center"}}>
            <div style={{display:"flex",justifyContent:"space-around",alignItems:"center"}}>
              <div>
                <div style={{width:12,height:12,borderRadius:"50%",background:playerColor(h2hA),margin:"0 auto 6px"}}/>
                <div style={{fontWeight:900,fontSize:18}}>{h2hA}</div>
                <div style={{fontSize:36,fontWeight:900,color:"#FFD700",margin:"4px 0"}}>{sA.total}</div>
                <div style={{fontSize:11,opacity:.7}}>pts</div>
              </div>
              <div style={{fontSize:22,opacity:.5}}>⚔️</div>
              <div>
                <div style={{width:12,height:12,borderRadius:"50%",background:playerColor(h2hB),margin:"0 auto 6px"}}/>
                <div style={{fontWeight:900,fontSize:18}}>{h2hB}</div>
                <div style={{fontSize:36,fontWeight:900,color:"#FFD700",margin:"4px 0"}}>{sB.total}</div>
                <div style={{fontSize:11,opacity:.7}}>pts</div>
              </div>
            </div>
            <div style={{marginTop:12,fontSize:13,opacity:.8}}>
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
                    <span style={{color:a>=b?playerColor(h2hA):"#999",fontWeight:a>=b?800:400}}>{a}{unit}</span>
                    <span style={{color:"#888"}}>{l}</span>
                    <span style={{color:b>=a?playerColor(h2hB):"#999",fontWeight:b>=a?800:400}}>{b}{unit}</span>
                  </div>
                  <div style={{display:"flex",gap:2,height:8}}>
                    <div style={{flex:1,display:"flex",justifyContent:"flex-end"}}>
                      <div style={{width:`${Math.abs(a)/max*100}%`,background:playerColor(h2hA),borderRadius:"4px 0 0 4px"}}/>
                    </div>
                    <div style={{width:2,background:"#e0e0e0"}}/>
                    <div style={{flex:1}}>
                      <div style={{width:`${Math.abs(b)/max*100}%`,background:playerColor(h2hB),borderRadius:"0 4px 4px 0"}}/>
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
                <div key={f.key} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderBottom:"1px solid #f5f5f5",fontSize:13}}>
                  <span style={{minWidth:20}}>{f.label.split(" ")[0]}</span>
                  <span style={{flex:1,fontWeight:700,color:playerColor(h2hA),textAlign:"right"}}>{va}</span>
                  <span style={{background:match?"#E8F5E9":"#f5f5f5",borderRadius:6,padding:"2px 8px",fontSize:11,color:match?"#1B5E20":"#999",fontWeight:600}}>{match?"🤝 Same":"vs"}</span>
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
                {[[h2hA,matchWinsA,playerColor(h2hA)],["Draws",matchDraws,"#888"],[h2hB,matchWinsB,playerColor(h2hB)]].map(([l,v,c])=>(
                  <div key={l}><div style={{fontSize:28,fontWeight:900,color:c}}>{v}</div><div style={{fontSize:11,color:"#888"}}>{l}</div></div>
                ))}
              </div>
              <div style={{maxHeight:200,overflowY:"auto"}}>
                {matchComparison.slice(0,20).map(({m,actual,predAScore,predBScore,ptsA,ptsB})=>(
                  <div key={m.id} style={{display:"flex",gap:6,padding:"5px 0",borderBottom:"1px solid #f5f5f5",fontSize:11,alignItems:"center"}}>
                    <span style={{color:"#888",minWidth:28}}>#{m.id}</span>
                    <span style={{flex:1,color:ptsA>ptsB?playerColor(h2hA):"#999",fontWeight:ptsA>ptsB?700:400}}>{predAScore||"—"} ({ptsA}pt)</span>
                    <span style={{color:"#1B5E20",fontWeight:700,background:"#E8F5E9",padding:"1px 5px",borderRadius:4}}>{actual}</span>
                    <span style={{flex:1,textAlign:"right",color:ptsB>ptsA?playerColor(h2hB):"#999",fontWeight:ptsB>ptsA?700:400}}>{predBScore||"—"} ({ptsB}pt)</span>
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
  const locked=new Date()>=new Date("2026-06-11T15:00:00");
  const [form,setForm]=useState({winner:pred.winner||"",runnerUp:pred.runnerUp||"",thirdPlace:pred.thirdPlace||"",goldenBoot:pred.goldenBoot||"",goldenBall:pred.goldenBall||""});
  const [changed,setChanged]=useState(false);

  const fields=[
    {key:"winner",label:"🏆 Tournament Winner",pts:20,color:"#FFD700"},
    {key:"runnerUp",label:"🥈 Runner-Up",pts:12,color:"#C0C0C0"},
    {key:"thirdPlace",label:"🥉 3rd Place",pts:8,color:"#CD7F32"},
    {key:"goldenBoot",label:"⚽ Golden Boot",pts:15,color:"#1B5E20"},
    {key:"goldenBall",label:"🎖 Golden Ball",pts:15,color:"#4A148C"},
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
      {locked&&<div style={{background:"#FFF3E0",border:"1px solid #FFB74D",borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:13}}>⚠️ Tournament started. Changes cost <strong>{stageInfo.pts} pts</strong> ({stageInfo.stage}).</div>}
      <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
        {fields.map(f=>{
          const actualKey=`_${f.key}`;
          const actual=data.matchActuals[actualKey];
          const correct=actual&&form[f.key]===actual;
          const isTextInput = f.key==="goldenBoot"||f.key==="goldenBall";
          return (
            <div key={f.key} style={{background:"#fff",borderRadius:14,padding:14,boxShadow:"0 2px 8px rgba(0,0,0,.07)",borderLeft:`4px solid ${f.color}`}}>
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
      {!changed&&pred.winner&&<div style={{color:"#2E7D32",fontWeight:700,fontSize:14,textAlign:"center",padding:8}}>✅ Predictions saved</div>}
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
    return sum+(actual&&pred?calcMatchPts(actual,pred):0);
  },0);
  const exactCount=MATCHES.filter(m=>{ const a=data.matchActuals[m.id]?.score,p=data.matchPredictions[`${player}_${m.id}`]; return a&&p&&calcMatchPts(a,p)===POINTS.exactScore; }).length;

  return (
    <div style={S.sec}>
      <h2 style={S.h2}>⚽ Match Predictions <span style={{fontSize:13,color:"#888",fontWeight:400}}>({tzLabel})</span></h2>
      <div style={{display:"flex",gap:8,marginBottom:12,background:"#fff",borderRadius:12,padding:12,boxShadow:"0 2px 8px rgba(0,0,0,.06)"}}>
        {[["⚽ Total Pts",totalPts],["🎯 Exact Scores",exactCount],["📝 Predicted",MATCHES.filter(m=>data.matchPredictions[`${player}_${m.id}`]).length]].map(([l,v])=>(
          <div key={l} style={{flex:1,textAlign:"center"}}><div style={{fontWeight:900,fontSize:20,color:"#1A5C2E"}}>{v}</div><div style={{fontSize:10,color:"#888"}}>{l}</div></div>
        ))}
      </div>
      <div style={{display:"flex",gap:5,marginBottom:12,flexWrap:"wrap"}}>
        {stages.map(s=><button key={s} style={{...S.chip,...(matchFilter===s?S.chipActive:{})}} onClick={()=>setMatchFilter(s)}>{s}</button>)}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {filtered.map(m=>{
          const locked2=isLocked(m);
          const actual=data.matchActuals[m.id]?.score;
          const pred=data.matchPredictions[`${player}_${m.id}`]||"";
          const pts=actual&&pred?calcMatchPts(actual,pred):null;
          const sc=STAGE_COLORS[m.stage]||"#333";
          const c=convertToTZ(m.date,m.time,tz);
          return (
            <div key={m.id} style={{background:"#fff",borderRadius:12,padding:"12px 14px",boxShadow:"0 1px 4px rgba(0,0,0,.07)"}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:6,marginBottom:6,flexWrap:"wrap"}}>
                <div style={{background:sc,color:"#fff",borderRadius:5,padding:"2px 7px",fontSize:10,fontWeight:700,flexShrink:0}}>{m.stage}</div>
                <div style={{fontSize:11,color:"#888"}}>{c.date} · {c.time} · {m.city}{c.dayShift!==0&&" ⚠️"}</div>
                {locked2&&!actual&&<div style={{marginLeft:"auto",fontSize:10,color:"#aaa"}}>🔒 Locked</div>}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <span style={{fontWeight:800,fontSize:14,flex:1}}>{m.home}</span>
                <span style={{color:"#ccc",fontSize:12}}>vs</span>
                <span style={{fontWeight:800,fontSize:14,flex:1,textAlign:"right"}}>{m.away}</span>
              </div>
              <div style={{display:"flex",gap:10,alignItems:"center"}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:10,color:"#888",marginBottom:3}}>Your prediction</div>
                  <input style={{border:`2px solid ${locked2?"#e0e0e0":"#4CAF50"}`,borderRadius:8,padding:"7px 10px",fontSize:14,fontWeight:700,width:70,textAlign:"center",outline:"none",background:locked2?"#f9f9f9":"#fff",color:locked2?"#aaa":"#000"}}
                    placeholder="2-1" value={pred} readOnly={locked2} onChange={e=>!locked2&&setPred(m.id,e.target.value)}/>
                </div>
                {actual&&(
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:10,color:"#888",marginBottom:3}}>Result</div>
                    <div style={{fontWeight:900,fontSize:16,color:"#1B5E20",background:"#E8F5E9",padding:"4px 10px",borderRadius:8}}>{actual}</div>
                  </div>
                )}
                {pts!==null&&(
                  <div style={{background:pts>0?"#1B5E20":"#f5f5f5",color:pts>0?"#fff":"#aaa",borderRadius:8,padding:"6px 10px",fontWeight:900,fontSize:13,textAlign:"center"}}>
                    {pts>0?`+${pts}`:"-"}<div style={{fontSize:9}}>pts</div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── GROUPS TAB ───────────────────────────────────────────────────────────────
function GroupsTab() {
  const GC={A:"#B71C1C",B:"#1A237E",C:"#1B5E20",D:"#E65100",E:"#4A148C",F:"#006064",G:"#880E4F",H:"#F57F17",I:"#01579B",J:"#33691E",K:"#37474F",L:"#6A1B9A"};
  const CONF={"Mexico":"CONCACAF","South Korea":"AFC","South Africa":"CAF","Czechia":"UEFA","Canada":"CONCACAF","Bosnia & Herz.":"UEFA","Qatar":"AFC","Switzerland":"UEFA","Brazil":"CONMEBOL","Morocco":"CAF","Haiti":"CONCACAF","Scotland":"UEFA","USA":"CONCACAF","Paraguay":"CONMEBOL","Australia":"AFC","Türkiye":"UEFA","Germany":"UEFA","Curaçao":"CONCACAF","Ivory Coast":"CAF","Ecuador":"CONMEBOL","Netherlands":"UEFA","Japan":"AFC","Sweden":"UEFA","Tunisia":"CAF","Belgium":"UEFA","Egypt":"CAF","Iran":"AFC","New Zealand":"OFC","Spain":"UEFA","Cape Verde":"CAF","Saudi Arabia":"AFC","Uruguay":"CONMEBOL","France":"UEFA","Senegal":"CAF","Iraq":"AFC","Norway":"UEFA","Argentina":"CONMEBOL","Algeria":"CAF","Austria":"UEFA","Jordan":"AFC","Portugal":"UEFA","DR Congo":"CAF","Uzbekistan":"AFC","Colombia":"CONMEBOL","England":"UEFA","Croatia":"UEFA","Ghana":"CAF","Panama":"CONCACAF"};
  return (
    <div style={S.sec}>
      <h2 style={S.h2}>🌍 Group Stage Draw</h2>
      <p style={{color:"#888",fontSize:12,marginBottom:14}}>48 teams · 12 groups · Top 2 + 8 best 3rd-place advance to R32</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10}}>
        {Object.entries(GROUPS).map(([grp,teams])=>(
          <div key={grp} style={{borderRadius:12,overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,.1)"}}>
            <div style={{background:GC[grp],color:"#fff",fontWeight:900,fontSize:13,padding:"8px 12px",letterSpacing:1}}>GROUP {grp}</div>
            {teams.map((t,i)=>(
              <div key={t} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 12px",background:i%2===0?"#F1F8E9":"#fff",fontSize:13}}>
                <span style={{color:"#aaa",fontSize:11,width:14}}>{i+1}</span>
                <span style={{flex:1,fontWeight:600}}>{t}</span>
                <span style={{fontSize:10,color:"#aaa",fontWeight:600}}>{CONF[t]||""}</span>
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
      <p style={{color:"#888",fontSize:12,marginBottom:10}}>All 104 matches · Times in <strong>{tzLabel}</strong></p>
      <div style={{display:"flex",gap:5,marginBottom:12,flexWrap:"wrap"}}>
        {["All",...Object.keys(STAGE_COLORS)].map(s=><button key={s} style={{...S.chip,...(filter===s?S.chipActive:{})}} onClick={()=>setFilter(s)}>{s}</button>)}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:5}}>
        {filtered.map(m=>{
          const r=data.matchActuals[m.id];
          const sc=STAGE_COLORS[m.stage]||"#333";
          const locked2=isLocked(m);
          const c=convertToTZ(m.date,m.time,tz);
          return (
            <div key={m.id} style={{background:"#fff",borderRadius:10,padding:"10px 12px",boxShadow:"0 1px 3px rgba(0,0,0,.06)",display:"flex",gap:8,alignItems:"center"}}>
              <div style={{background:sc,color:"#fff",borderRadius:6,padding:"3px 7px",fontSize:11,fontWeight:700,minWidth:26,textAlign:"center"}}>{m.id}</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:13}}>{m.home} <span style={{opacity:.4}}>vs</span> {m.away}</div>
                <div style={{fontSize:11,color:"#888",marginBottom:1}}>{c.date} · {c.time} · {m.city}{c.dayShift!==0&&<span style={{color:"#E65100"}}> ⚠️ date shifted</span>}</div>
                {r&&<div style={{fontSize:11,color:"#1B5E20",fontWeight:700,marginTop:2}}>{r.score} · {r.winner}</div>}
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
    {icon:"🎯",title:"Overview",color:"#1B5E20",body:<>
      <p style={S.rp}>A points-based prediction competition across all 104 matches of FIFA World Cup 2026 (Jun 11 – Jul 19). Three scoring categories:</p>
      {[["🔮","Tournament Predictions","Pick Winner, Runner-Up, 3rd, Golden Boot & Ball before kick-off"],["⚽","Match Predictions","Predict the score of each match before it kicks off"],["👥","Group Qualifiers","Predict which 2 teams advance from each of 12 groups"]].map(([ic,t,d])=>(
        <div key={t} style={S.ri}><span style={{fontSize:20}}>{ic}</span><div><strong>{t}</strong><br/><span style={{fontSize:12,color:"#666"}}>{d}</span></div></div>
      ))}
    </>},
    {icon:"🏆",title:"Tournament Prediction Points",color:"#E65100",body:<>
      <p style={S.rp}>Enter before <strong>Jun 11, 3:00 PM ET</strong>. Worth the most points.</p>
      {[["🏆","Winner","20 pts","#FFD700"],["🥈","Runner-Up","12 pts","#C0C0C0"],["🥉","3rd Place","8 pts","#CD7F32"],["⚽","Golden Boot","15 pts","#1B5E20"],["🎖","Golden Ball","15 pts","#4A148C"]].map(([ic,t,p,c])=>(
        <div key={t} style={{display:"flex",alignItems:"center",gap:10,padding:"8px",background:"#fafafa",borderRadius:8,marginBottom:6}}>
          <span style={{fontSize:18}}>{ic}</span><span style={{flex:1,fontWeight:700}}>{t}</span>
          <span style={{background:c,color:"#fff",borderRadius:20,padding:"2px 10px",fontWeight:800,fontSize:12}}>{p}</span>
        </div>
      ))}
    </>},
    {icon:"⚽",title:"Match Prediction Points",color:"#01579B",body:<>
      <p style={S.rp}>Predict the exact scoreline for any of the 104 matches. Locks at kickoff.</p>
      {[["🎯","Exact Score","Predict precise final score e.g. 2-1","8 pts","#1B5E20"],["✅","Correct Result","Right W/D/L but wrong score","3 pts","#01579B"],["❌","Wrong","Neither correct","0 pts","#aaa"]].map(([ic,t,d,p,c])=>(
        <div key={t} style={{display:"flex",alignItems:"center",gap:10,padding:"8px",background:"#fafafa",borderRadius:8,marginBottom:6}}>
          <span style={{fontSize:18}}>{ic}</span><div style={{flex:1}}><strong>{t}</strong><br/><span style={{fontSize:12,color:"#666"}}>{d}</span></div>
          <span style={{background:c,color:"#fff",borderRadius:20,padding:"2px 10px",fontWeight:800,fontSize:12}}>{p}</span>
        </div>
      ))}
      <div style={{background:"#E3F2FD",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#01579B",marginTop:6}}>💡 Exact score (8pts) replaces correct result (3pts) — max 8pts per match.</div>
    </>},
    {icon:"👥",title:"Group Qualifier Points",color:"#4A148C",body:<>
      <p style={S.rp}>Predict 2 teams that advance from each of 12 groups = 24 predictions per player. <strong>2 pts each</strong>, max 48 pts. Admin marks YES/NO after Jun 27.</p>
    </>},
    {icon:"📉",title:"Prediction Changes & Deductions",color:"#B71C1C",body:<>
      <p style={S.rp}>Tournament predictions can be changed after Jun 11 but with a point penalty:</p>
      {DEDUCTIONS.map(d=>(
        <div key={d.stage} style={{display:"flex",justifyContent:"space-between",padding:"7px 10px",background:"#fafafa",borderRadius:8,marginBottom:4,fontSize:13}}>
          <span style={{fontWeight:600}}>{d.stage}</span>
          <span style={{color:d.pts===0?"#1B5E20":"#C62828",fontWeight:800}}>{d.label}</span>
        </div>
      ))}
      <div style={{background:"#FFF3E0",borderRadius:8,padding:"8px 12px",fontSize:12,marginTop:6}}>⚠️ Deduction applied per change event, logged by admin. Change freely before tournament starts.</div>
    </>},
    {icon:"🤝",title:"Tiebreakers",color:"#33691E",body:<>
      <p style={S.rp}>If total points are tied at the end:</p>
      {["1. Most exact scores (8-pt)","2. Most correct results (3-pt)","3. Most correct tournament predictions","4. Most correct group qualifier picks","5. Coin flip / admin's call 🙂"].map((t,i)=>(
        <div key={i} style={{padding:"6px 10px",background:"#fafafa",borderRadius:8,marginBottom:4,fontSize:13,fontWeight:i===0?700:400}}>{t}</div>
      ))}
    </>},
    {icon:"📊",title:"Max Points Reference",color:"#006064",body:<>
      {[["🏆 Winner","1×20","20"],["🥈 Runner-Up","1×12","12"],["🥉 3rd Place","1×8","8"],["⚽ Golden Boot","1×15","15"],["🎖 Golden Ball","1×15","15"],["🎯 Exact Scores","104×8","832"],["✅ Correct Results","104×3","312"],["👥 Qualifiers","24×2","48"]].map(([c,v,m])=>(
        <div key={c} style={{display:"flex",padding:"6px 10px",background:"#fafafa",borderRadius:8,marginBottom:4,fontSize:13}}>
          <span style={{flex:1,fontWeight:600}}>{c}</span><span style={{color:"#888",minWidth:60}}>{v}</span><span style={{fontWeight:800,color:"#1B5E20",minWidth:50,textAlign:"right"}}>{m} pts</span>
        </div>
      ))}
      <div style={{background:"#1A5C2E",color:"#FFD700",borderRadius:8,padding:"10px 12px",fontWeight:900,fontSize:15,textAlign:"center",marginTop:8}}>🏆 Theoretical Max: 950 pts</div>
    </>},
    {icon:"🌍",title:"Timezone Setup",color:"#01579B",body:<>
      <p style={S.rp}>All match times are stored in <strong>Eastern Time (ET)</strong> — the host country time zone. You can set your own timezone so all dates and times display correctly for your location.</p>
      <div style={{background:"#E3F2FD",borderRadius:8,padding:"10px 12px",fontSize:13,color:"#01579B",marginBottom:10}}>
        💡 <strong>Set your timezone in the 👤 Profile tab.</strong> It takes effect immediately across the whole app — match schedule, upcoming games, and home screen.
      </div>
      <p style={S.rp}>Supported timezones:</p>
      {TIMEZONES.map(t=>(
        <div key={t.id} style={{display:"flex",justifyContent:"space-between",padding:"6px 10px",background:"#fafafa",borderRadius:8,marginBottom:4,fontSize:13}}>
          <span style={{fontWeight:700,minWidth:50,color:"#01579B"}}>{t.abbr}</span>
          <span style={{flex:1,color:"#333"}}>{t.label.split("—")[1]?.trim()||t.label}</span>
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
      <div style={{background:"linear-gradient(135deg,#1A5C2E,#0D3B1E)",borderRadius:14,padding:"16px 20px",marginBottom:16,color:"#fff"}}>
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
          <div key={i} style={{borderRadius:12,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,.08)"}}>
            <button style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"13px 16px",background:"#fff",border:"none",borderLeft:`4px solid ${s.color}`,cursor:"pointer",textAlign:"left"}} onClick={()=>setOpen(open===i?-1:i)}>
              <span style={{fontSize:18}}>{s.icon}</span>
              <span style={{fontWeight:800,fontSize:14,flex:1,color:"#1a1a1a"}}>{s.title}</span>
              <span style={{color:s.color,fontWeight:900,fontSize:18}}>{open===i?"−":"+"}</span>
            </button>
            {open===i&&<div style={{background:"#fafafa",padding:"14px 16px",borderTop:"1px solid #eee"}}>{s.body}</div>}
          </div>
        ))}
      </div>
      <div style={{textAlign:"center",color:"#1A5C2E",fontWeight:700,fontSize:14,padding:"16px",background:"#E8F5E9",borderRadius:12,marginTop:12,border:"2px solid #A5D6A7"}}>
        Good luck — may the best Villa win! 🏆⚽
      </div>
    </div>
  );
}

// ─── ADMIN: RESULTS ───────────────────────────────────────────────────────────
function AdminResults({data,update,toast_}) {
  const [filter,setFilter]=useState("All");
  const [form,setForm]=useState({});
  const [tForm,setTForm]=useState({_winner:data.matchActuals._winner||"",_runnerUp:data.matchActuals._runnerUp||"",_thirdPlace:data.matchActuals._thirdPlace||"",_goldenBoot:data.matchActuals._goldenBoot||"",_goldenBall:data.matchActuals._goldenBall||""});
  const filtered=filter==="All"?MATCHES:MATCHES.filter(m=>m.stage===filter);

  return (
    <div style={S.sec}>
      <h2 style={S.h2}>⚙️ Enter Results</h2>
      <div style={S.card}>
        <div style={S.blockTitle}>🏅 Tournament Awards</div>
        {[{k:"_winner",l:"🏆 Winner"},{k:"_runnerUp",l:"🥈 Runner-Up"},{k:"_thirdPlace",l:"🥉 3rd Place"},{k:"_goldenBoot",l:"⚽ Golden Boot"},{k:"_goldenBall",l:"🎖 Golden Ball"}].map(f=>{
          const isText = f.k==="_goldenBoot"||f.k==="_goldenBall";
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
              <div key={m.id} style={{background:"#fafafa",borderRadius:10,padding:"10px 12px",border:`1px solid ${ex?"#A5D6A7":"#eee"}`}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                  <div style={{background:sc,color:"#fff",borderRadius:5,padding:"2px 7px",fontSize:10,fontWeight:700}}>#{m.id}</div>
                  <span style={{fontWeight:700,fontSize:13}}>{m.home} vs {m.away}</span>
                  <span style={{fontSize:11,color:"#888",marginLeft:"auto"}}>{fmtDate(m.date)}</span>
                </div>
                <TimeBadges time={m.time}/>
                <div style={{display:"flex",gap:8,alignItems:"flex-end",flexWrap:"wrap"}}>
                  <div><label style={S.lbl}>Score</label><input style={{...S.inp,width:70,textAlign:"center"}} placeholder="2-1" value={f.score} onChange={e=>setForm(v=>({...v,[m.id]:{...f,score:e.target.value}}))}/></div>
                  <div><label style={S.lbl}>Winner</label><input style={{...S.inp,width:120}} placeholder="Team / Draw" value={f.winner} onChange={e=>setForm(v=>({...v,[m.id]:{...f,winner:e.target.value}}))}/></div>
                  <button style={{...S.btn,padding:"8px 14px",fontSize:12,width:"auto"}} onClick={()=>{if(!f.score){toast_("Enter score first","error");return;}update(d=>{d.matchActuals[m.id]={score:f.score,winner:f.winner};return d;});toast_(`Match ${m.id} saved ✅`);}}>
                    {ex?"Update":"Save"}
                  </button>
                </div>
                {ex&&<div style={{fontSize:11,color:"#1B5E20",marginTop:4,fontWeight:600}}>✅ {ex.score} · {ex.winner}</div>}
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
        <div style={{display:"flex",alignItems:"center",gap:12,padding:"8px 0",borderBottom:"1px solid #f5f5f5",marginBottom:16}}>
          <div style={{width:44,height:44,borderRadius:"50%",background:playerColor(player),display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:900,fontSize:18}}>
            {player[0]?.toUpperCase()}
          </div>
          <div>
            <div style={{fontWeight:800,fontSize:16}}>{player}</div>
            <div style={{fontSize:12,color:"#888"}}>Player account · {TIMEZONES.find(t=>t.id===currentTZ)?.abbr||"ET"}</div>
          </div>
        </div>

        {/* Timezone selector */}
        <div style={S.blockTitle}>🌍 My Timezone</div>
        <p style={{fontSize:13,color:"#555",marginBottom:10,lineHeight:1.6}}>
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
            <div style={{background:"#E8F5E9",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#1B5E20"}}>
              ✅ Preview: Match #1 (Mexico vs South Africa) → <strong>{c.date} at {c.time}</strong>
              {c.dayShift!==0&&<span style={{color:"#E65100"}}> ⚠️ date differs from ET</span>}
            </div>
          );
        })()}
      </div>

      {/* Change password */}
      <div style={S.card}>
        <div style={S.blockTitle}>🔑 Change Password</div>
        <p style={{fontSize:13,color:"#555",marginBottom:12,lineHeight:1.6}}>
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
  const locked = new Date() >= new Date("2026-06-11T15:00:00");
  const GC={A:"#B71C1C",B:"#1A237E",C:"#1B5E20",D:"#E65100",E:"#4A148C",F:"#006064",G:"#880E4F",H:"#F57F17",I:"#01579B",J:"#33691E",K:"#37474F",L:"#6A1B9A"};

  const getT=(grp,slot)=>data.groupQualifiers[`${player}_${grp}_${slot}`]?.team||"";
  const getQ=(grp,slot)=>data.groupQualifiers[`${player}_${grp}_${slot}`]?.qualified??null;

  function setTeam(grp,slot,team){
    update(d=>{
      const key=`${player}_${grp}_${slot}`;
      d.groupQualifiers[key]={...d.groupQualifiers[key],team};
      return d;
    });
  }

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
      <div style={{display:"flex",gap:8,marginBottom:12,background:"#fff",borderRadius:12,padding:12,boxShadow:"0 2px 8px rgba(0,0,0,.06)"}}>
        {[["👥 Picks Made",`${totalPicks}/${maxPicks}`],["✅ Pts Earned",ptsSoFar],["💰 Max Possible",maxPicks*2]].map(([l,v])=>(
          <div key={l} style={{flex:1,textAlign:"center"}}>
            <div style={{fontWeight:900,fontSize:18,color:"#1A5C2E"}}>{v}</div>
            <div style={{fontSize:10,color:"#888"}}>{l}</div>
          </div>
        ))}
      </div>

      {locked && (
        <div style={{background:"#FFF3E0",border:"1px solid #FFB74D",borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:13}}>
          🔒 Group stage has started — predictions are locked. Results will be marked by admin after June 27.
        </div>
      )}
      {!locked && (
        <div style={{background:"#E8F5E9",border:"1px solid #A5D6A7",borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:13,color:"#1B5E20"}}>
          ⏰ Pick <strong>2 teams per group</strong> that you think will advance. Locks at tournament start (Jun 11). Worth <strong>2 pts each</strong>, max 48 pts.
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:10}}>
        {Object.entries(GROUPS).map(([grp,teams])=>{
          const pick0=getT(grp,0), pick1=getT(grp,1);
          const q0=getQ(grp,0), q1=getQ(grp,1);
          return (
            <div key={grp} style={{background:"#fff",borderRadius:12,overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,.08)"}}>
              <div style={{background:GC[grp],color:"#fff",fontWeight:900,fontSize:13,padding:"8px 12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span>GROUP {grp}</span>
                {(pick0||pick1) && (
                  <span style={{fontSize:11,opacity:.8}}>
                    {[q0,q1].filter(q=>q===true).length * 2} pts
                  </span>
                )}
              </div>
              <div style={{padding:"10px 12px",display:"flex",flexDirection:"column",gap:8}}>
                {[0,1].map(slot=>{
                  const pick = slot===0?pick0:pick1;
                  const qual = slot===0?q0:q1;
                  return (
                    <div key={slot}>
                      <div style={{fontSize:10,color:"#888",marginBottom:3,fontWeight:700,textTransform:"uppercase",letterSpacing:.5}}>
                        Pick {slot+1}
                      </div>
                      <select
                        style={{...S.sel,
                          borderColor: qual===true?"#4CAF50":qual===false?"#ef5350":pick?"#1B5E20":"#e0e0e0",
                          background: qual===true?"#E8F5E9":qual===false?"#FFEBEE":"#fff",
                          color: locked?"#888":"#000",
                        }}
                        value={pick}
                        disabled={locked}
                        onChange={e=>setTeam(grp,slot,e.target.value)}
                      >
                        <option value="">— Select team —</option>
                        {teams.map(t=><option key={t} value={t}>{t}</option>)}
                      </select>
                      {qual===true && <div style={{fontSize:11,color:"#4CAF50",fontWeight:700,marginTop:3}}>✅ Qualified! +2 pts</div>}
                      {qual===false && <div style={{fontSize:11,color:"#ef5350",fontWeight:700,marginTop:3}}>❌ Did not qualify</div>}
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
      <p style={{color:"#888",fontSize:12,marginBottom:12}}>2 pts per correct pick. Mark YES/NO after Jun 27.</p>
      {players.length===0 && (
        <div style={{...S.card,textAlign:"center",color:"#888",padding:24}}>
          No players have joined yet. Players will appear here once they log in and enter predictions.
        </div>
      )}
      {Object.entries(GROUPS).map(([grp,teams])=>(
        <div key={grp} style={{...S.card,marginBottom:10}}>
          <div style={S.blockTitle}>Group {grp} — {teams.join(", ")}</div>
          {players.length===0 && <div style={{color:"#bbb",fontSize:12,padding:"8px 0"}}>No players yet</div>}
          {players.map(p=>(
            <div key={p} style={{display:"grid",gridTemplateColumns:"80px 1fr 70px 1fr 70px",gap:6,alignItems:"center",padding:"5px 0",borderBottom:"1px solid #f5f5f5",fontSize:12}}>
              <span style={{fontWeight:700,fontSize:12}}>{p}</span>
              {[0,1].map(slot=>(
                <div key={slot} style={{display:"contents"}}>
                  <select style={{...S.sel,fontSize:11,padding:"4px 6px"}} value={getT(p,grp,slot)} onChange={e=>setTeam(p,grp,slot,e.target.value)}>
                    <option value="">—</option>{teams.map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                  <select style={{...S.sel,fontSize:11,padding:"4px 6px",background:getQ(p,grp,slot)===true?"#C8E6C9":getQ(p,grp,slot)===false?"#FFCDD2":"#fff"}}
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
          <div key={p} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderBottom:"1px solid #f5f5f5",flexWrap:"wrap"}}>
            <span style={{fontWeight:700,minWidth:70}}>{p}</span>
            <span style={{color:"#ef5350",fontWeight:700,minWidth:50}}>−{data.deductions[p]||0}pts</span>
            <button style={{...S.btn,background:"#E65100",padding:"6px 12px",fontSize:12,width:"auto"}} onClick={()=>apply(p,stageInfo.pts)}>−{stageInfo.pts}pts</button>
            <button style={{...S.btn,background:"#37474F",padding:"6px 12px",fontSize:12,width:"auto"}} onClick={()=>reset(p)}>Reset</button>
          </div>
        ))}
      </div>
      <div style={S.card}>
        <div style={S.blockTitle}>📝 Change Log</div>
        {data.changeLog.length===0?<p style={{color:"#bbb",fontSize:13}}>No changes yet.</p>:data.changeLog.map((l,i)=>(
          <div key={i} style={{display:"flex",gap:8,padding:"6px 0",borderBottom:"1px solid #f5f5f5",fontSize:12}}>
            <span style={{color:"#888"}}>{l.date}</span>
            <span style={{fontWeight:700}}>{l.player}</span>
            <span style={{flex:1,color:"#555"}}>{l.what}</span>
            <span style={{color:"#ef5350",fontWeight:700}}>−{l.deduction}pts ({l.stage})</span>
          </div>
        ))}
      </div>
      <div style={S.card}>
        <div style={S.blockTitle}>📉 Deduction Scale</div>
        {DEDUCTIONS.map(d=>(
          <div key={d.stage} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #f5f5f5",fontSize:13}}>
            <span style={{fontWeight:600}}>{d.stage}</span>
            <span style={{color:d.pts===0?"#1B5E20":"#ef5350",fontWeight:700}}>{d.label}</span>
          </div>
        ))}
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
          <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid #f5f5f5",fontSize:13}}>
            <span style={{color:"#555"}}>{l}</span>
            <span style={{fontWeight:800,color:"#1A5C2E"}}>{v}</span>
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
            <p style={{color:"#bbb",fontSize:13}}>No players have joined yet.</p>
          );
          return players.map(p => {
            const matchCount = Object.keys(data.matchPredictions).filter(k=>k.startsWith(p+"_")).length;
            const hasPreds = !!data.predictions[p]?.winner;
            const qualCount = Object.keys(data.groupQualifiers).filter(k=>k.startsWith(p+"_")).length;
            const isConfirming = confirmDelete === p;
            return (
              <div key={p} style={{padding:"10px 0",borderBottom:"1px solid #f5f5f5"}}>
                <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                  <div style={{width:10,height:10,borderRadius:"50%",background:playerColor(p),flexShrink:0}}/>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:14}}>{p}</div>
                    <div style={{fontSize:11,color:"#888",marginTop:2,display:"flex",gap:10,flexWrap:"wrap"}}>
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
        <p style={{fontSize:13,color:"#555",marginBottom:12,lineHeight:1.6}}>
          Downloads a <code style={{background:"#f5f5f5",padding:"1px 5px",borderRadius:4,fontSize:12}}>.json</code> file of all app data — predictions, scores, qualifiers, deductions, change log. Save this somewhere safe. If the app ever resets, you can restore from it below.
        </p>
        <div style={{background:"#E8F5E9",borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:12,color:"#1B5E20"}}>
          💡 <strong>Recommended:</strong> Export after entering each matchday's results. Takes 2 seconds and is your safety net for the whole tournament.
        </div>
        <button style={{...S.btn,background:"#1B5E20",display:"flex",alignItems:"center",justifyContent:"center",gap:8}} onClick={exportBackup}>
          📥 Download Backup JSON
        </button>
      </div>

      {/* Import */}
      <div style={S.card}>
        <div style={S.blockTitle}>📥 Restore from Backup</div>
        <p style={{fontSize:13,color:"#555",marginBottom:12,lineHeight:1.6}}>
          Paste the contents of your backup JSON file below, or upload the file directly. This will <strong style={{color:"#C62828"}}>overwrite all current data</strong> — use only to recover after a reset.
        </p>
        <div style={{marginBottom:10}}>
          <label style={S.lbl}>Upload .json file</label>
          <input type="file" accept=".json" onChange={handleFileUpload}
            style={{fontSize:13,padding:"6px 0",color:"#555",width:"100%"}}/>
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
        <p style={{fontSize:13,color:"#555",marginBottom:12,lineHeight:1.6}}>
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
        <div style={{marginTop:8,fontSize:11,color:"#aaa",textAlign:"center"}}>Default password: <code>admin2026</code> — change this before sharing the app</div>
      </div>

      {/* Danger zone */}
      <div style={{...S.card,border:"2px solid #FFCDD2"}}>
        <div style={{...S.blockTitle,color:"#C62828",borderBottomColor:"#FFCDD2"}}>⚠️ Danger Zone</div>
        <p style={{fontSize:13,color:"#555",marginBottom:12,lineHeight:1.6}}>
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

// ─── TOAST ────────────────────────────────────────────────────────────────────
function Toast({toast}) {
  return (
    <div style={{
      position:"fixed",bottom:80,left:"50%",transform:"translateX(-50%)",
      background:toast.type==="error"?"#C62828":"#1B5E20",
      color:"#fff",padding:"12px 22px",borderRadius:12,fontWeight:700,
      fontSize:14,zIndex:9999,boxShadow:"0 4px 20px rgba(0,0,0,.25)",
      whiteSpace:"nowrap",
    }}>{toast.msg}</div>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const S = {
  header:{background:"#1A5C2E",color:"#fff",padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100,flexShrink:0},
  sec:{},
  h2:{fontSize:20,fontWeight:900,color:"#1A5C2E",marginBottom:12,marginTop:0},
  card:{background:"#fff",borderRadius:14,padding:16,boxShadow:"0 2px 8px rgba(0,0,0,.07)",marginBottom:14},
  blockTitle:{fontWeight:800,fontSize:14,color:"#1A5C2E",marginBottom:10,paddingBottom:8,borderBottom:"2px solid #E8F5E9"},
  empty:{color:"#bbb",textAlign:"center",padding:24,fontSize:14},
  loginWrap:{minHeight:"100vh",background:"linear-gradient(135deg,#1A5C2E,#0D3B1E)",display:"flex",alignItems:"center",justifyContent:"center",padding:16},
  loginCard:{background:"#fff",borderRadius:20,padding:"32px 28px",maxWidth:380,width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,.3)"},
  lbl:{fontSize:11,fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:.8,display:"block",marginBottom:4},
  inp:{border:"2px solid #e0e0e0",borderRadius:10,padding:"10px 14px",fontSize:14,outline:"none",fontFamily:"inherit",width:"100%",boxSizing:"border-box"},
  btn:{background:"#1B5E20",color:"#fff",border:"none",borderRadius:10,padding:"12px 20px",fontSize:14,fontWeight:700,cursor:"pointer",width:"100%"},
  sel:{width:"100%",border:"2px solid #e0e0e0",borderRadius:8,padding:"8px 10px",fontSize:13,outline:"none",fontFamily:"inherit",cursor:"pointer",boxSizing:"border-box"},
  chip:{background:"#fff",border:"2px solid #e0e0e0",borderRadius:20,padding:"4px 12px",fontSize:11,cursor:"pointer",fontWeight:600,color:"#555",whiteSpace:"nowrap"},
  chipActive:{background:"#1B5E20",color:"#FFD700",borderColor:"#1B5E20"},
  rp:{fontSize:13,color:"#333",lineHeight:1.7,marginBottom:10},
  ri:{display:"flex",gap:10,alignItems:"flex-start",background:"#fff",borderRadius:8,padding:"8px 10px",border:"1px solid #eee",marginBottom:6},
};
