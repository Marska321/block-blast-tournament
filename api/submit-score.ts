import { route } from "../server/http.js";
import { submit } from "../server/routes.js";
export default route("POST", submit, "required");
