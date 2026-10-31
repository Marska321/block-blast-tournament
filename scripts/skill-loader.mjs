import { pathToFileURL } from "node:url";
import path from "node:path";
export function resolve(specifier, context, nextResolve) {
  if (specifier === "playwright")
    return {
      url: pathToFileURL(path.resolve("node_modules/playwright/index.mjs"))
        .href,
      shortCircuit: true,
    };
  return nextResolve(specifier, context);
}
