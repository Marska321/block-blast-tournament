import { createHash } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { database, uuid } from "../server/http.js";
import { askClaimPhone } from "./claim-input.js";

// Local operator tool only. Credentials must never be VITE_ variables or browser assets.
const terminal = createInterface({ input: stdin, output: stdout });
try {
  const mode = process.argv[2] || "inspect";
  if (!["inspect", "review"].includes(mode))
    throw new Error("Use: npm run claims -- inspect|review");
  const db = database();
  const id = uuid((await terminal.question("Claim reference: ")).trim());
  const { data: claim, error } = await db
    .from("pilot_claims")
    .select("id,event_id,user_id,status,requested_at,code_expires_at")
    .eq("id", id)
    .single();
  if (error || !claim) throw new Error("Claim not found.");
  const { data: event } = await db
    .from("pilot_events")
    .select("title,prize_pool,ends_at,is_demo")
    .eq("id", claim.event_id)
    .single();
  const { data: standings, error: standingsError } = await db.rpc(
    "pilot_standings",
    { p_event: claim.event_id, p_user: claim.user_id },
  );
  if (standingsError) throw new Error("Could not retrieve accepted standings.");
  const standing = standings.find(
    (s: { user_id: string }) => s.user_id === claim.user_id,
  );
  const { data: run } = standing
    ? await db
        .from("pilot_runs")
        .select("id,created_at,accepted_at,engine_version,result")
        .eq("id", standing.run_id)
        .single()
    : { data: null };
  console.log(
    JSON.stringify(
      {
        claim: claim.id,
        status: claim.status,
        event: event?.title,
        prizePool: event?.prize_pool,
        demo: event?.is_demo,
        standing,
        replaySummary: run,
      },
      null,
      2,
    ),
  );
  if (mode === "review") {
    if (claim.status !== "pending")
      throw new Error("This claim has already been reviewed.");
    const code = (
      await terminal.question("Code received in the WhatsApp message: ")
    ).trim();
    const phone = await askClaimPhone(
      (prompt) => terminal.question(prompt),
      (message) => console.log(message),
    );
    const name = (
      await terminal.question("Private payout name (required for approval): ")
    ).trim();
    const adult =
      (
        await terminal.question(
          "Adult eligibility manually checked? Type yes: ",
        )
      ).trim() === "yes";
    const reviewed =
      (
        await terminal.question(
          "Result and abuse/duplicate-account checks completed? Type yes: ",
        )
      ).trim() === "yes";
    const decision = (
      await terminal.question("Decision: approved or rejected: ")
    ).trim();
    const reason = (
      await terminal.question(
        "Reason shown to the claimant (do not include private details): ",
      )
    ).trim();
    const { data, error: reviewError } = await db.rpc("pilot_review_claim", {
      p_claim: id,
      p_hash: createHash("sha256").update(code).digest("hex"),
      p_phone: phone,
      p_name: name,
      p_adult: adult,
      p_result_reviewed: reviewed,
      p_decision: decision,
      p_reason: reason,
    });
    if (reviewError) {
      const known = [
        "claim_unavailable",
        "claim_code_invalid",
        "claim_window_closed",
        "not_eligible",
        "review_reason_required",
        "invalid_phone",
        "review_required",
        "duplicate_phone_review",
      ];
      const explanations: Record<string, string> = {
        invalid_phone: "Review not saved: enter the sender number with + and the country code, for example +27 followed by the number without its initial 0.",
        claim_code_invalid: "Review not saved: the code is incorrect, expired, or replaced. Request a fresh code in the game and use the latest WhatsApp message.",
        review_reason_required: "Review not saved: use approved or rejected as the decision and enter a reason of at least five characters.",
      };
      throw new Error(
        explanations[reviewError.message] || (known.includes(reviewError.message)
          ? reviewError.message
          : "Review was not saved. No payment action was taken."),
      );
    }
    console.log(
      `Claim ${id}: ${data}. Payments remain a separate manual operation.`,
    );
  }
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Claim operation failed.",
  );
  process.exitCode = 1;
} finally {
  terminal.close();
}
