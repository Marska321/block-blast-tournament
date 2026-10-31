import { readFile } from "node:fs/promises";
import { updatesDatabase, validateAnnouncement, dispatchUpdates } from "../server/updates.js";
import { uuid } from "../server/http.js";

// Operator-only CLI. Never bundled or served; uses the server service credential.
const [command = "list", argument, action] = process.argv.slice(2);
try {
  if (!["list", "draft", "publish", "cancel", "dispatch"].includes(command))
    throw new Error("Use npm run updates -- list|draft file.json|publish id --send|publish id --schedule|cancel id|dispatch");
  if (command === "publish" && !["--send", "--schedule"].includes(action))
    throw new Error("Choose --send for immediate delivery or --schedule for the daily delivery window.");
  const db = updatesDatabase();
  if (command === "list") {
    const result = await db.from("game_announcements").select("id,title,message,path,published,publish_at,expires_at").order("created_at", { ascending: false }).limit(30);
    if (result.error) throw new Error("Could not load announcements.");
    const subscriptions = await db.from("game_push_subscriptions").select("id", { count: "exact", head: true });
    if (subscriptions.error) throw new Error("Could not count subscribers.");
    console.log(JSON.stringify({ subscribers: subscriptions.count, announcements: result.data }, null, 2));
  } else if (command === "draft") {
    const input = validateAnnouncement(JSON.parse(await readFile(argument, "utf8")));
    const result = await db.from("game_announcements").insert(input).select("id,title,message,path,publish_at,expires_at").single();
    if (result.error) throw new Error("Could not create draft.");
    console.log(JSON.stringify({ draft: result.data, published: false, sent: false }, null, 2));
  } else if (command === "publish") {
    const id = uuid(argument);
    const result = await db.from("game_announcements").select("*").eq("id", id).single();
    if (result.error || !result.data) throw new Error("Announcement not found.");
    validateAnnouncement(result.data);
    if (new Date(result.data.expires_at).getTime() <= Date.now()) throw new Error("Announcement has expired. Create a new draft.");
    if (action === "--send" && new Date(result.data.publish_at).getTime() > Date.now()) throw new Error("This announcement is scheduled for the future. Use --schedule or change the draft.");
    const update = await db.from("game_announcements").update({ published: true }).eq("id", id);
    if (update.error) throw new Error("Could not publish announcement.");
    console.log(action === "--send" ? JSON.stringify(await dispatchUpdates(db)) : "Scheduled. Feed appears at publish_at; push is delivered during the next daily window. Exact-time push is not configured.");
  } else if (command === "cancel") {
    const result = await db.from("game_announcements").update({ published: false }).eq("id", uuid(argument)).select("id").single();
    if (result.error) throw new Error("Could not cancel announcement.");
    console.log("Announcement hidden and queued delivery stopped. Already delivered notifications cannot be recalled.");
  } else console.log(JSON.stringify(await dispatchUpdates(db)));
} catch (error) {
  // Never print provider/database error objects containing subscription data.
  console.error(error instanceof Error ? error.message : "Announcement operation failed.");
  process.exitCode = 1;
}
