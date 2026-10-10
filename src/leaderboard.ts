import { levelProgress } from "./levels";
import { authManager } from "./auth";
import { fetchLiveLeaderboard } from "./supabaseClient";
import { tournamentConfigManager } from "./tournamentConfig";

export interface LeaderboardEntry {
  rank: number;
  name: string;
  score: number;
  country?: string;
  isPlayer?: boolean;
}

export interface StarLeaderboardEntry {
  rank: number;
  name: string;
  stars: number;
  country?: string;
  isPlayer?: boolean;
}

const BEST_SCORE_KEY = "bbt_tourney_best_score";
const PLAYER_NAME_KEY = "bbt_player_nickname";

export const BASE_TOURNAMENT_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, name: "ApexBlaster", score: 9840, country: "🇿🇦" },
  { rank: 2, name: "GridMaster99", score: 7650, country: "🇬🇧" },
  { rank: 3, name: "BlockQueen", score: 6120, country: "🇺🇸" },
  { rank: 4, name: "PixelCrusher", score: 4980, country: "🇳🇬" },
  { rank: 5, name: "ComboDemon", score: 3840, country: "🇰🇪" },
  { rank: 6, name: "CyberTetra", score: 3100, country: "🇩🇪" },
  { rank: 7, name: "NovaPlayer", score: 2450, country: "🇦🇺" },
  { rank: 8, name: "ShadowDrop", score: 1980, country: "🇿🇦" },
  { rank: 9, name: "LuckyStrike", score: 1420, country: "🇨🇦" },
  { rank: 10, name: "NeonRider", score: 950, country: "🇮🇳" },
];

export const BASE_STAR_LEADERBOARD: StarLeaderboardEntry[] = [
  { rank: 1, name: "StarLord_99", stars: 60, country: "🇿🇦" },
  { rank: 2, name: "PuzzleWizard", stars: 57, country: "🇺🇸" },
  { rank: 3, name: "BlockQueen", stars: 54, country: "🇬🇧" },
  { rank: 4, name: "ApexBlaster", stars: 49, country: "🇿🇦" },
  { rank: 5, name: "ComboDemon", stars: 42, country: "🇰🇪" },
  { rank: 6, name: "GridMaster99", stars: 38, country: "🇬🇧" },
  { rank: 7, name: "PixelCrusher", stars: 33, country: "🇳🇬" },
  { rank: 8, name: "NovaPlayer", stars: 27, country: "🇦🇺" },
];

class LeaderboardManager {
  private modalEl: HTMLElement | null = null;
  private currentTab: "tourney" | "stars" = "tourney";
  private liveTourneyList: LeaderboardEntry[] | null = null;
  private liveStarList: StarLeaderboardEntry[] | null = null;
  private isFetchingLive = false;

  public getPlayerName(): string {
    return localStorage.getItem(PLAYER_NAME_KEY) || authManager.getUser() || "You";
  }

  public setPlayerName(name: string) {
    if (name.trim()) {
      localStorage.setItem(PLAYER_NAME_KEY, name.trim());
    }
  }

  public getTourneyBestScore(): number {
    return parseInt(localStorage.getItem(BEST_SCORE_KEY) || "0", 10);
  }

  public recordTourneyScore(newScore: number): boolean {
    const currentBest = this.getTourneyBestScore();
    if (newScore > currentBest) {
      localStorage.setItem(BEST_SCORE_KEY, String(newScore));
      return true;
    }
    return false;
  }

  public getPlayerRank(playerScore: number): number {
    const baseList = this.liveTourneyList || BASE_TOURNAMENT_LEADERBOARD;
    if (playerScore <= 0) return baseList.length + 1;
    for (let i = 0; i < baseList.length; i++) {
      if (playerScore >= baseList[i].score) {
        return i + 1;
      }
    }
    return baseList.length + 1;
  }

  public getPlayerStarRank(stars: number): number {
    const baseList = this.liveStarList || BASE_STAR_LEADERBOARD;
    if (stars <= 0) return baseList.length + 1;
    for (let i = 0; i < baseList.length; i++) {
      if (stars >= baseList[i].stars) {
        return i + 1;
      }
    }
    return baseList.length + 1;
  }

  public getTimeUntilWeeklyReset(): string {
    const now = new Date();
    // Sunday at 23:59:59 UTC
    const d = new Date(now);
    const day = d.getUTCDay();
    const diff = (7 - day) % 7 || 7;
    d.setUTCDate(d.getUTCDate() + diff);
    d.setUTCHours(23, 59, 59, 999);

    const ms = Math.max(0, d.getTime() - now.getTime());
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

    return `${days}d ${hours}h ${minutes}m left`;
  }

  public async fetchLive() {
    if (this.isFetchingLive) return;
    this.isFetchingLive = true;
    try {
      const activeTourneyId = tournamentConfigManager.getActiveTournamentId();
      const data = await fetchLiveLeaderboard("classic", activeTourneyId);
      if (data && Array.isArray(data.tournament)) {
        this.liveTourneyList = data.tournament;
      }
      if (data && Array.isArray(data.stars)) {
        this.liveStarList = data.stars;
      }
      if (this.modalEl && this.modalEl.classList.contains("active")) {
        this.render();
      }
    } catch (e) {
      console.warn("Could not fetch live leaderboard:", e);
    } finally {
      this.isFetchingLive = false;
    }
  }

  public show(tab: "tourney" | "stars" = "tourney") {
    this.currentTab = tab;
    if (!this.modalEl) {
      this.modalEl = document.createElement("div");
      this.modalEl.className = "modal-overlay leaderboard-modal-overlay";
      this.modalEl.id = "leaderboardModalOverlay";
      document.body.appendChild(this.modalEl);
    }

    this.render();
    this.modalEl.classList.add("active");
    this.fetchLive();
  }

  public hide() {
    if (this.modalEl) {
      this.modalEl.classList.remove("active");
    }
  }

  private render() {
    if (!this.modalEl) return;

    const playerScore = this.getTourneyBestScore();
    const playerRank = this.getPlayerRank(playerScore);
    const playerStars = levelProgress.getTotalStars();
    const playerStarRank = this.getPlayerStarRank(playerStars);
    const playerName = this.getPlayerName();
    const resetTime = this.getTimeUntilWeeklyReset();

    const baseTourney = this.liveTourneyList || BASE_TOURNAMENT_LEADERBOARD;
    const baseStars = this.liveStarList || BASE_STAR_LEADERBOARD;

    // Prepare Tournament List with Player inserted if ranked
    const tourneyList: LeaderboardEntry[] = [];
    let playerInserted = false;

    baseTourney.forEach((entry) => {
      if (!playerInserted && playerScore > 0 && playerScore >= entry.score) {
        tourneyList.push({
          rank: playerRank,
          name: `${playerName} (YOU)`,
          score: playerScore,
          country: "📍",
          isPlayer: true,
        });
        playerInserted = true;
      }
      tourneyList.push({
        ...entry,
        rank: playerInserted ? entry.rank + 1 : entry.rank,
      });
    });

    if (!playerInserted && playerScore > 0) {
      tourneyList.push({
        rank: playerRank,
        name: `${playerName} (YOU)`,
        score: playerScore,
        country: "📍",
        isPlayer: true,
      });
    }

    const tourneyRowsHTML = tourneyList
      .slice(0, 10)
      .map((item) => {
        let medal = `#${item.rank}`;
        if (item.rank === 1) medal = "🥇 1";
        else if (item.rank === 2) medal = "🥈 2";
        else if (item.rank === 3) medal = "🥉 3";

        return `
        <div class="lb-table-row ${item.isPlayer ? "player-highlight" : ""} ${item.rank <= 3 ? "top-three" : ""}">
          <span class="lb-col-rank">${medal}</span>
          <span class="lb-col-name">
            <span class="country-flag">${item.country || "🌐"}</span>
            <span class="player-label">${item.name}</span>
          </span>
          <span class="lb-col-score">${item.score.toLocaleString()} pts</span>
        </div>
      `;
      })
      .join("");

    const starRowsHTML = baseStars.slice(0, 10)
      .map((item) => {
        let medal = `#${item.rank}`;
        if (item.rank === 1) medal = "🥇 1";
        else if (item.rank === 2) medal = "🥈 2";
        else if (item.rank === 3) medal = "🥉 3";

        const isCurrent = item.name === "BlockQueen" && playerStars > 50;

        return `
        <div class="lb-table-row ${isCurrent ? "player-highlight" : ""} ${item.rank <= 3 ? "top-three" : ""}">
          <span class="lb-col-rank">${medal}</span>
          <span class="lb-col-name">
            <span class="country-flag">${item.country || "🌐"}</span>
            <span class="player-label">${item.name}</span>
          </span>
          <span class="lb-col-score star-score">⭐ ${item.stars} / 60</span>
        </div>
      `;
      })
      .join("");

    this.modalEl.innerHTML = `
      <div class="modal leaderboard-sheet">
        <!-- Header -->
        <div class="lb-modal-header">
          <div class="lb-header-title-box">
            <h2 class="lb-modal-title">🏆 Live Leaderboard</h2>
            <span class="lb-timer-pill">⏳ ${resetTime}</span>
          </div>
          <button id="closeLeaderboardBtn" class="close-x-btn" aria-label="Close">✕</button>
        </div>

        <!-- Weekly Prize Card -->
        <div class="lb-prize-banner">
          <div class="prize-badge">🎁 SPONSORED PRIZE EVENT</div>
          <div class="prize-title">1st Place wins: <strong>Cash Voucher & Hamper</strong></div>
          <div class="prize-sub">Top 5 qualify for the Sunday WhatsApp Grand Draw!</div>
        </div>

        <!-- Mode Toggle Tabs -->
        <div class="lb-nav-tabs">
          <button id="lbTabTourney" class="lb-tab ${this.currentTab === "tourney" ? "active" : ""}">
            🏆 Weekly Tournament
          </button>
          <button id="lbTabStars" class="lb-tab ${this.currentTab === "stars" ? "active" : ""}">
            ⭐ Adventure Stars
          </button>
        </div>

        <!-- Scrollable Table Content -->
        <div class="lb-table-container">
          <div id="lbTourneyContent" style="display: ${this.currentTab === "tourney" ? "block" : "none"}">
            <div class="lb-table-header">
              <span class="th-rank">RANK</span>
              <span class="th-player">PLAYER</span>
              <span class="th-score">BEST SCORE</span>
            </div>
            <div class="lb-table-body">
              ${tourneyRowsHTML}
            </div>
          </div>

          <div id="lbStarsContent" style="display: ${this.currentTab === "stars" ? "block" : "none"}">
            <div class="lb-table-header">
              <span class="th-rank">RANK</span>
              <span class="th-player">PLAYER</span>
              <span class="th-score">STARS EARNED</span>
            </div>
            <div class="lb-table-body">
              ${starRowsHTML}
            </div>
          </div>
        </div>

        <!-- Sticky Player Standing Footer (Mobile-First) -->
        <div class="lb-player-footer">
          <div class="player-footer-info">
            <span class="p-rank-pill">Your Rank: <strong>#${this.currentTab === "tourney" ? playerRank : playerStarRank}</strong></span>
            <span class="p-score-pill">
              ${
                this.currentTab === "tourney"
                  ? `Best: <strong>${playerScore.toLocaleString()}</strong> pts`
                  : `Stars: <strong>${playerStars} / 60</strong> ⭐`
              }
            </span>
          </div>

          <button id="lbClaimWhatsAppBtn" class="modal-button whatsapp-btn lb-cta-btn">
            💬 Claim Your Prize Spot via WhatsApp
          </button>
        </div>
      </div>
    `;

    document.getElementById("closeLeaderboardBtn")?.addEventListener("click", () => {
      this.hide();
    });

    document.getElementById("lbTabTourney")?.addEventListener("click", () => {
      this.currentTab = "tourney";
      this.render();
    });

    document.getElementById("lbTabStars")?.addEventListener("click", () => {
      this.currentTab = "stars";
      this.render();
    });

    document.getElementById("lbClaimWhatsAppBtn")?.addEventListener("click", () => {
      this.hide();
      authManager.show();
    });
  }
}

export const leaderboardManager = new LeaderboardManager();

// Backward compatibility helper for game-over modal
export function estimateRank(score: number): number {
  return leaderboardManager.getPlayerRank(score);
}

export function renderLeaderboardHTML(playerScore: number): string {
  const rank = leaderboardManager.getPlayerRank(playerScore);
  const rows = BASE_TOURNAMENT_LEADERBOARD.slice(0, 5)
    .map((item) => {
      const isCurrentRank = rank === item.rank;
      return `
      <div class="lb-row ${item.rank === 1 ? "gold" : ""} ${isCurrentRank ? "player-rank" : ""}">
        <span class="lb-rank">#${item.rank}</span>
        <span class="lb-name">${item.name} ${isCurrentRank ? "(YOU)" : ""}</span>
        <span class="lb-score">${item.score.toLocaleString()}</span>
      </div>
    `;
    })
    .join("");

  const conf = tournamentConfigManager.getConfig();
  return `
    <div class="leaderboard-preview">
      <div class="lb-header">${conf.sponsorName} ${conf.tournamentTitle} Top 5</div>
      <div class="lb-list">
        ${rows}
      </div>
    </div>
  `;
}
