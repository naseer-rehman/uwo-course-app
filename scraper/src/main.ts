// PLAN: sneak Munna into here
//       - add him as a course in the database or something
import * as cheerio from 'cheerio';
import axios, { AxiosRequestConfig } from "axios";
import format from "html-format";
import path, { dirname } from "path";
import { fileURLToPath } from 'url';
import fs from "fs";
import { encodeWeekdayList } from "../../shared/weekdayList";

interface TimetableSubjectMapping {
  [key: string]: string,
}

interface CourseOfferingData {
  // To be completed...
}

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
  // Under the assumption that the working directory is scraper/
  const subjectMappingJSONPath = path.join("resources", "timetableSubjectMapping.json");
  timetableSubjectMapping = JSON.parse(fs.readFileSync(subjectMappingJSONPath, "utf8"));
}

// NOTE: This function may no longer be required
//   and the path resolution will most likely not work
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
const stringToCamelCase = (name: string) => {
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
        mapping[stringToCamelCase(option.firstChild.data)] = stripValue(option.attribs.value);
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
  console.log("Getting course information links for subject:", subject);
  const pageData = await getCourseCalendarPageDataForSubject(subject);
  const $ = await cheerio.load(pageData.data);
  // TODO: Maybe write some unit tests of some sort to ensure we are at least
  //       matching all the anchor elements we need to extract the links from.
  //       Matching for more than we need isn't an issue at all.
  const anchorsForCourseInformation = $(".col-md-12 .course .panel-body > .col-xs-12 a");
  const linksForCourseInformation = [];
  const isElementOfCorrectType = (elem: cheerio.Element) => {
    // TODO: Evaluate whether we want to restrict to courses with a link containing MAIN
    //   indicating the course is availble on the main campus, or if we should consider any
    //   link regardless of the campus its on, so long as its not a duplicate of a course 
    //   already checked?
    const pattern = /Courses\.cfm\?CourseAcadCalendarID=MAIN_(.+?)&SelectedCalendar=Live&ArchiveID=/g;
    if (!("name" in elem && elem.name == "a" && "href" in elem.attribs)) return false;
    if (!elem.attribs.href.match(pattern)) return false;
    const matches = Array.from(elem.attribs.href.matchAll(pattern));
    return elem.firstChild && elem.firstChild.type === "text"
      && !!elem.firstChild.data.match(/More\s+Details/gi);
  };
  for (const elem of anchorsForCourseInformation) {
    if (isElementOfCorrectType(elem)) {
      // Then we add the links from each of these anchor elements to a list so we can gather the data
      linksForCourseInformation.push(
        `https://www.westerncalendar.uwo.ca/${elem.attribs.href}`
      );
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

  const normalNameWithCodePattern = /\w+\s+(\d+)((?:[A-Z]\/?)+)?/g;
  const normalNameWithCourseCode = normalNameHeader.first().text().trim();
  const courseName = courseNameHeader.first().text().trim();

  // this will contain the course number and the suffixes for the course
  let normalNameWithCourseCodeMatchesList = Array.from(
    normalNameWithCourseCode.matchAll(normalNameWithCodePattern)
  );
  if (!normalNameWithCourseCodeMatchesList 
    || normalNameWithCourseCodeMatchesList.length <= 0) {
    throw new Error(`Normal name with course code did not match the pattern. unmatched string: "${normalNameWithCourseCode}"`);
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
  };

  const courseNumber = normalNameWithCourseCodeMatches[1];
  const suffixesString = normalNameWithCourseCodeMatches[2] ?? "";
  const validSuffixes = extractSuffixesFromListInHeader(suffixesString);
  const courseDescription = courseDescriptionDiv.text().trim();
  const getBoldedInformationLabelText = (set: cheerio.Cheerio<cheerio.Element> | null): string | null => {
    if (set !== null && set.length > 0) {
      return set.text().trim();
    }
    return null;
  };
  const antirequisites = getBoldedInformationLabelText(antirequisitesContainer);
  let requisiteInformationText = getBoldedInformationLabelText(preOrCorequisitesDiv);
  // Remove any newlines/carriadge returns in the text
  requisiteInformationText = requisiteInformationText
    ? requisiteInformationText.replace(/(?:\r?\n)/g, "")
    : null;
  const extractRequisiteInformation = (requisiteInformationText: string | null) => {
    /* 
      The reason for these patterns is because I don't know in which order the
      prerequisites, pre-or corequisites, or corequisites (if this one even exists) is listed
    */
    if (!requisiteInformationText) {
      return {
        preOrCorequisites: null, prerequisites: null, corequisites: null,
      };
    }
    const patterns = {
      prerequisites: /Prerequisite\(s\):\s+(.+?)(?:Pre-or Corequisite\(s\):|Corequisite\(s\):|$)/g,
      corequisites: /(?<!Pre-or\s+)Corequisite\(s\):\s+(.+?)(?:Pre-or Corequisite\(s\):|Prerequisite\(s\):|$)/g,
      preOrCorequisites: /Pre-or Corequisite\(s\):\s+(.+?)(?:Corequisite\(s\):|Prerequisite\(s\):|$)/g,
    };

    const getMatch = (pattern: RegExp): string | null => {
      const matches = Array.from(requisiteInformationText.matchAll(pattern));
      if (!matches || matches.length <= 0) return null;
      // Return the first match, capture group 1
      return matches[0][1].trim();
    };

    return {
      preOrCorequisites: getMatch(patterns.preOrCorequisites),
      prerequisites: getMatch(patterns.prerequisites),
      corequisites: getMatch(patterns.corequisites),
    };
  };
  const requisiteInformation = extractRequisiteInformation(requisiteInformationText);
  const extraInformation = getBoldedInformationLabelText(extraInformationContainer);
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
  const extractBreadthCategoryLetter = (categoryTextInput: string | null): string | null => {
    const categoryPattern = /Category\s+([ABC])/gi;
    if (!categoryTextInput) {
      return null;
    }
    const matches = Array.from(categoryTextInput.matchAll(categoryPattern));
    if (!matches || matches.length <= 0) {
      throw new Error(`Category text (${categoryTextInput}) does not match the pattern Category X`);
    }
    // Return the first match and the first capture group.
    return matches[0][1];
  };
  const breadth = extractBreadthCategoryLetter(
    getSmallLabelText(breadthInformationHeader)
  );
  const subjectCode = getSmallLabelText(subjectCodeHeader);

  return {
    name: courseName,
    courseCode: `${subjectCode} ${courseNumber}`,
    subjectCode,
    courseNumber,
    // subject: "Some Subject", // TODO: Is this redundant information?
    courseDescription,
    courseWeight,
    breadth,
    extraInformation,
    preOrCorequisites: requisiteInformation.preOrCorequisites,
    prerequisites: requisiteInformation.prerequisites,
    corequisites: requisiteInformation.corequisites,
    // TODO: Do we even need the below property here or should another part of the app be 
    //       responsible of determining it based on the valid suffixes? 
    // essayCourse: false, 
    validSuffixes,
  };
}

/**
 * Get the information for all courses offered by Western.
 * @returns TBD
 */
async function getCourseInformationDataForSubject(subject: string) {
  const courseInformationData = [];
  const links = await getCourseInformationLinksForSubject(subject);
  await promiseTimeout(2);
  console.log("Getting course information for", subject);
  for (const link of links) {
    const courseInformation = await getCourseInformationFromLink(link);
    courseInformationData.push(courseInformation);
    await promiseTimeout(2);
  }
  return courseInformationData;
}

/**
 * Get course offering data for a given subject code
 * @param subject the subject code in camel-case, no spaces
 */
async function getCourseOfferingDataForSubject(subject: string) {
  const courseHeaderRegex = /(([A-Z]+\s*\d+)([A-Z]*))\s*-\s*(.+)/;

  if (subject in timetableSubjectMapping === false) {
    throw new Error("Invalid subject");
  }

  const subjectCode = timetableSubjectMapping[subject];
  const pageData = await getTimetablePageDataForSubject(subject);
  const $ = await cheerio.load(pageData.data);
  const courseHeaders = await $("div.span12 > h4");

  let subjectCourseOfferingData = [];

  const getTimetableDataFromTable = ($table: cheerio.Cheerio<cheerio.Element>): any => {
    const $tableBody = $table.children("tbody");
    const $tableRows = $tableBody.children("tr");

    const getRowInformation = ($tableRow: cheerio.Cheerio<cheerio.Element>) => {
      /**
       * 
       * @param $daysOfWeekEntry the `td` element that contains the table with the schedules days of the week
       * @returns the encoded integer that represents the schedules days of the week.
       */
      const getDaysOfWeekInformation = ($daysOfWeekEntry: cheerio.Cheerio<cheerio.Element>): number => {
        const $daysOfWeekEntries = $daysOfWeekEntry.find(".daysTable > tbody > tr > td");
        const daysOfWeek: string[] = [];
        for (let i = 0; i < $daysOfWeekEntries.length; ++i) {
          const entry = $($daysOfWeekEntries[i]);
          const value = entry.text().trim();
          const weekdayPattern = /M|Tu|W|Th|F/g;
          if (value.match(weekdayPattern)) {
            daysOfWeek.push(value);
          }
        }
        return encodeWeekdayList(daysOfWeek);
      };

      const $rowEntries = $tableRow.children("td");
      let currentEntry = $rowEntries.first();
      const nextEntry = () => { currentEntry = currentEntry.next(); };
      const getEntryText = () => currentEntry.text().trim();
      const sectionNumber = getEntryText();
      nextEntry();
      const componentType = getEntryText();
      nextEntry();
      const classNumber = getEntryText();
      nextEntry();
      const daysOfTheWeek = getDaysOfWeekInformation(currentEntry);
      nextEntry();
      const startTime = getEntryText();
      nextEntry();
      const endTime = getEntryText();
      nextEntry();
      const location = getEntryText();
      nextEntry();
      const instructorName = getEntryText();
      nextEntry();
      const requisitesAndConstraints = getEntryText();
      nextEntry();
      const fillStatus = getEntryText();
      nextEntry();
      const campus = getEntryText(); 

      return {
        sectionNumber,
        componentType,
        classNumber,
        daysOfTheWeek,
        startTime,
        endTime,
        location,
        instructorName,
        requisitesAndConstraints,
        fillStatus,
        campus,
      };
    };
    
    const rowInformationList = [];

    for (let i = 0; i < $tableRows.length; ++i) {
      const rowInformation = getRowInformation($($tableRows[i]));
      rowInformationList.push(rowInformation);
    }

    return rowInformationList;
  };

  /**
   * 
   * @param element element to find the next matching sibling for
   * @param selector css selector
   * @returns the next sibling element that matches the selector
   */
  const getNextMatchingSibling = (element: cheerio.Cheerio<cheerio.Element>, selector: string): cheerio.Cheerio<cheerio.Element> | null => { 
    let nextSibling = element.next();
    while (nextSibling && nextSibling.is(selector) === false) {
      nextSibling = nextSibling.next();
    }
    if (!nextSibling) {
      return null;
    }
    return nextSibling;
  };

  const getCourseOfferingDataFromHeader = (header: cheerio.Element) => {
    const $header = $(header);
    const $courseDescription = $header.next("p");
    const $scheduleTable = getNextMatchingSibling($header, "table");
    if (!$scheduleTable) {
      throw new Error("Could not find the course offering schedule table");
    }
    // TODO: Define a course offering code = course code + offering suffix?
    const courseHeaderPattern = /([A-Za-z]+)\s+(\d+)([A-Z]+)/g;
    const courseHeaderMatches = Array.from(
      $header.text().matchAll(courseHeaderPattern)
    );
    if (!courseHeaderMatches || courseHeaderMatches.length <= 0) {
      throw new Error("Unable to match course offering header");
    }
    const courseHeaderMatch = courseHeaderMatches[0];
    const subjectCode = courseHeaderMatch[1];
    const courseNumber = courseHeaderMatch[2];
    const suffixes = courseHeaderMatch[3];
    const courseCode = `${subjectCode} ${courseNumber}`;
    
    // TODO: Find out if we want to extract the requisite and extra information from the course description label
    //  Or do I instead only extra Extra Information from the course description?
    const courseDescription = $courseDescription.text();

    const timetableInformation = getTimetableDataFromTable($scheduleTable);

    return {
      subjectCode,
      courseNumber,
      suffixes,
      courseCode,
      courseDescription,
      timetableInformation,
    };
  };

  for (let i = 0; i < courseHeaders.length; ++i) {
    const courseOfferingData = getCourseOfferingDataFromHeader(courseHeaders[i]);
    subjectCourseOfferingData.push(courseOfferingData);
    break;
    await promiseTimeout(1);
  }

  return subjectCourseOfferingData;
}

/**
 * Obtains course information data for the provided subject and outputs the results to a file.
 * @param subject 
 */
async function dumpCourseInformationDataForSubject(subject: string) {
  const outputFileName = `course_info--${subject}.json`;
  const outputPath = path.join("data", "course_info", outputFileName);
  const courseInformationData = await getCourseInformationDataForSubject(subject);
  fs.writeFileSync(outputPath, JSON.stringify(courseInformationData, null, 2));
}

/**
 * Obtains course offering data for a subject and outputs the data to file
 * @param subject
 */
async function dumpCourseOfferingDataForSubject(subject: string) {
  const outputFileName = `course_offering--${subject}.json`;
  const outputPath = path.join("data", "course_offering", outputFileName);
  const courseOfferingData = await getCourseOfferingDataForSubject(subject);
  fs.writeFileSync(outputPath, JSON.stringify(courseOfferingData, null, 2));
}

/**
 * Obtains course information data for every subject and outputs each subject's data to its own file.
 */
async function dumpCourseInformationData() {
  const subjects = Object.keys(timetableSubjectMapping);
  for (let i = 0; i < subjects.length; ++i) {
    const subject = subjects[i];
    await dumpCourseInformationDataForSubject(subject);
    await promiseTimeout(3);
  }
}

async function dumpCourseOfferingData() {
  const subjects = Object.keys(timetableSubjectMapping);
  for (let i = 0; i < subjects.length; ++i) {
    const subject = subjects[i];
    await dumpCourseOfferingDataForSubject(subject);
    await promiseTimeout(1);
  }
}

async function main() {
  initializeTimetableSubjectMapping();
  const subject = "calculus";
  // const courseInformation = await getCourseInformationFromLink("https://www.westerncalendar.uwo.ca/Courses.cfm?CourseAcadCalendarID=MAIN_018802_1&SelectedCalendar=Live&ArchiveID=");
  // await getCourseInformationFromLink("https://www.westerncalendar.uwo.ca/Courses.cfm?CourseAcadCalendarID=KINGS_028261_1&SelectedCalendar=Live&ArchiveID="); // WRITING 2301
  // await getCourseInformationFromLink("https://www.westerncalendar.uwo.ca/Courses.cfm?CourseAcadCalendarID=MAIN_025898_1&SelectedCalendar=Live&ArchiveID="); // ECE 3380
  // const courseInformationData = await getCourseInformationDataForSubject(subject);
  // const courseOfferingData = await getCourseInformationDataForSubject(subject);
  // console.log(courseOfferingData);
  await dumpCourseInformationData();
  // await dumpCourseOfferingData();
}

main();