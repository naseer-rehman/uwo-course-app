import path from "path";
import fs from "fs";
import * as cheerio from "cheerio";
import { toCamelCase, firstWord } from "./utils/stringUtils";

interface SubjectMappingObject {
  [key: string]: string,
};

const subjectMappingJSONPath = path.join(
  "resources", "timetableSubjectMapping.json"
);

let subjectMapping: SubjectMappingObject = JSON.parse(
  fs.readFileSync(subjectMappingJSONPath, "utf8")
);

async function getTimetableSubjectMapping() {
  const PAGE_URL = "https://studentservices.uwo.ca/secure/timetables/mastertt/ttindex.cfm";
  const $ = await cheerio.fromURL(PAGE_URL);
  const subjectOptions = await $("#inputSubject").children("option");
  const mapping: SubjectMappingObject = {};

  for (const optionElement of subjectOptions) {
    const option = await $(optionElement);
    const optionValue = option.attr("value");
    if (optionValue && optionValue.length > 0) {
      const optionText = option.prop("innerText");
      if (!optionText) {
        throw new Error("Subject option does not have inner text");
      }
      mapping[toCamelCase(optionText)] = firstWord(optionValue);
    }
  }
  return mapping;
}

/**
 * Generates a JSON file containing mappings from subject codes used in this program
 * to a subject code used in Western's websites/applications.
 * @param {string} outputFileName the name of the output JSON file
 */
async function generateTimetableSubjectMappingJSON(outputFileName = "timetableSubjectMapping") {
  const updatedSubjectMapping = await getTimetableSubjectMapping();
  fs.writeFileSync(`${outputFileName}.json`, JSON.stringify(updatedSubjectMapping), "utf8");
}

function has(key: string): boolean {
  return subjectMapping.hasOwnProperty(key);
}

function hasFromName(key: string): boolean {
  return has(toCamelCase(key));
}

function get(key: string): string | null {
  if (!has(key)) return null;
  const val = subjectMapping[key];
  if (!val) throw Error("Subject mapping has key but falsey value?");
  return val;
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