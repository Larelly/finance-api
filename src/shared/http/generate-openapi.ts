import { writeFileSync } from "node:fs";
import { buildOpenApiDocument } from "./openapi.js";

const document = buildOpenApiDocument();
writeFileSync("openapi.json", JSON.stringify(document, null, 2));
console.log("openapi.json written");
