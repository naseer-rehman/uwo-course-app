import { load, Element, Cheerio } from "cheerio";
import subjectCodes from "./subjectCodes";
import axios, { AxiosRequestConfig } from "axios";
import sleep from "./sleep";
import path from "path";
import fs from "fs";
import { encodeWeekdayList } from "../../shared/weekdayList";

/**
 * Obtain the course offering information for a subject.
 * @param {string} subject the subject code, must be a key in subject mapping JSON file
 */
async function getTimetablePageDataForSubject(subject:string) {
  const PAGE_URL = "https://studentservices.uwo.ca/secure/timetables/mastertt/ttindex.cfm";
  if (subjectCodes.has(subject)) {
    const config: AxiosRequestConfig = {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    };
    const data = `subject=${subjectCodes.get(subject)}&Designation=Any&catalognbr=&CourseTime=All&Component=All&time=&end_time=&day=m&day=tu&day=w&day=th&day=f&LocationCode=Any&command=search`;
    const pageData = await axios.post(PAGE_URL, data, config);
    return pageData;
  } else {
    throw new Error("Invalid subject");
  }
};

/**
 * Get course offering data for a given subject code
 * @param subject the subject code in camel-case, no spaces
 */
export async function getCourseOfferingDataForSubject(subject: string) {
  const courseHeaderRegex = /(([A-Z]+\s*\d+)([A-Z]*))\s*-\s*(.+)/;

  if (subjectCodes.has(subject) === false) {
    throw new Error("Invalid subject");
  }

  const subjectCode = subjectCodes.get(subject);
  const pageData = await getTimetablePageDataForSubject(subject);
  const $ = await load(pageData.data);
  const courseHeaders = await $("div.span12 > h4");

  let subjectCourseOfferingData = [];

  const getTimetableDataFromTable = ($table: Cheerio<Element>): any => {
    const $tableBody = $table.children("tbody");
    const $tableRows = $tableBody.children("tr");

    const getRowInformation = ($tableRow: Cheerio<Element>) => {
      /**
       * 
       * @param $daysOfWeekEntry the `td` element that contains the table with the schedules days of the week
       * @returns the encoded integer that represents the schedules days of the week.
       */
      const getDaysOfWeekInformation = ($daysOfWeekEntry: Cheerio<Element>): number => {
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
  const getNextMatchingSibling = (element: Cheerio<Element>, selector: string): Cheerio<Element> | null => { 
    let nextSibling = element.next();
    while (nextSibling && nextSibling.is(selector) === false) {
      nextSibling = nextSibling.next();
    }
    if (!nextSibling) {
      return null;
    }
    return nextSibling;
  };

  const getCourseOfferingDataFromHeader = (header: Element) => {
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
    await sleep(1);
  }

  return subjectCourseOfferingData;
}

/**
 * Obtains course offering data for a subject and outputs the data to file
 * @param subject
 */
export async function dumpCourseOfferingDataForSubject(subject: string) {
  const outputFileName = `course_offering--${subject}.json`;
  const outputPath = path.join("data", "course_offering", outputFileName);
  const courseOfferingData = await getCourseOfferingDataForSubject(subject);
  fs.writeFileSync(outputPath, JSON.stringify(courseOfferingData, null, 2));
}

export async function dumpCourseOfferingData() {
  const subjects = subjectCodes.getAllKeys();
  for (let i = 0; i < subjects.length; ++i) {
    const subject = subjects[i];
    await dumpCourseOfferingDataForSubject(subject);
    await sleep(2);
  }
}