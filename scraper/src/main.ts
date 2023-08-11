// PLAN: sneak Munna into here
//       - add him as a course in the database or something
import { Element, Cheerio, load } from 'cheerio';
import axios, { AxiosRequestConfig } from "axios";
import format from "html-format";
import path, { dirname } from "path";
import { fileURLToPath } from 'url';
import fs from "fs";
import { encodeWeekdayList } from "../../shared/weekdayList";
import { toCamelCase, firstWord } from "./utils/stringUtils";
import sleep from "./sleep";
import subjectCodes from './subjectCodes';
import { dumpCourseInformationData } from "./academicCalendar";
import { dumpCourseOfferingData } from './westernTimetable';

async function main() {
  // const subject = "calculus";
  // const courseInformation = await getCourseInformationFromLink("https://www.westerncalendar.uwo.ca/Courses.cfm?CourseAcadCalendarID=MAIN_018802_1&SelectedCalendar=Live&ArchiveID=");
  // await getCourseInformationFromLink("https://www.westerncalendar.uwo.ca/Courses.cfm?CourseAcadCalendarID=KINGS_028261_1&SelectedCalendar=Live&ArchiveID="); // WRITING 2301
  // await getCourseInformationFromLink("https://www.westerncalendar.uwo.ca/Courses.cfm?CourseAcadCalendarID=MAIN_025898_1&SelectedCalendar=Live&ArchiveID="); // ECE 3380
  // const courseInformationData = await getCourseInformationDataForSubject(subject);
  // const courseOfferingData = await getCourseInformationDataForSubject(subject);
  // console.log(courseOfferingData);
  dumpCourseInformationData();
  // dumpCourseOfferingData();
}

main();