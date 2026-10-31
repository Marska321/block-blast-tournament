import { route } from "../server/http.js";
import { start } from "../server/routes.js";
export default route("POST", start, "required");
