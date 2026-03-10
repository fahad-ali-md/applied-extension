// Check if CV data exists in storage
console.log('Checking Chrome storage for CV data...');

// This will be run in the browser console
// Copy and paste this in the browser console (F12)
const checkCV = async () => {
  const result = await chrome.storage.local.get(['parsedCV', 'cv_data', 'PARSED_CV']);
  console.log('Storage result:', result);
  
  const parsedCV = result.parsedCV || result.PARSED_CV;
  if (parsedCV) {
    console.log('✅ Parsed CV found:', parsedCV);
    console.log('Personal:', parsedCV.personal);
    console.log('Professional:', parsedCV.professional);
    console.log('Skills:', parsedCV.skills);
  } else {
    console.log('❌ No parsed CV found in storage');
  }
};

checkCV();
