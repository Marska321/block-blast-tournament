import { route } from "../server/http.js";
import { claims } from "../server/routes.js";
export default route("GET", claims, "required");
