/**
 * Field Name Mappings
 *
 * Comprehensive patterns for different naming conventions used across websites
 */

export const FIELD_MAPPINGS: Record<string, string[]> = {
  // Personal Information
  firstName: ['firstName', 'first_name', 'fname', 'first-name', 'first', 'given-name', 'givenName'],
  lastName: ['lastName', 'last_name', 'lname', 'last-name', 'last', 'surname', 'family-name', 'familyName'],
  fullName: ['fullName', 'full_name', 'name', 'applicant-name', 'candidate-name'],
  email: ['email', 'e-mail', 'emailAddress', 'email_address', 'mail', 'applicant-email'],
  phone: ['phone', 'phoneNumber', 'phone_number', 'mobile', 'tel', 'cell', 'cellphone', 'applicant-phone'],

  // Address
  address: ['address', 'street', 'streetAddress', 'street_address', 'addr', 'location'],
  city: ['city', 'town', 'cityTown'],
  state: ['state', 'province', 'region', 'stateProvince'],
  zipCode: ['zip', 'zipCode', 'zip_code', 'postal', 'postalCode', 'postal_code', 'pincode'],
  country: ['country', 'countryCode', 'country_code'],

  // Professional
  currentTitle: ['title', 'jobTitle', 'job_title', 'position', 'currentTitle', 'current_title', 'role'],
  company: ['company', 'employer', 'organization', 'currentCompany', 'current_company'],
  experience: ['experience', 'yearsExperience', 'years_experience', 'yoe', 'exp'],
  skills: ['skills', 'keySkills', 'key_skills', 'Skills', '_skills'],
  linkedIn: ['linkedin', 'linkedIn', 'linkedinUrl', 'linkedin_url', 'linkedin-profile'],
  portfolio: ['portfolio', 'website', 'personalWebsite', 'github', 'githubUrl'],

  // Education
  degree: ['degree', 'education', 'highestDegree', 'highest_degree', 'qualification'],
  school: ['school', 'university', 'college', 'institution', 'almaMater'],
  graduationYear: ['gradYear', 'grad_year', 'graduationYear', 'graduation_year', 'yearGraduated'],

  // Application Specific
  coverLetter: ['coverLetter', 'cover_letter', 'coverletter', 'letter', 'message', 'additionalInfo'],
  resume: ['resume', 'cv', 'uploadResume', 'upload_resume', 'resumeFile', 'resume_file'],
  salary: ['salary', 'expectedSalary', 'expected_salary', 'salaryExpectation', 'pay'],
  startDate: ['startDate', 'start_date', 'availability', 'whenStart', 'noticePeriod'],
  referral: ['referral', 'referrer', 'howDidYouHear', 'source', 'referredBy'],
}
