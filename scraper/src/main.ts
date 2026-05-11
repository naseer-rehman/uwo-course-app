// PLAN: sneak Munna in here
//       - add him as a course in the database or something
import { load } from "cheerio";
import * as cheerio from "cheerio";
import type { Cheerio } from "cheerio";
import format from "html-format";
import path, { dirname } from "path";
import { fileURLToPath } from 'url';
import fs from "fs";
import { encodeWeekdayList } from "../../shared/weekdayList";
import { toCamelCase, firstWord } from "./utils/stringUtils";
import sleep from "./sleep";
import subjectCodes from './subjectCodes';
import { dumpCourseInformationData, getCourseInformationFromLink } from "./academicCalendar";
import { dumpCourseOfferingData } from './westernTimetable';

async function main() {
  // const subject = "calculus";
  console.log("Running...");
  const courseInformation = await getCourseInformationFromLink("https://www.westerncalendar.uwo.ca/Courses.cfm?CourseAcadCalendarID=KINGS_028261_1&SelectedCalendar=Live&ArchiveID="); // WRITING 2301
  // const courseInformation = await getCourseInformationFromLink("https://www.westerncalendar.uwo.ca/Courses.cfm?CourseAcadCalendarID=MAIN_025898_1&SelectedCalendar=Live&ArchiveID="); // ECE 3380
  console.log(courseInformation);
  // const courseInformationData = await getCourseInformationDataForSubject(subject);
  // const courseOfferingData = await getCourseInformationDataForSubject(subject);
  // console.log(courseOfferingData);
  // dumpCourseInformationData();
  // dumpCourseOfferingData();
  // subjectCodes.generateMappingFile();
  // console.log(await getCourseInformationLinksForSubject("WRITING"));
}

main();