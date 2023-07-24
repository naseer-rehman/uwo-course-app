import path from "path";
import fs from "fs";
import axios from "axios";
import { load } from "cheerio";
import { toCamelCase, firstWord } from "./stringUtils";

interface SubjectMappingObject {
  [key: string]: string,
}

const subjectMappingJSONPath = path.join(
  "resources", "timetableSubjectMapping.json"
);

let subjectMapping: SubjectMappingObject = JSON.parse(
  fs.readFileSync(subjectMappingJSONPath, "utf8")
);

/**
 * Generates a JSON file containing mappings from subject codes used in this program
 * to a subject code used in Western's websites/applications.
 * @param {string} outputFileName the name of the output JSON file
 */
async function generateTimetableSubjectMappingJSON(outputFileName = "timetableSubjectMapping") {
  const PAGE_URL = "https://studentservices.uwo.ca/secure/timetables/mastertt/ttindex.cfm";
  const pageData = await axios.get(PAGE_URL);
  const $ = await load(pageData.data);
  const subjectOptions = await $("#inputSubject").children("option");
  const mapping: SubjectMappingObject = {};
  
  for (let i = 0; i < subjectOptions.length; ++i) {
    const option = subjectOptions[i];
    if (option.attribs?.value && option.attribs.value.length > 0) {
      if (!option.firstChild) {
        throw new Error("Subject option has no first child");
      }
      if ("data" in option.firstChild) {
        mapping[toCamelCase(option.firstChild.data)] = firstWord(option.attribs.value);
      } else {
        throw new Error("No data in firstChild of the subject option");
      }
    }
  }
  fs.writeFileSync(`${outputFileName}.json`, JSON.stringify(mapping), "utf8");
}

function has(key: string): boolean {
  return subjectMapping.hasOwnProperty(key);
}

function hasFromName(key: string): boolean {
  return has(toCamelCase(key));
}

function get(key: string): string | null {
  return has(key) ? subjectMapping[key] : null;
}

function getFromName(name: string): string | null {
  return get(toCamelCase(name));
}

/**
 * Returns all the keys in a list.
 */
function getAllKeys(): string[] {
  return Object.keys(subjectMapping);
}

const subjectCodes = {
  has,
  hasFromName,
  get,
  getFromName,
  getAllKeys,
  generateMappingFile: generateTimetableSubjectMappingJSON,
};

export default subjectCodes;