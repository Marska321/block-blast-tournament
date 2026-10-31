import { route } from "../server/http.js";
import { leaderboard } from "../server/routes.js";
export default route("GET", leaderboard, "optional");
