import * as fs from "fs/promises";
import * as path from "path";
import * as prettier from "prettier";
import * as TJS from "typescript-json-schema";

const settings: TJS.PartialArgs = {
  required: true,
};
const program = TJS.programFromConfig(path.resolve("tsconfig.json"));
const typeName = "DeviceConfig";
const schema = TJS.generateSchema(program, typeName, settings);

if (!schema) process.exit(1);

const schemaString = await prettier.format(JSON.stringify(schema), {
  parser: "json",
});
await fs.writeFile(path.resolve("config-schema.json"), schemaString);
