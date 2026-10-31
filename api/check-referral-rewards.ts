import { route } from "../server/http.js";
import { balance } from "../server/routes.js";
export default route("GET", balance, "required");
