import subjectCodes from "../src/subjectCodes";

test("get calculus code", () => {
  const calculusCode = subjectCodes.get("calculus");
  expect(calculusCode).toBe("CALCULUS");
});