import { route, type ApiRequest, type ApiResponse } from "../server/http.js";
import { classicBoard, classicWrite } from "../server/classic.js";

// One Vercel function keeps this within the existing project's function budget.
const read = route("GET", classicBoard, "optional", "classic");
const write = route("POST", classicWrite, "required", "classic");
export default function classic(req: ApiRequest, res: ApiResponse) {
  return req.method === "GET" ? read(req, res) : write(req, res);
}
