import * as z from "zod";

const emailSchema = z.email();

type Email = string;
type UWOEmail = string;

// NOTE: from the database definition for max email length
const MAX_EMAIL_LENGTH = 320; 

// TODO: Delete?
const isEmail = (value: string): boolean => {
  try {
    emailSchema.parse(value);
  } catch {
    return false;
  }
  return value.length <= MAX_EMAIL_LENGTH;
};


export function normalizeEmailInput(value: string): string {
  return value.trim().toLowerCase();
}


export function normalizeUwoEmail(value: UWOEmail): UWOEmail {
  return normalizeEmailInput(value);
}


/*
  Explanation:
    - Since zod does most of the heavy lifting for checking email formatting,
      I can ignore the small details and search the domain portion only
    - `^.+\@` greedily matches the local part of the email
    - `.*?` lazily matches characters preceeding the final 2 DNS labels
    - (\w+\.\w+) captures the final 2 DNS labels
*/
const uwo_host_pattern = /^.+\@.*?uwo\.ca$/;

export function isUwoEmail(value: unknown): value is UWOEmail {
  if (typeof value !== "string" || !isEmail(value))
    return false;
  return uwo_host_pattern.test(value);
}

export default {
  isUwoEmail,
  normalizeUwoEmail,
  normalizeEmailInput
};