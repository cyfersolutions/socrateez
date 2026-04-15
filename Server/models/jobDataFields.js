/**
 * Field names as stored in MongoDB (import / export column titles).
 * Salary is a string to preserve formatting (e.g. "$120,000" or "32,240.0").
 */

export const JobField = {
  jobTitleFilter: "Job Title (filter selection)",
  listingTitle: "Listing Title",
  jobFamily: "Job Family",
  subJobFamily: "Sub Job Family",
  salary: "Salary",
  postDate: "Post Date",
  locationLabel: "Location Label",
  state: "State",
  city: "City",
  company: "Company",
  naics2DigitSector: "Naics 2 Digit Sector",
  naics4DigitIndustry: "Naics 4 Digit Industry",
  country: "Country",
};

const str = { type: String, trim: true };

export const jobDataFields = {
  [JobField.jobTitleFilter]: str,
  [JobField.listingTitle]: str,
  [JobField.jobFamily]: str,
  [JobField.subJobFamily]: str,
  [JobField.salary]: str,
  [JobField.postDate]: str,
  [JobField.locationLabel]: str,
  [JobField.state]: str,
  [JobField.city]: str,
  [JobField.company]: str,
  [JobField.naics2DigitSector]: str,
  [JobField.naics4DigitIndustry]: str,
  [JobField.country]: str,
};
