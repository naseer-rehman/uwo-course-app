import * as cheerio from 'cheerio';
import axios from "axios";
import fs from "fs";

let subjectMapping = null;

function initializeSubjectMapping() {
  if (subjectMapping) return;
  subjectMapping = JSON.parse(fs.readFileSync("subjectMapping.json"));
}

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
  const courseHeaderRegex = /(([A-Z]+\s*\d+)([A-Z]*))\s*-\s*(.+)/;
  const getCourseOfferingData = async (courseHeader) => {
    // console.log(courseHeader);
    let courseDescriptionElement = courseHeader.next;
    while (courseDescriptionElement.type !== "tag") {
      courseDescriptionElement = courseDescriptionElement.next;
    }    
    const headerText = courseHeader.firstChild.data;
    const headerTextMatches = headerText.match(courseHeaderRegex);
    if (!headerTextMatches) {
      throw new Error("Could not match courseHeaderRegex with the course header");
    }
    let courseOffering = headerTextMatches[1];
    let courseCode = headerTextMatches[2];
    let courseOfferingSuffix = (headerTextMatches[3] === "" ? null : headerTextMatches[3]);
    let courseName = headerTextMatches[4];
    let courseDescription = courseDescriptionElement.lastChild.data.trim();
    // todo: split the course description and extract antirequisites + extra information
    return {
      courseOffering: courseOffering,
      courseCode: courseCode,
      courseOfferingSuffix: courseOfferingSuffix,
      courseName: courseName,
      courseDescription: courseDescription,
    };
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
    break;
  }
  console.log(courseOfferingData);
}

async function main() {
  initializeSubjectMapping();
  const subject = "calculus";
  const courseOfferingData = await getCourseOfferingDataForSubject(subject);
}

main();