import * as cheerio from 'cheerio';
import axios, { AxiosRequestConfig } from "axios";
import path, { dirname } from "path";
import { fileURLToPath } from 'url';
import fs from "fs";

interface SubjectMapping {
  [key: string]: string,
}

interface CourseOfferingData {
  // To be completed...
}

// Workaround for getting __dirname which isn't available readily for ESModules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let subjectMapping: SubjectMapping = {};

/**
 * Reads the subjectMapping.json file and loads it into memory.
 * @returns 
 */
function initializeSubjectMapping(): void {
  if (Object.keys(subjectMapping).length !== 0) {
    return;
  }
  const subjectMappingJSONPath = path.join(__dirname, "..", "subjectMapping.json");
  subjectMapping = JSON.parse(fs.readFileSync(subjectMappingJSONPath, "utf8"));
}

/**
 * Obtain the course offering information for a subject.
 * @param {string} subject the subject code, must be a key in subject mapping JSON file
 */
async function getPageDataForSubject(subject:string) {
  const PAGE_URL = "https://studentservices.uwo.ca/secure/timetables/mastertt/ttindex.cfm";
  if (subjectMapping.hasOwnProperty(subject)) {
    const config: AxiosRequestConfig = {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    };
    const data = `subject=${subjectMapping[subject]}&Designation=Any&catalognbr=&CourseTime=All&Component=All&time=&end_time=&day=m&day=tu&day=w&day=th&day=f&LocationCode=Any&command=search`;
    const pageData = await axios.post(PAGE_URL, data, config);
    return pageData;
  } else {
    throw new Error("Invalid subject");
  }
};

/**
 * Generates a JSON file containing mappings from subject codes used in this program
 * to a subject code used in Western's websites/applications.
 * @param {string} outputFileName the name of the output JSON file
 */
async function generateSubjectMappingJSON(outputFileName = "subjectMapping") {
  const PAGE_URL = "https://studentservices.uwo.ca/secure/timetables/mastertt/ttindex.cfm";
  const pageData = await axios.get(PAGE_URL);
  const $ = await cheerio.load(pageData.data);
  const subjectOptions = await $("#inputSubject").children("option");
  const mapping: SubjectMapping = {};
  const keyify = (name: string) => {
    // Extract only alphabetical words
    const words = name.match(/\w+/g);
    if (words === null) {
      throw new Error(`No words found in string "${name}"`);
    }
    // camelCase-ify the words
    words[0] = words[0].toLowerCase();
    for (let i = 1; i < words.length; ++i) {
      words[i] = words[i].charAt(0).toUpperCase() + words[i].substring(1);
    }
    return words.join("");
  };
  const stripValue = (value: string) => {
    const matches = value.match(/\w+/);
    if (matches === null) {
      throw new Error(`Found no words in the provided string: "${value}"`);
    }
    return matches[0];
  };
  for (let i = 0; i < subjectOptions.length; ++i) {
    const option = subjectOptions[i];
    if (option.attribs?.value && option.attribs.value.length > 0) {
      if (!option.firstChild) {
        throw new Error("Subject option has no first child");
      }
      if ("data" in option.firstChild) {
        mapping[keyify(option.firstChild.data)] = stripValue(option.attribs.value);
      } else {
        throw new Error("No data in firstChild of the subject option");
      }
    }
  }
  fs.writeFileSync(`${outputFileName}.json`, JSON.stringify(mapping), "utf8");
}

/**
 * Get course offering data for a given subject code
 * @param subject the subject code in camel-case, no spaces
 */
async function getCourseOfferingDataForSubject(subject: string) {
  const courseHeaderRegex = /(([A-Z]+\s*\d+)([A-Z]*))\s*-\s*(.+)/;
  
  // const getCourseOfferingData = async (courseHeader: cheerio.Element) => {
  //   let courseDescriptionElement = courseHeader.nextSibling;
  //   while (courseDescriptionElement !== null 
  //     && courseDescriptionElement.type !== "tag") {
  //     courseDescriptionElement = courseDescriptionElement.next;
  //   }
  //   if (courseDescriptionElement === null) {
  //     throw new Error("Could not find course description element in DOM");
  //   }

  //   const headerText = courseHeader.firstChild.data;
  //   if (courseHeader.firstChild && courseHeader.firstChild.data) {

  //   }
  //   const headerTextMatches = headerText.match(courseHeaderRegex);
  //   if (!headerTextMatches) {
  //     throw new Error("Could not match courseHeaderRegex with the course header");
  //   }
  //   let courseOffering = headerTextMatches[1];
  //   let courseCode = headerTextMatches[2];
  //   let courseOfferingSuffix = (headerTextMatches[3] === "" ? null : headerTextMatches[3]);
  //   let courseName = headerTextMatches[4];
  //   let courseDescription = courseDescriptionElement.lastChild.data.trim();
  //   // todo: split the course description and extract antirequisites + extra information
  //   let courseOfferingSections = [];
    
  //   let courseOfferingSectionsTable = courseDescriptionElement.next;
  //   while (courseOfferingSectionsTable.type !== "tag") {
  //     courseOfferingSectionsTable = courseOfferingSectionsTable.next;
  //   }
  //   let courseOfferingSectionsTableBody;
  //   for (let i = 0; i < courseOfferingSectionsTableBody.length; ++i) {
  //     const child = courseOfferingSectionsTableBody[i];
  //     console.log("type: ", child.type);
  //     if (child.type === "tbody") {

  //     }
  //   }

  //   return {
  //     courseOffering: courseOffering,
  //     courseCode: courseCode,
  //     courseOfferingSuffix: courseOfferingSuffix,
  //     courseName: courseName,
  //     courseDescription: courseDescription,
  //     courseOfferingSections: courseOfferingSections,
  //   };
  // };

  const getCourseOfferingDatav2 = async (headers: cheerio.Cheerio<cheerio.Element>) => {
    console.log(headers.text());
  }

  if (subject in subjectMapping === false) {
    throw new Error("Invalid subject");
  }
  const subjectCode = subjectMapping[subject];
  const pageData = await getPageDataForSubject(subject);
  const $ = await cheerio.load(pageData.data);
  const courseHeaders = await $("div.span12 > h4");
  let courseOfferingData = getCourseOfferingDatav2(courseHeaders);
  // for (let i = 0; i < courseHeaders.length; ++i) {
  //   console.log(`Getting header ${i + 1}`);
  //   courseOfferingData.push(await getCourseOfferingData(courseHeaders[i]));
  //   break;
  // }
  console.log(courseOfferingData);
}

async function main() {
  initializeSubjectMapping();
  const subject = "calculus";
  const courseOfferingData = await getCourseOfferingDataForSubject(subject);
}

main();