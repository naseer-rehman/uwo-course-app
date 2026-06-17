import { getCourseOfferingDataForSubject } from "../src/westernTimetable";

test("get CALCULUS course offering data", async () => {
  const calculusData = await getCourseOfferingDataForSubject("calculus");
  expect(calculusData.length).toBeGreaterThan(0);
  // get calculus 1000A course data
  const calc1Data = calculusData.find((elem) => {
    return elem.courseCode === "CALCULUS 1000";
  });
  expect(calc1Data).toBeDefined();
  expect(calc1Data?.courseDescription).toBeDefined();
  expect(calc1Data?.courseDescription).toMatch(/derivative/ig);
  expect(calc1Data?.suffixes).toBeDefined();
  expect(calc1Data?.courseNumber).toBe("1000");
  expect(calc1Data?.timetableInformation).toBeDefined();
  expect(calc1Data?.timetableInformation.length).toBeGreaterThan(0);
  const calc1LecData = calc1Data?.timetableInformation.find(
    elem => elem.componentType === "LEC"
  );
  expect(calc1LecData).toBeDefined();
  expect(calc1LecData?.classNumber).toMatch(/\d+/);
  expect(calc1LecData?.sectionNumber).toMatch(/\d+/);
  expect(calc1LecData?.deliveryType.length).toBeGreaterThan(0);
  expect(calc1LecData?.campus.length).toBeGreaterThan(0);
  expect(calc1LecData?.fillStatus.length).toBeGreaterThan(0);
  expect(calc1LecData?.requisitesAndConstraints.length).toBeGreaterThan(0);
});