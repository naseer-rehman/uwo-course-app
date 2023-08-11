import { load, Element, Cheerio } from "cheerio";
import subjectCodes from "./subjectCodes";
import axios from "axios";
import sleep from "./sleep";
import path from "path";
import fs from "fs";

// TODO:
//  - write a function to obtain information for a single course
//  - write a function to obtain information for a collection of courses
//    - that match some sort of pattern or condition?
//  - write a function to "soft update" courses:
//    - entire file is not overwritten, only additions/edits are made to the file without deleting courses

// RESEARCH:
//  - research the unique(?) id in the url for a course's academic calendar page
//    - Example: 
//        westerncalendar.uwo.ca.....CourseAcadCalendarID=MAIN_022436_1&....
//      where the ID is: 022436
//  - do we want a function that can parse the data files?
//    - allowing edits or to calculate stuff with it
//    - yes cuz we need to upload to database
//  - look into using dependency injection for gathering data about courses?
//  - figure out when we want to replace an entire subject file vs. only updating the courses we need to update
//    - especially required for making updates to existing courses to the database
//    - do we assume that every course might have received an update?
//      - so in this case, we need to rescrape every course and then run a diff check between the new data 
//        and what's in the json
//  - do we want to do scraper -> local json files -> upload to database
//    or do we scraper -> upload to database directly?

/**
 * Obtains the academic calendar page data for the provided subject, which includes
 * a list of all courses under the subject where each entry has a link to the
 * course information page for that subject.
 * @param subject 
 */
async function getCourseCalendarPageDataForSubject(subject: string) {
  if (!(subjectCodes.has(subject))) {
    throw new Error("Invalid subject");
  }
  const timetableSubjectCode = subjectCodes.get(subject);
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
  const $ = await load(pageData.data);
  // TODO: Maybe write some unit tests of some sort to ensure we are at least
  //       matching all the anchor elements we need to extract the links from.
  //       Matching for more than we need isn't an issue at all.
  const anchorsForCourseInformation = $(".col-md-12 .course .panel-body > .col-xs-12 a");
  const linksForCourseInformation = new Map();

  const isLinkOfCorrectType = (link: string): boolean => {
    const pattern = /Courses\.cfm\?CourseAcadCalendarID=[A-Z]+_(.+?)&SelectedCalendar=Live&ArchiveID=/g;
    return !!link.match(pattern);
  };

  const isElementOfCorrectType = (elem: Element) => {
    if (!("name" in elem && elem.name === "a" && "href" in elem.attribs)) return false;
    if (!isLinkOfCorrectType(elem.attribs.href)) return false;
    return elem.firstChild && elem.firstChild.type === "text"
      && !!elem.firstChild.data.match(/More\s+Details/gi);
  };

  // Grab the unique identifier for the course from the provided link
  // of the current form
  const getCourseIdFromLink = (link: string): string => {
    const pattern = /Courses\.cfm\?CourseAcadCalendarID=[A-Z]+_(\d+)_\d+&SelectedCalendar=Live&ArchiveID=/g;
    const matches = Array.from(link.matchAll(pattern));
    if (matches.length === 0) {
      throw new Error(`No match from courseId pattern against academic calendar link for course: "${link}"`);
    };
    const courseId = matches[0][1];
    if (!courseId.match(/\d+/g)) {
      throw new Error(`Matched courseId from academic calendar link has unexpected value: "${courseId}"`);
    }
    return matches[0][1];
  };

  for (const elem of anchorsForCourseInformation) {
    if (isElementOfCorrectType(elem)) {
      const courseId = getCourseIdFromLink(elem.attribs.href);
      linksForCourseInformation.set(
        courseId,
        `https://www.westerncalendar.uwo.ca/${elem.attribs.href}`
      );
    }
  }

  return linksForCourseInformation.values();
}

/**
 * Retrieves all the information of a course from its information page provided as a link.
 * @param link 
 */
export async function getCourseInformationFromLink(link: string) {
  let pageData = null;
  try {
    pageData = await axios.get(link);
  } catch (error: any) {
    console.log(error.toJSON());
  }
  if (!pageData) return;
  const $ = load(pageData.data);
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
  const assertNonEmptySets = (...args: Cheerio<Element>[]) => {
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
  let preOrCorequisitesDiv: Cheerio<Element> | null = null;
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
  const getBoldedInformationLabelText = (set: Cheerio<Element> | null): string | null => {
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
  const getSmallLabelText = (set: Cheerio<Element> | null): string | null => {
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

  // Grab locations from page
  const getLocationFromLink = (link: string): string | null => {
    // NOTE: I should probably look to use a single, central pattern
    const pattern = /Courses\.cfm\?CourseAcadCalendarID=([A-Z]+)_.+?&SelectedCalendar=Live&ArchiveID=/g;
    const matches = Array.from(link.matchAll(pattern));
    if (matches.length === 0) {
      return null;
    }
    return matches[0][1]; // first match, group 1
  };
  const getOtherLocations = (): string[] => {
    const locs: string[] = [];
    const links = $(".col-xs-12 > a");
    for (const link of links) {
      let loc = null;
      if ("name" in link && link.name === "a" && "href" in link.attribs) {
        loc = getLocationFromLink(link.attribs.href);
      }
      if (loc) {
        locs.push(loc);
      }
    }
    return locs;
  }
  const locationFromProvidedLink = getLocationFromLink(link);
  if (!locationFromProvidedLink) {
    throw new Error(`The location pattern does not match the course calendar link: ${link}`);
  }
  const locations = [locationFromProvidedLink, ...getOtherLocations()];


  return {
    link,
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
    locations,
    validSuffixes,
  };
}

/**
 * Get the information for all courses for a subject offered by Western.
 * @returns a list of objects where each object has information for a unique course from the subject
 */
export async function getCourseInformationDataForSubject(subject: string) {
  const courseInformationData = [];
  const links = await getCourseInformationLinksForSubject(subject);
  await sleep(2);
  console.log("Getting course information for", subject);
  for (const link of links) {
    const courseInformation = await getCourseInformationFromLink(link);
    courseInformationData.push(courseInformation);
    await sleep(2);
  }
  return courseInformationData;
}

/**
 * Obtains course information data for the provided subject and outputs the results to a file.
 * @param subject 
 */
export async function dumpCourseInformationDataForSubject(subject: string) {
  const outputFileName = `course_info--${subject}.json`;
  const outputPath = path.join("data", "course_info", outputFileName);
  const courseInformationData = await getCourseInformationDataForSubject(subject);
  fs.writeFileSync(outputPath, JSON.stringify(courseInformationData, null, 2));
}

/**
 * Obtains course information data for every subject and outputs each subject's data to its own file.
 */
export async function dumpCourseInformationData() {
  const subjects = subjectCodes.getAllKeys();
  for (let i = 0; i < subjects.length; ++i) {
    const subject = subjects[i];
    await dumpCourseInformationDataForSubject(subject);
    await sleep(1);
  }
}
