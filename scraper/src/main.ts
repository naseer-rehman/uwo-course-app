// TODO: sneak Munna into here
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
 * @param time 
 * @returns a promise that resolves in the specified time
 */
const promiseTimeout = (time: number): Promise<null> => {
  return new Promise(resolve => setTimeout(() => resolve(null), time * 1000));
};

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
  let pageData = null;
  try {
    pageData = await axios.get(link);
  } catch (error: any) {
    console.log(error.toJSON());
  }
  if (!pageData) return;
  const $ = cheerio.load(pageData.data);
  // Selections for each element we need to extract information from
  // Not sure what else to call this and I don't have time to think
  const normalNameHeader = $("#CourseInformationDiv > div.col-md-12:first-of-type > h2");
  const courseNameHeader = $("#CourseInformationDiv > div.col-md-12:first-of-type > h3");
  // This selection should include both the course description div and the 
  // pre/corequisite information div.
  const courseDescriptionLabelSelection = $(`#CourseInformationDiv > .col-xs-12 > label[for="CourseDescription"] + div`);
  const antirequisitesContainer = $(`#CourseInformationDiv > div > label[for="Antirequisites"] + div`);
  const extraInformationContainer = $(`#CourseInformationDiv > div > label[for="ExtraInformation"] + div`);
  const courseWeightHeader = $("#CourseInformationDiv > .col-xs-12:last-of-type > h5:nth-child(1)");
  const breadthInformationHeader = $("#CourseInformationDiv > .col-xs-12:last-of-type > h5:nth-child(2)");
  const subjectCodeHeader = $("#CourseInformationDiv > .col-xs-12:last-of-type > h5:nth-child(3)");

  /* Contains logic to assert we get matches for the selections above, might use, might not.
  const assertNonEmptySets = (...args: cheerio.Cheerio<cheerio.Element>[]) => {
    const areNonEmpty = args.reduce((prev, item) => (prev && item.length > 0), true);
    if (areNonEmpty === false) 
      throw new Error("At least one selection from course calendar page did not get a match");
  };

  assertNonEmptySets(
    courseCodeHeader, courseNameHeader, 
    courseDescriptionLabelSelection, antirequisitesContainer,
    extraInformationContainer, courseWeightHeader,
    breadthInformationHeader, subjectCodeHeader
  );
  */
  
  const courseDescriptionDiv = $(courseDescriptionLabelSelection[0]);
  let preOrCorequisitesDiv: cheerio.Cheerio<cheerio.Element> | null = null;
  if (courseDescriptionLabelSelection.length > 1) {
    preOrCorequisitesDiv = $(courseDescriptionLabelSelection[1]);
  }

  const normalNameWithCodePattern = /\w+\s+(\d+)((?:[A-Z]\/?)+)/g;

  const normalNameWithCourseCode = normalNameHeader.first().text().trim();
  const courseName = courseNameHeader.first().text().trim();

  // this will contain the course number and the suffixes for the course
  const normalNameWithCourseCodeMatchesList = [
    ...normalNameWithCourseCode.matchAll(normalNameWithCodePattern)
  ];
  if (!normalNameWithCourseCodeMatchesList 
    || normalNameWithCourseCodeMatchesList.length <= 0) {
    throw new Error("Normal name with course code did not match the pattern");
  }
  const normalNameWithCourseCodeMatches = normalNameWithCourseCodeMatchesList[0];
  
  const extractSuffixesFromListInHeader = (suffixList: string): string[] => {
    const listOfSuffixes: string[] = [];
    // Matches all capital letters and possibly a forwards slash after 
    const capitalsPattern = /(?:([A-Z])\/?)/g;
    const matches = Array.from(suffixList.matchAll(capitalsPattern));
    if (!matches || matches.length <= 0) return [];
    for (const match of matches) {
      // Second element is the captured group, aka the suffix we want to extract
      listOfSuffixes.push(match[1]);
    }
    return listOfSuffixes;
  }

  const courseNumber = normalNameWithCourseCodeMatches[1];
  const validSuffixes = extractSuffixesFromListInHeader(normalNameWithCourseCodeMatches[2]);
  const courseDescription = courseDescriptionDiv.text().trim();
  const getBoldedInformationLabelText = (set: cheerio.Cheerio<cheerio.Element> | null): string | null => {
    if (set !== null && set.length > 0) {
      return set.text().trim();
    }
    return null;
  }
  const antirequisites = getBoldedInformationLabelText(antirequisitesContainer);
  // TODO: Find out if this needs to be split up into prerequisites/corequisites
  const preOrCorequisites = getBoldedInformationLabelText(preOrCorequisitesDiv);
  const extraInformation = getBoldedInformationLabelText(extraInformationContainer);
  console.log(preOrCorequisitesDiv?.text().trim());
  // console.log(antirequisites,preOrCorequisites,extraInformation);
  const getSmallLabelText = (set: cheerio.Cheerio<cheerio.Element> | null): string | null => {
    if (set !== null && set.length > 0) {
      const header = set[0];
      if (header.children.length < 2) {
        throw new Error("The small label element has less than 2 child nodes");
      }
      const secondChild = header.children[1];
      if (secondChild.type !== "text") {
        throw new Error("The second child node for the small label is not a text node");
      }
      return secondChild.data.trim();
    }
    return null;
  };
  const courseWeight = Number(getSmallLabelText(courseWeightHeader));
  // TODO: figure out if we need to remove the "Category" portion of "Category C", for example.
  const breadth = getSmallLabelText(breadthInformationHeader);
  const subjectCode = getSmallLabelText(subjectCodeHeader);

  return {
    name: courseName,
    courseCode: `${subjectCode} ${courseNumber}`,
    subjectCode,
    courseNumber,
    subject: "Some Subject", // TODO: Is this redundant information?
    courseWeight,
    breadth,
    extraInformation,
    prerequisites: "not sure if this is a list or text",
    corequisites: "not sure if this is a list or text",
    // TODO: Do we even need this here or should another part of the app be responsible
    //       of determining this based on the valid suffixes? 
    // essayCourse: false, 
    validSuffixes,
  }
}

/**
 * Get the information for all courses offered by Western.
 * @returns TBD
 */
async function getCourseInformationDataForSubject(subject: string) {
  const links = await getCourseInformationLinksForSubject(subject);
  await promiseTimeout(2);
  for (const link of links) {
    const courseInformation = await getCourseInformationFromLink(link);
    await promiseTimeout(2);
    // break; // Remove this once we are able to reliably scrape the course information data
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
  // const subject = "mathematics";
  // const courseInformation = await getCourseInformationFromLink("https://www.westerncalendar.uwo.ca/Courses.cfm?CourseAcadCalendarID=MAIN_018802_1&SelectedCalendar=Live&ArchiveID=");
  // await getCourseInformationFromLink("https://www.westerncalendar.uwo.ca/Courses.cfm?CourseAcadCalendarID=KINGS_028261_1&SelectedCalendar=Live&ArchiveID="); // WRITING 2301
  await getCourseInformationFromLink("https://www.westerncalendar.uwo.ca/Courses.cfm?CourseAcadCalendarID=MAIN_025898_1&SelectedCalendar=Live&ArchiveID="); // ECE 3380
  // const courseInformationData = await getCourseInformationDataForSubject(subject);
  // const courseOfferingData = await getCourseOfferingDataForSubject(subject);
}

main();