export interface GameMove {
  pieceIdx: number;
  gx: number;
  gy: number;
  lines: number;
  points: number;
  t: number; // elapsed milliseconds since game start
}

export interface SessionData {
  sessionId: string;
  seed: number;
  moves: GameMove[];
  finalScore: number;
  startTime: number;
  endTime: number;
  durationMs: number;
}

class TournamentSessionManager {
  private currentSession: SessionData | null = null;
  private gameStartTime: number = 0;

  public startSession(customSeed?: number): SessionData {
    const seed =
      customSeed !== undefined
        ? customSeed
        : Math.floor(Math.random() * 2147483647);
    const sessionId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : "sess_" + Date.now() + "_" + Math.floor(Math.random() * 10000);

    this.gameStartTime = Date.now();
    this.currentSession = {
      sessionId,
      seed,
      moves: [],
      finalScore: 0,
      startTime: this.gameStartTime,
      endTime: 0,
      durationMs: 0,
    };

    return this.currentSession;
  }

  public logMove(
    pieceIdx: number,
    gx: number,
    gy: number,
    lines: number,
    points: number,
  ) {
    if (!this.currentSession) return;
    this.currentSession.moves.push({
      pieceIdx,
      gx,
      gy,
      lines,
      points,
      t: Date.now() - this.gameStartTime,
    });
  }

  public finishSession(finalScore: number): SessionData | null {
    if (!this.currentSession) return null;
    this.currentSession.finalScore = finalScore;
    this.currentSession.endTime = Date.now();
    this.currentSession.durationMs =
      this.currentSession.endTime - this.currentSession.startTime;
    return this.currentSession;
  }

  public getSessionData(): SessionData | null {
    return this.currentSession;
  }

  /**
   * Stub for submitting the session to the server.
   * In production, this issues a POST request with the move replay log.
   */
  public async submitScore(
    userIdentifier?: string,
  ): Promise<{ success: boolean; rank?: number }> {
    if (!this.currentSession) return { success: false };

    console.log("[Tournament API Stub] Submitting verified session:", {
      user: userIdentifier || "guest",
      sessionId: this.currentSession.sessionId,
      seed: this.currentSession.seed,
      moveCount: this.currentSession.moves.length,
      finalScore: this.currentSession.finalScore,
      durationMs: this.currentSession.durationMs,
    });

    // Mock API response delay
    await new Promise((resolve) => setTimeout(resolve, 300));
    return {
      success: true,
      rank: Math.floor(Math.random() * 5) + 2, // simulated rank for demo
    };
  }
}

export const sessionManager = new TournamentSessionManager();
