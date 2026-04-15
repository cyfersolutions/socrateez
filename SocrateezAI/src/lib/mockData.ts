// ─── Summary Stats ───────────────────────────────────────────────
export const summaryStats = {
  totalJobs: 12847,
  avgSalary: 95400,
  highestPayingRole: 'ML Engineer',
  highestSalary: 165000,
  topLocation: 'San Francisco',
  topLocationJobs: 3420
};

// ─── Salary by Role (Bar Chart) ─────────────────────────────────
export const salaryByRole = [
{ role: 'ML Engineer', salary: 165000 },
{ role: 'Product Manager', salary: 140000 },
{ role: 'Data Scientist', salary: 135000 },
{ role: 'DevOps Engineer', salary: 130000 },
{ role: 'Backend Developer', salary: 128000 },
{ role: 'Software Engineer', salary: 125000 },
{ role: 'Frontend Developer', salary: 115000 },
{ role: 'UX Designer', salary: 105000 }];


// ─── Salary Trends (Line Chart — 12 months) ─────────────────────
export const salaryTrends = [
{ month: 'Jan', salary: 88000 },
{ month: 'Feb', salary: 89200 },
{ month: 'Mar', salary: 90500 },
{ month: 'Apr', salary: 89800 },
{ month: 'May', salary: 91200 },
{ month: 'Jun', salary: 92800 },
{ month: 'Jul', salary: 93100 },
{ month: 'Aug', salary: 93600 },
{ month: 'Sep', salary: 94200 },
{ month: 'Oct', salary: 94800 },
{ month: 'Nov', salary: 95100 },
{ month: 'Dec', salary: 95400 }];


// ─── Jobs by City (Bar Chart) ───────────────────────────────────
export const jobsByCity = [
{ city: 'San Francisco', count: 3420 },
{ city: 'New York', count: 2890 },
{ city: 'Seattle', count: 1950 },
{ city: 'Austin', count: 1420 },
{ city: 'Boston', count: 1180 },
{ city: 'Chicago', count: 890 },
{ city: 'Denver', count: 650 },
{ city: 'Los Angeles', count: 447 }];


// ─── Jobs by Role (Pie Chart) ───────────────────────────────────
export const jobsByRole = [
{
  role: 'Software Engineer',
  count: 4200,
  fill: 'var(--color-softwareEngineer)'
},
{ role: 'Data Scientist', count: 2350, fill: 'var(--color-dataScientist)' },
{ role: 'Product Manager', count: 1890, fill: 'var(--color-productManager)' },
{ role: 'DevOps Engineer', count: 1540, fill: 'var(--color-devopsEngineer)' },
{
  role: 'Frontend Developer',
  count: 1320,
  fill: 'var(--color-frontendDeveloper)'
}];


// ─── Salary Distribution (Histogram) ────────────────────────────
export const salaryDistribution = [
{ range: '40-60K', count: 1240 },
{ range: '60-80K', count: 2890 },
{ range: '80-100K', count: 3650 },
{ range: '100-120K', count: 2780 },
{ range: '120-140K', count: 1420 },
{ range: '140-160K', count: 620 },
{ range: '160K+', count: 247 }];


// ─── Top Jobs Table ─────────────────────────────────────────────
export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  salary: number;
  postedDate: string;
  type: 'Full-time' | 'Part-time' | 'Remote' | 'Contract';
  experience: 'Junior' | 'Mid' | 'Senior' | 'Lead';
}

export const topJobs: Job[] = [
{
  id: '1',
  title: 'Senior ML Engineer',
  company: 'Google',
  location: 'San Francisco, CA',
  salary: 185000,
  postedDate: '2026-03-24',
  type: 'Full-time',
  experience: 'Senior'
},
{
  id: '2',
  title: 'Staff Software Engineer',
  company: 'Meta',
  location: 'New York, NY',
  salary: 175000,
  postedDate: '2026-03-23',
  type: 'Full-time',
  experience: 'Lead'
},
{
  id: '3',
  title: 'Data Scientist',
  company: 'Netflix',
  location: 'Los Angeles, CA',
  salary: 162000,
  postedDate: '2026-03-25',
  type: 'Remote',
  experience: 'Senior'
},
{
  id: '4',
  title: 'Product Manager',
  company: 'Apple',
  location: 'Cupertino, CA',
  salary: 158000,
  postedDate: '2026-03-22',
  type: 'Full-time',
  experience: 'Senior'
},
{
  id: '5',
  title: 'DevOps Engineer',
  company: 'Amazon',
  location: 'Seattle, WA',
  salary: 148000,
  postedDate: '2026-03-24',
  type: 'Full-time',
  experience: 'Mid'
},
{
  id: '6',
  title: 'Frontend Developer',
  company: 'Stripe',
  location: 'San Francisco, CA',
  salary: 142000,
  postedDate: '2026-03-25',
  type: 'Remote',
  experience: 'Mid'
},
{
  id: '7',
  title: 'Backend Engineer',
  company: 'Spotify',
  location: 'New York, NY',
  salary: 138000,
  postedDate: '2026-03-21',
  type: 'Full-time',
  experience: 'Mid'
},
{
  id: '8',
  title: 'UX Designer',
  company: 'Figma',
  location: 'San Francisco, CA',
  salary: 132000,
  postedDate: '2026-03-23',
  type: 'Remote',
  experience: 'Senior'
},
{
  id: '9',
  title: 'Cloud Architect',
  company: 'Microsoft',
  location: 'Seattle, WA',
  salary: 170000,
  postedDate: '2026-03-20',
  type: 'Full-time',
  experience: 'Lead'
},
{
  id: '10',
  title: 'AI Research Scientist',
  company: 'OpenAI',
  location: 'San Francisco, CA',
  salary: 195000,
  postedDate: '2026-03-26',
  type: 'Full-time',
  experience: 'Senior'
}];


// ─── Featured Insights ──────────────────────────────────────────
export interface InsightItem {
  name: string;
  value: string;
}

export interface FeaturedInsight {
  title: string;
  description: string;
  items: InsightItem[];
}

export const featuredInsights: FeaturedInsight[] = [
{
  title: 'Top Paying Cities',
  description: 'Cities with the highest average salaries',
  items: [
  { name: 'San Francisco', value: '$142,000' },
  { name: 'New York', value: '$138,000' },
  { name: 'Seattle', value: '$135,000' },
  { name: 'Boston', value: '$128,000' },
  { name: 'Austin', value: '$122,000' }]

},
{
  title: 'Fastest Growing Roles',
  description: 'Roles with highest YoY demand increase',
  items: [
  { name: 'ML Engineer', value: '+42%' },
  { name: 'Data Engineer', value: '+38%' },
  { name: 'Cloud Architect', value: '+31%' },
  { name: 'DevOps Engineer', value: '+27%' },
  { name: 'AI Researcher', value: '+24%' }]

},
{
  title: 'Highest Salary Companies',
  description: 'Companies offering top compensation',
  items: [
  { name: 'OpenAI', value: '$195,000' },
  { name: 'Google', value: '$185,000' },
  { name: 'Meta', value: '$175,000' },
  { name: 'Microsoft', value: '$170,000' },
  { name: 'Netflix', value: '$162,000' }]

}];


// ─── Search Page Data ───────────────────────────────────────────
export const allJobs: Job[] = [
...topJobs,
{
  id: '11',
  title: 'Junior Software Engineer',
  company: 'Shopify',
  location: 'Austin, TX',
  salary: 85000,
  postedDate: '2026-03-19',
  type: 'Remote',
  experience: 'Junior'
},
{
  id: '12',
  title: 'Senior Data Engineer',
  company: 'Databricks',
  location: 'San Francisco, CA',
  salary: 168000,
  postedDate: '2026-03-18',
  type: 'Full-time',
  experience: 'Senior'
},
{
  id: '13',
  title: 'Product Designer',
  company: 'Airbnb',
  location: 'San Francisco, CA',
  salary: 145000,
  postedDate: '2026-03-17',
  type: 'Full-time',
  experience: 'Mid'
},
{
  id: '14',
  title: 'Platform Engineer',
  company: 'Cloudflare',
  location: 'Austin, TX',
  salary: 152000,
  postedDate: '2026-03-16',
  type: 'Remote',
  experience: 'Senior'
},
{
  id: '15',
  title: 'Mobile Developer',
  company: 'Uber',
  location: 'New York, NY',
  salary: 140000,
  postedDate: '2026-03-15',
  type: 'Full-time',
  experience: 'Mid'
},
{
  id: '16',
  title: 'Security Engineer',
  company: 'CrowdStrike',
  location: 'Denver, CO',
  salary: 155000,
  postedDate: '2026-03-14',
  type: 'Full-time',
  experience: 'Senior'
},
{
  id: '17',
  title: 'QA Engineer',
  company: 'Atlassian',
  location: 'Seattle, WA',
  salary: 112000,
  postedDate: '2026-03-13',
  type: 'Remote',
  experience: 'Mid'
},
{
  id: '18',
  title: 'Technical Writer',
  company: 'Twilio',
  location: 'Denver, CO',
  salary: 95000,
  postedDate: '2026-03-12',
  type: 'Remote',
  experience: 'Junior'
},
{
  id: '19',
  title: 'Engineering Manager',
  company: 'Salesforce',
  location: 'San Francisco, CA',
  salary: 190000,
  postedDate: '2026-03-11',
  type: 'Full-time',
  experience: 'Lead'
},
{
  id: '20',
  title: 'Full Stack Developer',
  company: 'GitHub',
  location: 'Seattle, WA',
  salary: 148000,
  postedDate: '2026-03-10',
  type: 'Remote',
  experience: 'Senior'
}];


// ─── Filter Options ─────────────────────────────────────────────
export const cities = [
'San Francisco',
'New York',
'Seattle',
'Austin',
'Boston',
'Chicago',
'Denver',
'Los Angeles',
'Cupertino'];


export const experienceLevels = ['Junior', 'Mid', 'Senior', 'Lead'];
export const jobTypes = ['Full-time', 'Part-time', 'Remote', 'Contract'];

export const companies = [
'Google',
'Meta',
'Netflix',
'Apple',
'Amazon',
'Stripe',
'Spotify',
'Figma',
'Microsoft',
'OpenAI',
'Shopify',
'Databricks',
'Airbnb',
'Cloudflare',
'Uber',
'CrowdStrike',
'Atlassian',
'Twilio',
'Salesforce',
'GitHub'];


// ─── Candidates ─────────────────────────────────────────────────
export interface Candidate {
  id: string;
  name: string;
  title: string;
  company: string;
  location: string;
  startDate: string;
  skills: string[];
  experience: 'Junior' | 'Mid' | 'Senior' | 'Lead';
  email: string;
  availability: 'Active' | 'Open to offers' | 'Not looking';
}

export const candidates: Candidate[] = [
{
  id: 'c1',
  name: 'Sarah Chen',
  title: 'Senior Software Engineer',
  company: 'Google',
  location: 'San Francisco, CA',
  startDate: '2022-06-15',
  skills: ['React', 'TypeScript', 'Go', 'Kubernetes'],
  experience: 'Senior',
  email: 'sarah.chen@email.com',
  availability: 'Open to offers'
},
{
  id: 'c2',
  name: 'James Rodriguez',
  title: 'Staff Software Engineer',
  company: 'Meta',
  location: 'New York, NY',
  startDate: '2021-01-10',
  skills: ['Python', 'React', 'GraphQL', 'AWS'],
  experience: 'Lead',
  email: 'james.r@email.com',
  availability: 'Active'
},
{
  id: 'c3',
  name: 'Priya Patel',
  title: 'ML Engineer',
  company: 'OpenAI',
  location: 'San Francisco, CA',
  startDate: '2023-03-01',
  skills: ['Python', 'PyTorch', 'TensorFlow', 'MLOps'],
  experience: 'Senior',
  email: 'priya.p@email.com',
  availability: 'Not looking'
},
{
  id: 'c4',
  name: 'Michael Thompson',
  title: 'Frontend Developer',
  company: 'Stripe',
  location: 'San Francisco, CA',
  startDate: '2023-08-20',
  skills: ['React', 'TypeScript', 'Next.js', 'CSS'],
  experience: 'Mid',
  email: 'michael.t@email.com',
  availability: 'Open to offers'
},
{
  id: 'c5',
  name: 'Emily Watson',
  title: 'Data Scientist',
  company: 'Netflix',
  location: 'Los Angeles, CA',
  startDate: '2022-11-05',
  skills: ['Python', 'SQL', 'Spark', 'Tableau'],
  experience: 'Senior',
  email: 'emily.w@email.com',
  availability: 'Active'
},
{
  id: 'c6',
  name: 'David Kim',
  title: 'DevOps Engineer',
  company: 'Amazon',
  location: 'Seattle, WA',
  startDate: '2021-07-12',
  skills: ['AWS', 'Terraform', 'Docker', 'CI/CD'],
  experience: 'Senior',
  email: 'david.k@email.com',
  availability: 'Open to offers'
},
{
  id: 'c7',
  name: 'Lisa Zhang',
  title: 'Product Manager',
  company: 'Apple',
  location: 'Cupertino, CA',
  startDate: '2022-02-28',
  skills: ['Strategy', 'Analytics', 'Agile', 'User Research'],
  experience: 'Senior',
  email: 'lisa.z@email.com',
  availability: 'Not looking'
},
{
  id: 'c8',
  name: 'Alex Johnson',
  title: 'Backend Engineer',
  company: 'Spotify',
  location: 'New York, NY',
  startDate: '2023-05-15',
  skills: ['Java', 'Microservices', 'PostgreSQL', 'Kafka'],
  experience: 'Mid',
  email: 'alex.j@email.com',
  availability: 'Active'
},
{
  id: 'c9',
  name: 'Rachel Green',
  title: 'UX Designer',
  company: 'Figma',
  location: 'San Francisco, CA',
  startDate: '2022-09-01',
  skills: ['Figma', 'User Research', 'Prototyping', 'Design Systems'],
  experience: 'Senior',
  email: 'rachel.g@email.com',
  availability: 'Open to offers'
},
{
  id: 'c10',
  name: 'Omar Hassan',
  title: 'Cloud Architect',
  company: 'Microsoft',
  location: 'Seattle, WA',
  startDate: '2020-04-10',
  skills: ['Azure', 'AWS', 'GCP', 'Architecture'],
  experience: 'Lead',
  email: 'omar.h@email.com',
  availability: 'Not looking'
},
{
  id: 'c11',
  name: 'Nina Kowalski',
  title: 'Junior Software Engineer',
  company: 'Shopify',
  location: 'Austin, TX',
  startDate: '2025-09-01',
  skills: ['JavaScript', 'React', 'Node.js', 'SQL'],
  experience: 'Junior',
  email: 'nina.k@email.com',
  availability: 'Open to offers'
},
{
  id: 'c12',
  name: 'Carlos Mendez',
  title: 'Security Engineer',
  company: 'CrowdStrike',
  location: 'Denver, CO',
  startDate: '2021-11-20',
  skills: ['Cybersecurity', 'Pen Testing', 'SIEM', 'Python'],
  experience: 'Senior',
  email: 'carlos.m@email.com',
  availability: 'Active'
},
{
  id: 'c13',
  name: 'Aisha Okafor',
  title: 'Full Stack Developer',
  company: 'GitHub',
  location: 'Seattle, WA',
  startDate: '2023-01-15',
  skills: ['Ruby', 'React', 'PostgreSQL', 'GraphQL'],
  experience: 'Senior',
  email: 'aisha.o@email.com',
  availability: 'Open to offers'
},
{
  id: 'c14',
  name: 'Tom Bradley',
  title: 'Engineering Manager',
  company: 'Salesforce',
  location: 'San Francisco, CA',
  startDate: '2019-08-05',
  skills: ['Leadership', 'Agile', 'System Design', 'Java'],
  experience: 'Lead',
  email: 'tom.b@email.com',
  availability: 'Not looking'
},
{
  id: 'c15',
  name: 'Sophie Martin',
  title: 'Data Engineer',
  company: 'Databricks',
  location: 'San Francisco, CA',
  startDate: '2022-04-18',
  skills: ['Spark', 'Python', 'Airflow', 'dbt'],
  experience: 'Mid',
  email: 'sophie.m@email.com',
  availability: 'Active'
}];