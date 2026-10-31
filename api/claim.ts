import { route } from "../server/http.js";
import { createClaim } from "../server/routes.js";
export default route("POST", createClaim, "required");
