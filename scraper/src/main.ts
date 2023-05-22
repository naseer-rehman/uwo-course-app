import * as cheerio from 'cheerio';
import axios, { AxiosRequestConfig } from "axios";
import path, { dirname } from "path";
import { fileURLToPath } from 'url';
import fs from "fs";

interface TimetableSubjectMapping {
  [key: string]: string,
}

interface CourseOfferingData {
  // To be completed...
}

// Workaround for getting __dirname which isn't available readily for ESModules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let timetableSubjectMapping: TimetableSubjectMapping = {};

/**
 * Reads the timetableSubjectMapping.json file and loads it into memory.
 * @returns 
 */
function initializeTimetableSubjectMapping(): void {
  if (Object.keys(timetableSubjectMapping).length !== 0) {
    return;
  }
  const subjectMappingJSONPath = path.join(__dirname, "..", "timetableSubjectMapping.json");
  timetableSubjectMapping = JSON.parse(fs.readFileSync(subjectMappingJSONPath, "utf8"));
}

/**
 * Reads the courseCalendarSubjectMapping.json file and loads it into memory.
 * @returns 
 */
function initializeCourseCalendarSubjectMapping(): void {
  if (Object.keys(timetableSubjectMapping).length !== 0) {
    return;
  }
  const subjectMappingJSONPath = path.join(__dirname, "..", "courseCalendarSubjectMapping.json");
  timetableSubjectMapping = JSON.parse(fs.readFileSync(subjectMappingJSONPath, "utf8"));
}

/**
 * Turns a regular course name into a valid camelCase key for the subject mapping
 */
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

/**
   * Takes only the first "word" made up of alphanumeric characters and removes the rest of the string 
   * @param value the string value
   * @returns the stripped string value
   */
const stripValue = (value: string) => {
  const matches = value.match(/\w+/);
  if (matches === null) {
    throw new Error(`Found no words in the provided string: "${value}"`);
  }
  return matches[0];
};

/**
 * Generates a JSON file containing mappings from subject codes used in this program
 * to a subject code used in Western's websites/applications.
 * @param {string} outputFileName the name of the output JSON file
 */
async function generateTimetableSubjectMappingJSON(outputFileName = "timetableSubjectMapping") {
  const PAGE_URL = "https://studentservices.uwo.ca/secure/timetables/mastertt/ttindex.cfm";
  const pageData = await axios.get(PAGE_URL);
  const $ = await cheerio.load(pageData.data);
  const subjectOptions = await $("#inputSubject").children("option");
  const mapping: TimetableSubjectMapping = {};
  
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
 * Obtain the course offering information for a subject.
 * @param {string} subject the subject code, must be a key in subject mapping JSON file
 */
async function getTimetablePageDataForSubject(subject:string) {
  const PAGE_URL = "https://studentservices.uwo.ca/secure/timetables/mastertt/ttindex.cfm";
  if (timetableSubjectMapping.hasOwnProperty(subject)) {
    const config: AxiosRequestConfig = {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    };
    const data = `subject=${timetableSubjectMapping[subject]}&Designation=Any&catalognbr=&CourseTime=All&Component=All&time=&end_time=&day=m&day=tu&day=w&day=th&day=f&LocationCode=Any&command=search`;
    const pageData = await axios.post(PAGE_URL, data, config);
    return pageData;
  } else {
    throw new Error("Invalid subject");
  }
};

/**
 * Work in progress
 * @param subject 
 */
async function getCourseCalendarPageDataForSubject(subject: string) {
  if (!(subject in timetableSubjectMapping)) {
    throw new Error("Invalid subject");
  }
  const timetableSubjectCode = timetableSubjectMapping[subject];
  const PAGE_URL = `https://www.westerncalendar.uwo.ca/Courses.cfm?Subject=${timetableSubjectCode}&SelectedCalendar=Live&ArchiveID=`;
  const pageData = await axios.get(PAGE_URL);
  return pageData;
}

/**
 * Retrieves the links to each course with the given subject. These links
 * will point to the information page for each of the courses in the given subject.
 * @param subject 
 */
async function getCourseInformationLinksForSubject(subject: string) {
  const pageData = await getCourseCalendarPageDataForSubject(subject);
  const $ = await cheerio.load(pageData.data);
  const anchorsForCourseInformation = $(".col-md-12 .panel-body .col-xs-12:last-of-type a");
  const linksForCourseInformation = [];
  const isElementOfCorrectType = (elem: cheerio.Element) => {
    const pattern = /Courses\.cfm\?CourseAcadCalendarID=.+?&SelectedCalendar=Live&ArchiveID=/g;
    if (!("name" in elem && elem.name == "a" && "href" in elem.attribs)) return false;
    return !!elem.attribs.href.match(pattern);
  };
  for (const elem of anchorsForCourseInformation) {
    if (isElementOfCorrectType(elem)) {
      // Then we add the links from each of these anchor elements to a list so we can gather the data
      linksForCourseInformation.push(`https://www.westerncalendar.uwo.ca/${elem.attribs.href}`);
    } else {
      throw new Error("Retrieved a non-anchor element from the course calendar page");
    }
  }
  return linksForCourseInformation;
}

/**
 * Retrieves all the information of a course from its information page provided as a link.
 * @param link 
 */
async function getCourseInformationFromLink(link: string) {
  const pageData = await axios.get(link);
  const $ = cheerio.load(pageData.data);
  const courseCodeHeader = $("#CourseInformationDiv > div.col-md-12 > h2");
  const courseNameHeader = $("#CourseInformationDiv > div.col-md-12 > h3");
  const courseDescriptionElement = $(`#CourseInformationDiv > div > label[for="CourseDescription"] + div`);
  const preOrCoRequisitesHeader = $(`#CourseInformationDiv > div > label[for="Antirequisites"] + div`);
  const antirequisitesContainer = $(`#CourseInformationDiv > div > label[for="Antirequisites"] + div`);
  const extraInformationContainer = $(`#CourseInformationDiv > div > label[for="ExtraInformation"] + div`);
  const courseWeightHeader = $("#CourseInformationDiv > div:nth-child(13) > h5:nth-child(1)");
  const breadthInformationHeader = $("#CourseInformationDiv > div:nth-child(13) > h5:nth-child(2)");
  const subjectCodeHeader = $("#CourseInformationDiv > div:nth-child(13) > h5:nth-child(3)");
  console.log(
    courseCodeHeader,
    courseNameHeader,
    courseDescriptionElement,
    preOrCoRequisitesHeader,
    antirequisitesContainer,
    extraInformationContainer,
    courseWeightHeader,
    breadthInformationHeader,
    subjectCodeHeader
  );
  return {
    name: "some name",
    courseCode: "SOMECODE 4411",
    subjectCode: "SUBJECTCODE",
    courseNumber: "4411",
    subject: "Some Subject",
    courseWeight: 0.5,
    breadth: "C",
    extraInformation: "3 lecture hours",
    prerequisites: "not sure if this is a list or text",
    corequisites: "not sure if this is a list or text",
    essayCourse: false,
    validSuffixes: ["A", "B", "C"], // This information doesn't seem like its available from this page
  }
}

/**
 * Get the information for all courses offered by Western.
 * @returns TBD
 */
async function getCourseInformationDataForSubject(subject: string) {
  const links = await getCourseInformationLinksForSubject(subject);
  for (const link of links) {
    const courseInformation = await getCourseInformationFromLink(link);
    break; // Remove this once we are able to reliably scrape the course information data
  }
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
    // console.log(headers.text());
    
  }

  if (subject in timetableSubjectMapping === false) {
    throw new Error("Invalid subject");
  }
  const subjectCode = timetableSubjectMapping[subject];
  const pageData = await getTimetablePageDataForSubject(subject);
  const $ = await cheerio.load(pageData.data);
  const courseHeaders = await $("div.span12 > h4");
  let courseOfferingData = await getCourseOfferingDatav2(courseHeaders);
}

async function main() {
  initializeTimetableSubjectMapping();
  const subject = "persian";
  const courseInformationData = await getCourseInformationDataForSubject(subject);
  // const courseOfferingData = await getCourseOfferingDataForSubject(subject);
}

main();