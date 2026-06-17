import { load } from "cheerio";
import type { Cheerio } from "cheerio";
import subjectCodes from "./subjectCodes";
import sleep from "./sleep";
import path from "path";
import fs from "fs";
import { encodeWeekdayList } from "../../shared/weekdayList";

/**
 * Obtain the course offering information for a subject.
 * @param {string} subject the subject code, must be a key in subject mapping JSON file
 */
async function getTimetablePageDataForSubject(subject: string) {
  const PAGE_URL = "https://studentservices.uwo.ca/secure/timetables/mastertt/ttindex.cfm";
  if (subjectCodes.has(subject)) {
    const config = {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    };
    const data = `subject=${subjectCodes.get(subject)}&Designation=Any&catalognbr=&CourseTime=All&Component=All&LocationCode=Any&command=search`;
    const response = await fetch(PAGE_URL, {
      method: "POST",
      headers: config.headers,
      body: data
    });
    // await fetch("https://studentservices.uwo.ca/secure/timetables/mastertt/ttindex.cfm", {
    //   "credentials": "include",
    //   "headers": {
    //     "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:151.0) Gecko/20100101 Firefox/151.0",
    //     "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8, image/jxl",
    //     "Accept-Language": "en-US,en;q=0.9",
    //     "Content-Type": "application/x-www-form-urlencoded",
    //     "Upgrade-Insecure-Requests": "1",
    //     "Sec-Fetch-Dest": "document",
    //     "Sec-Fetch-Mode": "navigate",
    //     "Sec-Fetch-Site": "same-origin",
    //     "Sec-Fetch-User": "?1",
    //     "Priority": "u=0, i"
    //   },
    //   "referrer": "https://studentservices.uwo.ca/secure/timetables/mastertt/ttindex.cfm",
    //   "body": "subject=CALCULUS&Designation=Any&catalognbr=&CourseTime=All&Component=All&LocationCode=Any&command=search",
    //   "method": "POST",
    //   "mode": "cors"
    // });
    return await response.text();
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

  // TODO: REWRITE THIS FUNCTION????????
  // NOTE: Do I even need to do this check?
  if (subjectCodes.has(subject) === false) {
    throw new Error("Invalid subject");
  }

  const subjectCode = subjectCodes.get(subject);
  const pageData = await getTimetablePageDataForSubject(subject);
  const $ = await load(pageData);
  const courseHeaders = await $("div.span12 > h4");

  let subjectCourseOfferingData = [];

  type CheerioType = typeof courseHeaders;
  type ElementType = typeof courseHeaders extends Cheerio<infer X> ? X : never;
  const getTimetableDataFromTable = ($table: CheerioType) => {
    const $tableBody = $table.children("tbody");
    const $tableRows = $tableBody.children("tr");
    if ($tableRows.length <= 0) {
      throw new Error(`Could not find the table rows in the timetable for ${subject}`);
    }

    const getRowInformation = ($tableRow: CheerioType) => {
      /**
       * 
       * @param $daysOfWeekEntry the `td` element that contains the table with the schedules days of the week
       * @returns the encoded integer that represents the schedules days of the week.
       */
      const getDaysOfWeekInformation = ($daysOfWeekEntry: CheerioType): number => {
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
      const requisitesAndConstraints = getEntryText();
      nextEntry();
      const fillStatus = getEntryText();
      nextEntry();
      const campus = getEntryText();
      nextEntry();
      const deliveryType = getEntryText();

      return {
        sectionNumber,
        componentType,
        classNumber,
        requisitesAndConstraints,
        fillStatus,
        campus,
        deliveryType
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
  const getNextMatchingSibling = (element: CheerioType, selector: string): CheerioType | null => {
    let nextSibling = element.next();
    while (nextSibling && nextSibling.is(selector) === false) {
      nextSibling = nextSibling.next();
    }
    if (!nextSibling) {
      return null;
    }
    return nextSibling;
  };

  const getCourseOfferingDataFromHeader = (header: ElementType) => {
    const $header = $(header);
    const $courseDescription = $header.next("p");
    // const $scheduleTable = getNextMatchingSibling($header, "table");
    const $scheduleTable = $header.nextAll("table");
    if (!$scheduleTable || $scheduleTable.length <= 0) {
      throw new Error("Could not find the course offering schedule table");
    }
    // TODO: Define a course offering code = course code + offering suffix?
    const courseHeaderPattern = /([A-Za-z]+)\s+(\d+)([A-Z]+)/g;
    const courseHeaderMatches = Array.from(
      $header.text().matchAll(courseHeaderPattern)
    );
    const courseHeaderMatch = courseHeaderMatches[0];

    const foundNoMatches = !courseHeaderMatches || courseHeaderMatches.length <= 0;
    const receivedUndefinedMatches = courseHeaderMatch === undefined || courseHeaderMatch?.length < 4;
    if (foundNoMatches || receivedUndefinedMatches) {
      throw new Error("Unable to match course offering header");
    }

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
    const courseHeader = courseHeaders[i];
    if (courseHeader) {
      const courseOfferingData = getCourseOfferingDataFromHeader(courseHeader);
      subjectCourseOfferingData.push(courseOfferingData);
      break;
    }
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
  for (const subject of subjects) {
    await dumpCourseOfferingDataForSubject(subject);
    await sleep(2);
  }
}