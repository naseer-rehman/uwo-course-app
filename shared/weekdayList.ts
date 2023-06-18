export enum Weekdays {
  MONDAY = "M",
  TUESDAY = "Tu",
  WEDNESDAY = "W",
  THURSDAY = "Th",
  FRIDAY = "F"
};

const WEEKDAYS = [
  Weekdays.MONDAY, Weekdays.TUESDAY, Weekdays.WEDNESDAY, 
  Weekdays.THURSDAY, Weekdays.FRIDAY
];

/**
 * An integer where the i-th bit represents the (i+1)-th weekday.
 */
type EncodedWeekdayList = number;

/**
 * Encodes a list of weekdays into an integer to store inside a database.
 * @param weekdayList a list of weekdays
 * @returns an encoded integer where each bit represents a unique weekday
 * @example
 * encodeWeekdayList(["M", "F"]) => 17 // 10001 in base 2
 */
export function encodeWeekdayList(weekdayList: string[]): EncodedWeekdayList {
  // 0th bit = Monday
  // ...
  // 4th bit = Friday
  let encodedWeekdayList: EncodedWeekdayList = 0;
  if (weekdayList.length > 5) {
    throw new Error("Weekday list provided has more than 5 items (more than weekdays in a week)");
  }
  for (const weekday in WEEKDAYS) {
    const index = weekdayList.findIndex(item => item === weekday);
    if (index !== -1) {
      encodedWeekdayList = (encodedWeekdayList | (1 << index));
    }
  }
  return encodedWeekdayList;
}

/**
 * Decodes an encoded integer representing a list of weekdays
 * @param encodedWeekdayList the encoded integer representing a weekday list
 * @returns a list of strings representing the weekdays included in the encoded list
 * @example
 * decodeWeekdayList(17) => ["M", "F"] // Monday and Friday
 */
export function decodeWeekdayList(encodedWeekdayList: EncodedWeekdayList) {
  const weekdayList: string[] = [];
  for (let i = 0; i < 5; ++i) {
    if ((encodedWeekdayList & (1 << i)) !== 0) {
      weekdayList.push(WEEKDAYS[i]);
    }
  }
  return weekdayList;
}
