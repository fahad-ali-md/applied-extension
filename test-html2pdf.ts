/**
 * Test html2pdf.js PDF Generation
 *
 * This tests the new HTML-to-PDF compilation
 */

import { generateAndDownloadPDF } from './src/utils/html2pdfCompiler'

// Sample CV Data (same format as your parsed CV)
const sampleCV = {
  personal: {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@gmail.com',
    phone: '+1-234-567-8900',
    linkedIn: 'linkedin.com/in/johndoe',
    portfolio: 'johndoe.dev'
  },
  professional: {
    summary: 'Experienced software developer with expertise in full-stack development, cloud architecture, and building scalable applications. Passionate about clean code, best practices, and mentoring junior developers.',
    currentTitle: 'Senior Software Engineer',
    yearsOfExperience: 5
  },
  experience: [
    {
      role: 'Senior Software Engineer',
      company: 'Google',
      startDate: '08/2021',
      current: true,
      highlights: [
        '• Led team of 5 engineers to develop microservices architecture serving 500k+ daily users',
        '• Reduced API response time by 40% through Redis caching and database optimization',
        '• Architected real-time notification system using WebSockets and RabbitMQ',
        '• Mentored 3 junior developers and conducted code reviews for 10+ projects'
      ]
    },
    {
      role: 'Software Engineer',
      company: 'Microsoft',
      startDate: '06/2019',
      endDate: '07/2021',
      current: false,
      highlights: [
        '• Developed full-stack features for Azure cloud platform using React and .NET',
        '• Implemented CI/CD pipelines reducing deployment time by 60%',
        '• Built REST APIs handling 1M+ requests per day with 99.9% uptime'
      ]
    }
  ],
  projects: [
    {
      name: 'E-Commerce Platform',
      description: 'Built a full-stack e-commerce platform with user authentication, product catalog, shopping cart, and payment gateway integration.',
      technologies: ['React', 'Node.js', 'Express', 'MongoDB', 'Stripe', 'JWT'],
      url: 'https://github.com/john/shop',
      highlights: [
        '• Developed responsive frontend using React with 20-30% faster load times',
        '• Built RESTful APIs with Node.js serving 500+ daily requests',
        '• Integrated Stripe payment gateway with secure authentication'
      ]
    },
    {
      name: 'Task Manager App',
      description: 'A collaborative task management application with real-time updates and team collaboration features.',
      technologies: ['Vue.js', 'Firebase', 'Vuex'],
      url: 'https://github.com/john/tasks',
      highlights: [
        '• Implemented real-time sync using Firebase Firestore',
        '• Built drag-and-drop task management interface',
        '• Added team collaboration features with role-based access'
      ]
    }
  ],
  education: [
    {
      degree: 'Master of Science in Computer Science',
      school: 'Stanford University',
      field: '08/2017',
      graduationYear: '2019'
    },
    {
      degree: 'Bachelor of Science in Software Engineering',
      school: 'MIT',
      field: '09/2013',
      graduationYear: '2017'
    }
  ],
  skills: {
    'Frontend Development': ['React', 'Vue.js', 'TypeScript', 'JavaScript', 'Next.js'],
    'Backend Development': ['Node.js', 'Python', 'Go', 'Express', 'Django'],
    'Cloud & DevOps': ['AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'CI/CD'],
    'Databases': ['PostgreSQL', 'MongoDB', 'Redis', 'Elasticsearch']
  }
}

// Test the PDF generation
console.log('🧪 Testing html2pdf.js PDF Generation')
console.log('=====================================\n')

async function testPDFGeneration() {
  try {
    console.log('📄 Generating PDF from sample CV data...')
    console.log('CV Data:', JSON.stringify(sampleCV, null, 2))
    console.log('\n⏳ Starting PDF generation...\n')

    await generateAndDownloadPDF(sampleCV as any, 'test-cv-html2pdf.pdf')

    console.log('\n✅ SUCCESS! PDF generated and downloaded!')
    console.log('📁 Check your downloads folder for: test-cv-html2pdf.pdf')
    console.log('\n📊 The PDF should now have:')
    console.log('  ✓ Perfect HTML/CSS layout (like Canva)')
    console.log('  ✓ Auto text wrapping')
    console.log('  ✓ Professional spacing')
    console.log('  ✓ Better typography')
  } catch (error) {
    console.error('\n❌ ERROR:', error)
    console.error('Make sure html2pdf.js is installed: pnpm install')
  }
}

// Run the test
testPDFGeneration()
