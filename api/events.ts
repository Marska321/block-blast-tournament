import { route, type ApiRequest, type ApiResponse } from "../server/http.js";
import { events } from "../server/routes.js";
import { updatesRoute } from "../server/updates.js";
const official = route("GET", events, "none");
// Reuse a function to stay within the existing hosting function budget.
export default function eventsRoute(req: ApiRequest, res: ApiResponse) {
  return req.query.channel === "updates" ? updatesRoute(req, res) : official(req, res);
}
