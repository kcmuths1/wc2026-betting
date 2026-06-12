// ─── ZAFRONIX WC2026 API INTEGRATION ─────────────────────────────────────────
// https://api.zafronix.com
// Free tier: 250 requests/day, no card required
// Docs: https://api.zafronix.com/docs
// Auth: X-API-Key header

const API_KEY  = "zwc_free_85b9322115f4fe82a4e3a87a";
const BASE_URL = "https://api.zafronix.com/fifa/worldcup/v1";

// ─── Team name normalisation ──────────────────────────────────────────────────
// Zafronix uses full official names — map to our app's names
const NAME_MAP = {
  "United States":               "USA",
  "Korea Republic":              "South Korea",
  "Republic of Korea":           "South Korea",
  "Bosnia Herzegovina":          "Bosnia & Herz.",
  "Bosnia-Herzegovina":          "Bosnia & Herz.",
  "Côte d'Ivoire":               "Ivory Coast",
  "Cote d'Ivoire":               "Ivory Coast",
  "Curacao":                     "Curaçao",
  "Turkey":                      "Türkiye",
  "Czech Republic":              "Czechia",
  "Cape Verde Islands":          "Cape Verde",
  "Congo DR":                    "DR Congo",
  "Democratic Republic of Congo":"DR Congo",
};
const norm = n => NAME_MAP[n] || n;

// ─── Our match ID lookup by normalised home|||away ────────────────────────────
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

// Knockout stage — map stageNormalized to our match ID range
const KNOCKOUT_STAGE_MAP = {
  "round_of_32": { start:73, end:88 },
  "round_of_16": { start:89, end:96 },
  "quarter_final": { start:97, end:100 },
  "semi_final": { start:101, end:102 },
  "third_place": { start:103, end:103 },
  "final": { start:104, end:104 },
  // legacy names too
  "r32": { start:73, end:88 },
  "r16": { start:89, end:96 },
  "qf":  { start:97, end:100 },
  "sf":  { start:101, end:102 },
  "thirdPlace": { start:103, end:103 },
};

async function zFetch(endpoint) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: { "X-API-Key": API_KEY },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Zafronix ${res.status}: ${body.slice(0,200)}`);
  }
  return res.json();
}

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

  // ── 1. Fetch all 2026 matches ─────────────────────────────────────────────
  let matches = [];
  try {
    const json = await zFetch("/matches?year=2026");
    // Zafronix returns { matches: [...] } or directly an array
    matches = Array.isArray(json) ? json : (json.matches || json.data || []);
  } catch (e) {
    summary.errors.push(`Matches fetch: ${e.message}`);
    return { newData, summary };
  }

  // Track knockout slots by stage for ordering
  const knockoutSlotCounters = {};

  for (const m of matches) {
    const home = norm(m.homeTeam || m.home_team || m.team1 || "");
    const away = norm(m.awayTeam || m.away_team || m.team2 || "");
    if (!home || !away) continue;

    // Score — try multiple field name patterns
    const homeScore = m.homeScore ?? m.home_score ?? m.score?.home ?? m.result?.home ?? null;
    const awayScore = m.awayScore ?? m.away_score ?? m.score?.away ?? m.result?.away ?? null;
    const isFinished = homeScore !== null && homeScore !== undefined &&
                       awayScore !== null && awayScore !== undefined &&
                       m.status !== "scheduled" && m.status !== "upcoming";

    if (isFinished) {
      summary.rawAPINames.push(`${home} ${homeScore}-${awayScore} ${away}`);
    }

    // Get stage from stageNormalized (preferred) or stage
    const stage = (m.stageNormalized || m.stage || "").toLowerCase();
    const isGroup = stage.startsWith("group_");
    const isKnockout = !isGroup && stage !== "" && stage !== "group";

    // ── Group stage match ─────────────────────────────────────────────────
    if (isGroup && isFinished) {
      const key = `${home}|||${away}`;
      const matchId = MATCH_ID_MAP[key];
      if (matchId) {
        const score  = `${homeScore}-${awayScore}`;
        const winner = homeScore > awayScore ? home :
                       awayScore > homeScore ? away : "Draw";
        const prev = newData.matchActuals[matchId];
        if (!prev || prev.score !== score) {
          newData.matchActuals[matchId] = { score, winner };
          summary.matchesUpdated++;
        }
      }
    }

    // ── Knockout stage match ──────────────────────────────────────────────
    if (isKnockout && home && away &&
        !home.includes("Winner") && !home.includes("Loser") &&
        !away.includes("Winner") && !away.includes("Loser")) {

      // Use the match's own id if available, otherwise slot by stage
      const zId = m.id || m.matchId || m.match_id;
      let ourId = null;

      // Try to find by team pair first
      const key = `${home}|||${away}`;
      if (MATCH_ID_MAP[key]) {
        ourId = MATCH_ID_MAP[key];
      } else {
        // Assign by stage slot counter
        const range = KNOCKOUT_STAGE_MAP[stage] || KNOCKOUT_STAGE_MAP[m.stageNormalized] || KNOCKOUT_STAGE_MAP[m.stage];
        if (range) {
          if (!knockoutSlotCounters[stage]) knockoutSlotCounters[stage] = range.start;
          ourId = knockoutSlotCounters[stage];
          if (knockoutSlotCounters[stage] <= range.end) knockoutSlotCounters[stage]++;
          // Also add to MATCH_ID_MAP for this run
          MATCH_ID_MAP[key] = ourId;
        }
      }

      if (ourId) {
        // Store real team names
        const prev = newData.knockoutTeams[ourId];
        if (!prev || prev.home !== home || prev.away !== away) {
          newData.knockoutTeams[ourId] = { home, away };
          summary.knockoutNamesUpdated++;
        }
        // Store result if finished
        if (isFinished) {
          const score  = `${homeScore}-${awayScore}`;
          const winner = homeScore > awayScore ? home :
                         awayScore > homeScore ? away : "Draw";
          const prevR = newData.matchActuals[ourId];
          if (!prevR || prevR.score !== score) {
            newData.matchActuals[ourId] = { score, winner };
            summary.matchesUpdated++;
          }
        }
      }
    }
  }

  // ── 2. Group standings → auto-qualify ────────────────────────────────────
  try {
    const json = await zFetch("/standings?year=2026");

    // Zafronix actual shape: { year:2026, groups:{ A:[{team,played,...}], B:[...] } }
    let groups = [];
    if (Array.isArray(json)) {
      groups = json;
    } else if (json.groups && !Array.isArray(json.groups) && typeof json.groups === "object") {
      // ← actual Zafronix shape: groups is object keyed by letter
      groups = Object.entries(json.groups).map(([k,v])=>({ group:k, teams:Array.isArray(v)?v:[] }));
    } else if (Array.isArray(json.groups)) {
      groups = json.groups;
    } else if (Array.isArray(json.standings)) {
      groups = json.standings;
    } else if (json.standings && typeof json.standings === "object") {
      groups = Object.entries(json.standings).map(([k,v])=>({ group:k, teams:Array.isArray(v)?v:[] }));
    } else {
      summary.errors.push(`Standings: unexpected shape — ${JSON.stringify(json).slice(0,150)}`);
    }

    const players = [...new Set([
      ...Object.keys(newData.predictions),
      ...Object.keys(newData.deductions),
    ])];

    for (const grp of groups) {
      const grpLetter = (grp.group || grp.name || grp.groupName || grp.stage || "")
        .replace(/^[Gg]roup[\s_]*/,"").trim().toUpperCase();
      if (!grpLetter || grpLetter.length !== 1) continue;

      const teams = (grp.teams || grp.standings || grp.entries || [])
        .sort((a,b) => (a.position||a.rank||a.pos||99) - (b.position||b.rank||b.pos||99));
      if (teams.length < 2) continue;

      const hasResults = teams.some(t =>
        (t.played||t.gamesPlayed||t.matchesPlayed||t.mp||0) > 0
      );
      if (!hasResults) continue;

      const top2 = teams.slice(0,2).map(t =>
        norm(t.team || t.name || t.teamName || t.country || "")
      ).filter(Boolean);

      if (top2.length < 2) continue;

      for (const player of players) {
        for (let slot = 0; slot < 2; slot++) {
          const key  = `${player}_${grpLetter}_${slot}`;
          const pick = newData.groupQualifiers[key]?.team;
          if (!pick || !newData.groupQualifiers[key]) continue;
          newData.groupQualifiers[key].qualified =
            top2.some(t => t === pick || t.toLowerCase() === pick.toLowerCase());
          summary.qualifiersUpdated++;
        }
      }
    }
  } catch (e) {
    summary.errors.push(`Standings: ${e.message}`);
  }

  // ── 3. Top scorer (Golden Boot) ──────────────────────────────────────────
  try {
    const json = await zFetch("/aggregates/players?year=2026&sort=goals&limit=1");
    const top = Array.isArray(json) ? json[0] : (json.players||json.data||[])[0];
    if (top) {
      const name = top.name || top.playerName || top.player;
      const goals = top.goals || top.goalCount || 0;
      if (name) {
        newData.matchActuals._goldenBoot = name;
        summary.topScorer = { name, goals };
      }
    }
  } catch (e) {
    // Top scorer endpoint may not be available on free tier — not critical
    summary.errors.push(`Top scorer: ${e.message}`);
  }

  // ── 4. Tournament awards (from tournament endpoint) ──────────────────────
  try {
    const json = await zFetch("/tournaments/2026");
    const t = json.tournament || json;
    if (t.champion)    { newData.matchActuals._winner     = norm(t.champion);    summary.awards.winner     = t.champion; }
    if (t.runnerUp)    { newData.matchActuals._runnerUp   = norm(t.runnerUp);    summary.awards.runnerUp   = t.runnerUp; }
    if (t.thirdPlace)  { newData.matchActuals._thirdPlace = norm(t.thirdPlace);  summary.awards.thirdPlace = t.thirdPlace; }
    if (t.topScorer?.player && !summary.topScorer) {
      newData.matchActuals._goldenBoot = t.topScorer.player;
      summary.topScorer = { name: t.topScorer.player, goals: t.topScorer.goals };
    }
  } catch (e) {
    summary.errors.push(`Tournament awards: ${e.message}`);
  }

  return { newData, summary };
}

// ─── FIFA RANKINGS (April 2026 — hardcoded, no API needed) ───────────────────
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
