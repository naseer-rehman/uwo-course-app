import * as cheerio from 'cheerio';
import axios from "axios";
import fs from "fs";
import subjectMapping from "./subjectMapping.json" assert { type: "json" };;


/**
 * Obtain the course offering information for a subject.
 * @param {String} subject 
 */
async function getPageDataForSubject(subject) {
  const PAGE_URL = "https://studentservices.uwo.ca/secure/timetables/mastertt/ttindex.cfm";
  if (subjectMapping.hasOwnProperty(subject)) {
    const pageData = await axios.post(
      PAGE_URL, 
      `subject=${subjectMapping[subject]}&Designation=Any&catalognbr=&CourseTime=All&Component=All&time=&end_time=&day=m&day=tu&day=w&day=th&day=f&LocationCode=Any&command=search`,
      {
        "Content-Type": "application/x-www-form-urlencoded",
      }
    );
    return pageData;
  } else {
    throw new Error("Invalid subject");
  }
};

async function generateSubjectMappingJSON() {
  const PAGE_URL = "https://studentservices.uwo.ca/secure/timetables/mastertt/ttindex.cfm";
  const pageData = await axios.get(PAGE_URL);
  const $ = await cheerio.load(pageData.data);
  const subjectOptions = await $("#inputSubject").children("option");
  const mapping = {};
  const keyify = (name) => {
    // Extract only alphabetical words
    const words = name.match(/\w+/g);
    // camelCase-ify the words
    words[0] = words[0].toLowerCase();
    for (let i = 1; i < words.length; ++i) {
      words[i] = words[i].charAt(0).toUpperCase() + words[i].substring(1);
    }
    return words.join("");
  };
  const stripValue = (value) => {
    return value.match(/\w+/)[0];
  };
  for (let i = 0; i < subjectOptions.length; ++i) {
    const option = subjectOptions[i];
    if (option.attribs?.value && option.attribs.value.length > 0) {
      mapping[keyify(option.firstChild.data)] = stripValue(option.attribs.value);
    }
  }
  fs.writeFileSync("subjectMapping.json", JSON.stringify(mapping), "utf8");
}

async function getCourseOfferingDataForSubject(subject) {
  const getCourseOfferingData = async (courseHeader) => {
    const courseDescriptionElement = courseHeader.next;
    const courseOfferingTimetable = courseDescriptionElement.next;
    const headerText = courseHeader.firstChild.data;
    // work in progress lol
    let courseCode;
    let courseOfferingSuffix;
    let courseName;
    let courseDescription;
    return headerText;
  };

  const subjectCode = subjectMapping[subject];
  const pageData = await getPageDataForSubject(subject);
  // console.log(getPage.data);
  const $ = await cheerio.load(pageData.data);
  const courseHeaders = await $("div.span12 > h4");
  let courseOfferingData = [];
  for (let i = 0; i < courseHeaders.length; ++i) {
    console.log(`Getting header ${i + 1}`);
    courseOfferingData.push(await getCourseOfferingData(courseHeaders[i]));
  }
  console.log(courseOfferingData);
}

async function main() {
  const subject = "mechatronicSystemsEngineering";
  const courseOfferingData = await getCourseOfferingDataForSubject(subject);
}

main();