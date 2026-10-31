import { route } from "../server/http.js";
import { referral } from "../server/routes.js";
export default route("POST", referral, "required");
