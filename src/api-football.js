// ─── WC2026 DATA SYNC ─────────────────────────────────────────────────────────
// Uses openfootball/worldcup.json — free, no API key, updated daily
// https://github.com/openfootball/worldcup.json
// Data URL: https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json

const DATA_URL = "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json";

// Team name normalisation — openfootball uses slightly different names
const NAME_MAP = {
  "United States":         "USA",
  "Korea Republic":        "South Korea",
  "Bosnia-Herzegovina":    "Bosnia & Herz.",
  "Bosnia Herzegovina":    "Bosnia & Herz.",
  "Côte d'Ivoire":         "Ivory Coast",
  "Cote d'Ivoire":         "Ivory Coast",
  "Curacao":               "Curaçao",
  "Turkey":                "Türkiye",
  "Czech Republic":        "Czechia",
  "Cape Verde Islands":    "Cape Verde",
  "Congo DR":              "DR Congo",
  "DR Congo":              "DR Congo",
  "Democratic Republic of Congo": "DR Congo",
};
const norm = n => NAME_MAP[n] || n;

// Our app match IDs mapped by home|||away team pair
const MATCH_ID_MAP = {
  "Mexico|||South Africa":1,"South Korea|||Czechia":2,"Canada|||Bosnia & Herz.":3,
  "USA|||Paraguay":4,"Qatar|||Switzerland":5,"Brazil|||Morocco":6,
  "Haiti|||Scotland":7,"Australia|||Türkiye":8,"Germany|||Curaçao":9,
  "Netherlands|||Japan":10,"Ivory Coast|||Ecuador":11,"Sweden|||Tunisia":12,
  "Spain|||Cape Verde":13,"Belgium|||Egypt":14,"Saudi Arabia|||Uruguay":15,
  "Iran|||New Zealand":16,"France|||Senegal":17,"Iraq|||Norway":18,
  "Argentina|||Algeria":19,"Austria|||Jordan":20,"Portugal|||DR Congo":21,
  "England|||Croatia":22,"Ghana|||Panama":23,"Uzbekistan|||Colombia":24,
  "Czechia|||South Africa":25,"Switzerland|||Bosnia & Herz.":26,"Canada|||Qatar":27,
  "Mexico|||South Korea":28,"USA|||Australia":29,"Scotland|||Morocco":30,
  "Brazil|||Haiti":31,"Türkiye|||Paraguay":32,"Netherlands|||Sweden":33,
  "Germany|||Ivory Coast":34,"Ecuador|||Curaçao":35,"Tunisia|||Japan":36,
  "Spain|||Saudi Arabia":37,"Belgium|||Iran":38,"Uruguay|||Cape Verde":39,
  "New Zealand|||Egypt":40,"Argentina|||Austria":41,"France|||Iraq":42,
  "Norway|||Senegal":43,"Jordan|||Algeria":44,"Portugal|||Uzbekistan":45,
  "England|||Ghana":46,"Panama|||Croatia":47,"Colombia|||DR Congo":48,
  "Switzerland|||Canada":49,"Bosnia & Herz.|||Qatar":50,"Scotland|||Brazil":51,
  "Morocco|||Haiti":52,"Czechia|||Mexico":53,"South Africa|||South Korea":54,
  "Curaçao|||Ivory Coast":55,"Ecuador|||Germany":56,"Japan|||Sweden":57,
  "Tunisia|||Netherlands":58,"Türkiye|||USA":59,"Paraguay|||Australia":60,
  "Norway|||France":61,"Senegal|||Iraq":62,"Cape Verde|||Saudi Arabia":63,
  "Uruguay|||Spain":64,"Egypt|||Iran":65,"New Zealand|||Belgium":66,
  "Panama|||England":67,"Croatia|||Ghana":68,"Colombia|||Portugal":69,
  "DR Congo|||Uzbekistan":70,"Algeria|||Austria":71,"Jordan|||Argentina":72,
};

// ─── MAIN SYNC ────────────────────────────────────────────────────────────────
export async function syncAllResults(currentData) {
  const summary = {
    matchesUpdated:       0,
    knockoutNamesUpdated: 0,
    qualifiersUpdated:    0,
    topScorer:            null,
    awards:               {},
    errors:               [],
    rawAPINames:          [],
  };

  const newData = JSON.parse(JSON.stringify(currentData));
  if (!newData.knockoutTeams) newData.knockoutTeams = {};

  // ── Fetch all match data ──────────────────────────────────────────────────
  let matches = [];
  try {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    matches = json.matches || [];
  } catch (e) {
    summary.errors.push(`Fetch failed: ${e.message}`);
    return { newData, summary };
  }

  // ── Process each match ───────────────────────────────────────────────────
  const groupStandings = {}; // { grp: { teamName: { pts, gd, gf, played } } }

  for (const m of matches) {
    const home = norm(m.team1);
    const away = norm(m.team2);
    const score1 = m.score?.ft?.[0];
    const score2 = m.score?.ft?.[1];
    const isFinished = score1 !== undefined && score1 !== null &&
                       score2 !== undefined && score2 !== null;

    if (isFinished) {
      summary.rawAPINames.push(`${home} ${score1}-${score2} ${away}`);

      const score  = `${score1}-${score2}`;
      const winner = score1 > score2 ? home : score2 > score1 ? away : "Draw";
      const result = { score, winner };

      // Match by team pair
      const key = `${home}|||${away}`;
      const matchId = MATCH_ID_MAP[key];

      if (matchId) {
        const prev = newData.matchActuals[matchId];
        if (!prev || prev.score !== result.score) {
          newData.matchActuals[matchId] = result;
          summary.matchesUpdated++;
        }
      }

      // Build group standings from results
      const grp = m.group?.replace(/^Group\s*/i,"").trim();
      if (grp && grp.length === 1) {
        if (!groupStandings[grp]) groupStandings[grp] = {};
        if (!groupStandings[grp][home]) groupStandings[grp][home] = { pts:0, gd:0, gf:0, played:0 };
        if (!groupStandings[grp][away]) groupStandings[grp][away] = { pts:0, gd:0, gf:0, played:0 };
        groupStandings[grp][home].played++;
        groupStandings[grp][away].played++;
        groupStandings[grp][home].gf += score1;
        groupStandings[grp][away].gf += score2;
        groupStandings[grp][home].gd += (score1 - score2);
        groupStandings[grp][away].gd += (score2 - score1);
        if (score1 > score2)      { groupStandings[grp][home].pts += 3; }
        else if (score2 > score1) { groupStandings[grp][away].pts += 3; }
        else                      { groupStandings[grp][home].pts += 1; groupStandings[grp][away].pts += 1; }
      }
    }

    // Knockout round team names (once bracket is set)
    if (m.round && !m.group) {
      // These are knockout matches — store real team names
      const koKey = `${home}|||${away}`;
      const matchId = MATCH_ID_MAP[koKey];
      if (matchId && matchId >= 73 && home && away &&
          !home.startsWith("Winner") && !home.startsWith("Loser")) {
        const prev = newData.knockoutTeams[matchId];
        if (!prev || prev.home !== home || prev.away !== away) {
          newData.knockoutTeams[matchId] = { home, away };
          summary.knockoutNamesUpdated++;
        }
        if (isFinished) {
          const score  = `${m.score.ft[0]}-${m.score.ft[1]}`;
          const winner = m.score.ft[0] > m.score.ft[1] ? home :
                         m.score.ft[1] > m.score.ft[0] ? away : "Draw";
          const prev = newData.matchActuals[matchId];
          if (!prev || prev.score !== score) {
            newData.matchActuals[matchId] = { score, winner };
            summary.matchesUpdated++;
          }
        }
      }
    }
  }

  // ── Auto-calc group qualifiers from standings ─────────────────────────────
  const qualifiedByGroup = {};
  for (const [grp, teams] of Object.entries(groupStandings)) {
    const sorted = Object.entries(teams)
      .sort((a,b) => b[1].pts - a[1].pts || b[1].gd - a[1].gd || b[1].gf - a[1].gf);
    // Only mark as qualified if all 3 matchdays played (6 matches per group)
    const totalGames = Object.values(teams).reduce((s,t)=>s+t.played,0) / 2;
    if (totalGames >= 3) {
      qualifiedByGroup[grp] = sorted.slice(0,2).map(([t])=>t);
    }
  }

  // Apply qualifier results to all players
  const players = [...new Set([
    ...Object.keys(newData.predictions),
    ...Object.keys(newData.deductions),
  ])];

  for (const grp of Object.keys(qualifiedByGroup)) {
    const qualified = qualifiedByGroup[grp];
    for (const player of players) {
      for (let slot = 0; slot < 2; slot++) {
        const key  = `${player}_${grp}_${slot}`;
        const pick = newData.groupQualifiers[key]?.team;
        if (!pick || !newData.groupQualifiers[key]) continue;
        newData.groupQualifiers[key].qualified =
          qualified.some(t => t === pick || t.toLowerCase() === pick.toLowerCase());
        summary.qualifiersUpdated++;
      }
    }
  }

  return { newData, summary };
}

// ─── FIFA RANKINGS (April 2026) ───────────────────────────────────────────────
export async function fetchFIFARankings() {
  const RANKINGS = {
    "France":1,"Spain":2,"Argentina":3,"England":4,"Portugal":5,
    "Brazil":6,"Netherlands":7,"Morocco":8,"Belgium":9,"Germany":10,
    "Croatia":11,"Colombia":13,"Senegal":14,"Mexico":15,
    "USA":16,"Uruguay":17,"Japan":18,"Switzerland":19,
    "Ecuador":25,"South Korea":23,"Austria":27,"Norway":29,
    "Türkiye":30,"Sweden":35,"Algeria":31,"Iran":21,
    "Australia":24,"South Africa":68,"DR Congo":55,"Ghana":57,
    "Tunisia":33,"Egypt":36,"Saudi Arabia":56,"Ivory Coast":41,
    "Czechia":38,"Panama":49,"Bosnia & Herz.":62,"Qatar":37,
    "Canada":46,"Scotland":39,"Haiti":98,"Curaçao":82,
    "Cape Verde":75,"New Zealand":95,"Uzbekistan":74,
    "Jordan":85,"Iraq":63,"Paraguay":58,
  };
  await new Promise(r => setTimeout(r, 100));
  return RANKINGS;
}
