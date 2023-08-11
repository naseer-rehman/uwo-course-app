/**
 * Turns a regular course name into a valid camelCase key for the subject mapping
 */
export const toCamelCase = (string: string) => {
  // Extract only alphabetical words
  const words = string.match(/\w+/g);
  if (words === null) {
    throw new Error(`No words found in string "${string}"`);
  }
  // camelCase-ify the words
  words[0] = words[0].toLowerCase();
  for (let i = 1; i < words.length; ++i) {
    words[i] = words[i].charAt(0).toUpperCase() + words[i].substring(1);
  }
  return words.join("");
};

/**
   * Takes only the first "word" made up of alphanumeric characters and removes the rest of the string 
   * @param value the string value
   * @returns the stripped string value
   */
export const firstWord = (string: string) => {
  const matches = string.match(/\w+/);
  if (matches === null) {
    throw new Error(`Found no words in the provided string: "${string}"`);
  }
  return matches[0];
};