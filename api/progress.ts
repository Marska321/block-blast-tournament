import { route } from "../server/http.js";
import { progress } from "../server/routes.js";
export default route("GET", progress, "required");
