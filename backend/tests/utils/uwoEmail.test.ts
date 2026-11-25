import { test, expect } from "bun:test";
import { isUwoEmail, normalizeUwoEmail } from "../../src/utils/uwoEmail";

test("Matches a regular uwo email", async () => {
  const TEST_EMAIL = "somestudent@uwo.ca";
  expect(isUwoEmail(TEST_EMAIL)).toBeTrue();
});

test("Does not match a non-uwo email", async () => {
  const TEST_EMAIL = "infiltrator@munamotala.com";
  expect(isUwoEmail(TEST_EMAIL)).toBeFalse();
});

test("Matches a uwo email with subdomains", async () => {
  const TEST_EMAIL = "somestudent@subdomain.uwo.ca";
  const TEST_EMAIL_2 = "somestudent@subdomain.anothaone.uwo.ca";
  expect(isUwoEmail(TEST_EMAIL)).toBeTrue();
  expect(isUwoEmail(TEST_EMAIL_2)).toBeTrue();
});

test("Does not match uwo email with funky suffix", async () => {
  const TEST_EMAIL_1 = "somestudent@subdomain.uwo.ca_";
  const TEST_EMAIL_2 = "somestudent@subdomain.anothaone.uwo.ca_";
  const TEST_EMAIL_3 = "somestudent@uwo.ca_";
  const TEST_EMAIL_4 = "somestudent@uwo.ca+_@";
  expect(isUwoEmail(TEST_EMAIL_1)).toBeFalse();
  expect(isUwoEmail(TEST_EMAIL_2)).toBeFalse();
  expect(isUwoEmail(TEST_EMAIL_3)).toBeFalse();
});

test("Does not match invalid emails", async () => {
  const invalid_emails = [
    `abc.example.com`,
    `a@b@c@example.com`,
    `a"b(c)d,e:f;g<h>i[j\k]l@example.com`,
    `just"not"right@example.com`,
    `this is"not\allowed@example.com`,
    `this\ still\"not\\allowed@example.com`,
    `1234567890123456789012345678901234567890123456789012345678901234+x@example.com`,
    `i.like.underscores@but_they_are_not_allowed_in_this_part.com`,
    // (valid email, but don't allow this one because singular DNS 
    // label frowned upon >:C) 
    `admin@example`,
    // (IP addresses are allowed instead of domains when in square brackets, but strongly discouraged --- hence deliberately will not allow this one)
    `postmaster@[123.123.123.123]`,
    // (IPv6 uses a different syntax---same deal as above)
    `postmaster@[IPv6:2001:0db8:85a3:0000:0000:8a2e:0370:7334]`,
    // (begin with underscore different syntax---same deal as above)
    `_test@[IPv6:2001:0db8:85a3:0000:0000:8a2e:0370:7334]`,
  ];

  for (let value of invalid_emails) {
    expect(isUwoEmail(value)).toBeFalse();
  }
});

test("Normalize regular uwo email", async () => {
  const TEST_EMAIL = " SOMestudENT@Uwo.Ca\r\n";
  expect(normalizeUwoEmail(TEST_EMAIL))
    .toBe("somestudent@uwo.ca");
});

test("Normalize regular uwo email with subdomain", async () => {
  const TEST_EMAIL = "\tSoMestuDenT@SuBDOmAiN.uwO.CA\n";
  expect(normalizeUwoEmail(TEST_EMAIL))
    .toBe("somestudent@subdomain.uwo.ca");
});

test("Normalize regular email input", async () => {
  const TEST_EMAIL = "  \t jOHNdoE+exTrA@GmAiL.CoM \r\n  ";
  expect(normalizeUwoEmail(TEST_EMAIL))
    .toBe("johndoe+extra@gmail.com");
});
