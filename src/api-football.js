// ─── API-FOOTBALL INTEGRATION ────────────────────────────────────────────────
// https://www.api-football.com
// Free tier: 100 requests/day
// World Cup 2026: league ID = 1, season = 2026

const API_KEY   = "77e57148bd2431c24ab6f7bd7fd9ad05";
const BASE_URL  = "https://v3.football.api-sports.io";
const LEAGUE_ID = 1;
const SEASON    = 2026;

// Team name normalisation — API uses different names to ours
const NAME_MAP = {
  "United States":      "USA",
  "Korea Republic":     "South Korea",
  "Bosnia Herzegovina": "Bosnia & Herz.",
  "Bosnia":             "Bosnia & Herz.",
  "Côte d'Ivoire":      "Ivory Coast",
  "Curacao":            "Curaçao",
  "Turkey":             "Türkiye",
  "Turkiye":            "Türkiye",
  "Congo DR":           "DR Congo",
  "Republic of Ireland":"Ireland",
};
const norm = n => NAME_MAP[n] || n;

async function apiFetch(endpoint) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: { "x-apisports-key": API_KEY },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

// ─── 1. ALL FIXTURES (finished + upcoming) ────────────────────────────────────
// Returns two maps:
//   finished:  { "Home|||Away": { score, winner } }
//   upcoming:  { apiFixtureId: { home, away, round, date } }
//   knockoutTeams: { ourMatchId: { home, away } }  ← real team names for knockout slots
async function fetchAllFixtures() {
  const data = await apiFetch(
    `/fixtures?league=${LEAGUE_ID}&season=${SEASON}`
  );

  const finished     = {};   // completed matches by team pair key
  const knockoutTeams = {};  // our match ID → { home, away } real names

  // Our group-stage match ID lookup by team pair
  const GROUP_PAIRS = {
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

  // Round-of-32 and beyond: our match IDs 73-104
  // We map by API round name
  const ROUND_MAP = {
    "Round of 32 - 1":73,"Round of 32 - 2":74,"Round of 32 - 3":75,
    "Round of 32 - 4":76,"Round of 32 - 5":77,"Round of 32 - 6":78,
    "Round of 32 - 7":79,"Round of 32 - 8":80,"Round of 32 - 9":81,
    "Round of 32 - 10":82,"Round of 32 - 11":83,"Round of 32 - 12":84,
    "Round of 32 - 13":85,"Round of 32 - 14":86,"Round of 32 - 15":87,
    "Round of 32 - 16":88,
    "Round of 16 - 1":89,"Round of 16 - 2":90,"Round of 16 - 3":91,
    "Round of 16 - 4":92,"Round of 16 - 5":93,"Round of 16 - 6":94,
    "Round of 16 - 7":95,"Round of 16 - 8":96,
    "Quarter-finals - 1":97,"Quarter-finals - 2":98,
    "Quarter-finals - 3":99,"Quarter-finals - 4":100,
    "Semi-finals - 1":101,"Semi-finals - 2":102,
    "3rd Place Final":103,
    "Final":104,
  };

  for (const fx of data.response || []) {
    const apiHome  = fx.teams.home.name;
    const apiAway  = fx.teams.away.name;
    const home     = norm(apiHome);
    const away     = norm(apiAway);
    const status   = fx.fixture.status.short;
    const round    = fx.league.round || "";
    const isDone   = ["FT","AET","PEN"].includes(status);

    // ── Group stage: record finished results ─────────────────────────────────
    if (isDone) {
      const homeG  = fx.goals.home ?? 0;
      const awayG  = fx.goals.away ?? 0;
      const score  = `${homeG}-${awayG}`;
      const homeWon = fx.teams.home.winner;
      const winner = homeWon === true ? home : homeWon === false ? away : "Draw";
      finished[`${home}|||${away}`] = { score, winner };
    }

    // ── Knockout rounds: record real team names for upcoming & finished ──────
    // Try round name lookup first
    let ourId = ROUND_MAP[round];

    // Fallback: try to find by normalised home/away in GROUP_PAIRS
    if (!ourId) {
      ourId = GROUP_PAIRS[`${home}|||${away}`];
    }

    if (ourId && ourId >= 73) {
      // Real team names are now known — store them
      knockoutTeams[ourId] = { home, away };

      // If finished, also store result
      if (isDone) {
        const homeG  = fx.goals.home ?? 0;
        const awayG  = fx.goals.away ?? 0;
        const score  = `${homeG}-${awayG}`;
        const homeWon = fx.teams.home.winner;
        const winner = homeWon === true ? home : homeWon === false ? away : "Draw";
        finished[`${home}|||${away}`] = { score, winner };
      }
    }
  }

  return { finished, knockoutTeams };
}

// ─── 2. GROUP STANDINGS ────────────────────────────────────────────────────────
export async function fetchGroupStandings() {
  const data = await apiFetch(`/standings?league=${LEAGUE_ID}&season=${SEASON}`);
  const qualifiers = {};
  for (const grp of data.response?.[0]?.league?.standings || []) {
    const letter = grp[0]?.group?.replace(/^Group\s*/i,"").trim();
    if (letter) qualifiers[letter] = grp.slice(0,2).map(t => norm(t.team.name));
  }
  return qualifiers;
}

// ─── 3. TOP SCORER ────────────────────────────────────────────────────────────
export async function fetchTopScorer() {
  const data = await apiFetch(`/players/topscorers?league=${LEAGUE_ID}&season=${SEASON}`);
  const top = data.response?.[0];
  if (!top) return null;
  return {
    name:  top.player.name,
    goals: top.statistics[0]?.goals?.total || 0,
    team:  norm(top.statistics[0]?.team?.name || ""),
  };
}

// ─── 4. TOURNAMENT AWARDS ─────────────────────────────────────────────────────
export async function fetchTournamentAwards() {
  const data = await apiFetch(`/fixtures?league=${LEAGUE_ID}&season=${SEASON}&round=Final`);
  const awards = {};
  for (const fx of data.response || []) {
    const round   = fx.league.round?.toLowerCase() || "";
    const status  = fx.fixture.status.short;
    if (!["FT","AET","PEN"].includes(status)) continue;
    const home    = norm(fx.teams.home.name);
    const away    = norm(fx.teams.away.name);
    const homeWon = fx.teams.home.winner;
    if (round.includes("final") && !round.includes("semi") && !round.includes("3rd")) {
      awards.winner   = homeWon ? home : away;
      awards.runnerUp = homeWon ? away : home;
    }
    if (round.includes("3rd")) {
      awards.thirdPlace = homeWon ? home : away;
    }
  }
  return awards;
}

// ─── FULL SYNC ────────────────────────────────────────────────────────────────
export async function syncAllResults(currentData) {
  const summary = {
    matchesUpdated:     0,
    knockoutNamesUpdated: 0,
    qualifiersUpdated:  0,
    topScorer:          null,
    awards:             {},
    errors:             [],
  };

  const newData = JSON.parse(JSON.stringify(currentData));
  if (!newData.knockoutTeams) newData.knockoutTeams = {};

  // ── 1. All fixtures (results + knockout real names) ───────────────────────
  try {
    const { finished, knockoutTeams } = await fetchAllFixtures();

    // Apply group stage results
    const GROUP_PAIRS_REVERSE = {
      1:["Mexico","South Africa"],2:["South Korea","Czechia"],3:["Canada","Bosnia & Herz."],
      4:["USA","Paraguay"],5:["Qatar","Switzerland"],6:["Brazil","Morocco"],
      7:["Haiti","Scotland"],8:["Australia","Türkiye"],9:["Germany","Curaçao"],
      10:["Netherlands","Japan"],11:["Ivory Coast","Ecuador"],12:["Sweden","Tunisia"],
      13:["Spain","Cape Verde"],14:["Belgium","Egypt"],15:["Saudi Arabia","Uruguay"],
      16:["Iran","New Zealand"],17:["France","Senegal"],18:["Iraq","Norway"],
      19:["Argentina","Algeria"],20:["Austria","Jordan"],21:["Portugal","DR Congo"],
      22:["England","Croatia"],23:["Ghana","Panama"],24:["Uzbekistan","Colombia"],
      25:["Czechia","South Africa"],26:["Switzerland","Bosnia & Herz."],27:["Canada","Qatar"],
      28:["Mexico","South Korea"],29:["USA","Australia"],30:["Scotland","Morocco"],
      31:["Brazil","Haiti"],32:["Türkiye","Paraguay"],33:["Netherlands","Sweden"],
      34:["Germany","Ivory Coast"],35:["Ecuador","Curaçao"],36:["Tunisia","Japan"],
      37:["Spain","Saudi Arabia"],38:["Belgium","Iran"],39:["Uruguay","Cape Verde"],
      40:["New Zealand","Egypt"],41:["Argentina","Austria"],42:["France","Iraq"],
      43:["Norway","Senegal"],44:["Jordan","Algeria"],45:["Portugal","Uzbekistan"],
      46:["England","Ghana"],47:["Panama","Croatia"],48:["Colombia","DR Congo"],
      49:["Switzerland","Canada"],50:["Bosnia & Herz.","Qatar"],51:["Scotland","Brazil"],
      52:["Morocco","Haiti"],53:["Czechia","Mexico"],54:["South Africa","South Korea"],
      55:["Curaçao","Ivory Coast"],56:["Ecuador","Germany"],57:["Japan","Sweden"],
      58:["Tunisia","Netherlands"],59:["Türkiye","USA"],60:["Paraguay","Australia"],
      61:["Norway","France"],62:["Senegal","Iraq"],63:["Cape Verde","Saudi Arabia"],
      64:["Uruguay","Spain"],65:["Egypt","Iran"],66:["New Zealand","Belgium"],
      67:["Panama","England"],68:["Croatia","Ghana"],69:["Colombia","Portugal"],
      70:["DR Congo","Uzbekistan"],71:["Algeria","Austria"],72:["Jordan","Argentina"],
    };

    for (const [id, [home, away]] of Object.entries(GROUP_PAIRS_REVERSE)) {
      const key = `${home}|||${away}`;
      const result = finished[key];
      if (result) {
        const prev = newData.matchActuals[id];
        if (!prev || prev.score !== result.score) {
          newData.matchActuals[id] = result;
          summary.matchesUpdated++;
        }
      }
    }

    // Apply knockout match results + real team names
    for (const [id, teams] of Object.entries(knockoutTeams)) {
      const numId = Number(id);

      // Store real team names for display in schedule
      const prev = newData.knockoutTeams[numId];
      if (!prev || prev.home !== teams.home || prev.away !== teams.away) {
        newData.knockoutTeams[numId] = teams;
        summary.knockoutNamesUpdated++;
      }

      // Also check for result
      const key = `${teams.home}|||${teams.away}`;
      const result = finished[key];
      if (result) {
        const prevResult = newData.matchActuals[numId];
        if (!prevResult || prevResult.score !== result.score) {
          newData.matchActuals[numId] = result;
          summary.matchesUpdated++;
        }
      }
    }
  } catch (e) {
    summary.errors.push(`Fixtures: ${e.message}`);
  }

  // ── 2. Group qualifiers ───────────────────────────────────────────────────
  try {
    const standings = await fetchGroupStandings();
    if (Object.keys(standings).length > 0) {
      const players = [...new Set([
        ...Object.keys(newData.predictions),
        ...Object.keys(newData.deductions),
      ])];
      for (const grp of ["A","B","C","D","E","F","G","H","I","J","K","L"]) {
        const qualified = standings[grp] || [];
        if (qualified.length < 2) continue;
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
    }
  } catch (e) {
    summary.errors.push(`Standings: ${e.message}`);
  }

  // ── 3. Top scorer ─────────────────────────────────────────────────────────
  try {
    const ts = await fetchTopScorer();
    if (ts) {
      newData.matchActuals._goldenBoot = ts.name;
      summary.topScorer = ts;
    }
  } catch (e) {
    summary.errors.push(`Top scorer: ${e.message}`);
  }

  // ── 4. Tournament awards ──────────────────────────────────────────────────
  try {
    const aw = await fetchTournamentAwards();
    if (aw.winner)     { newData.matchActuals._winner     = aw.winner;     summary.awards.winner     = aw.winner; }
    if (aw.runnerUp)   { newData.matchActuals._runnerUp   = aw.runnerUp;   summary.awards.runnerUp   = aw.runnerUp; }
    if (aw.thirdPlace) { newData.matchActuals._thirdPlace = aw.thirdPlace; summary.awards.thirdPlace = aw.thirdPlace; }
  } catch (e) {
    summary.errors.push(`Awards: ${e.message}`);
  }

  return { newData, summary };
}
