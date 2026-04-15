const SKILLS = new Map([
  // — Programming languages —
  ["python", "Python"], ["python3", "Python"],
  ["javascript", "JavaScript"], ["js", "JavaScript"],
  ["typescript", "TypeScript"], ["ts", "TypeScript"],
  ["java", "Java"],
  ["c++", "C++"], ["cpp", "C++"],
  ["c#", "C#"], ["csharp", "C#"],
  ["go", "Go"], ["golang", "Go"],
  ["rust", "Rust"],
  ["ruby", "Ruby"],
  ["php", "PHP"],
  ["swift", "Swift"],
  ["kotlin", "Kotlin"],
  ["scala", "Scala"],
  ["r", "R"],
  ["matlab", "MATLAB"],
  ["perl", "Perl"],
  ["bash", "Bash"], ["shell", "Bash"],
  ["sql", "SQL"],
  ["html", "HTML"], ["html5", "HTML"],
  ["css", "CSS"], ["css3", "CSS"],
  ["sass", "SASS"], ["scss", "SASS"],
  ["dart", "Dart"],
  ["elixir", "Elixir"],
  ["haskell", "Haskell"],
  ["clojure", "Clojure"],
  ["lua", "Lua"],
  ["objective-c", "Objective-C"],

  // — Frontend —
  ["react", "React"], ["reactjs", "React"], ["react.js", "React"],
  ["angular", "Angular"], ["angularjs", "Angular"],
  ["vue", "Vue.js"], ["vuejs", "Vue.js"], ["vue.js", "Vue.js"],
  ["svelte", "Svelte"],
  ["next.js", "Next.js"], ["nextjs", "Next.js"],
  ["nuxt", "Nuxt.js"], ["nuxtjs", "Nuxt.js"], ["nuxt.js", "Nuxt.js"],
  ["gatsby", "Gatsby"],
  ["remix", "Remix"],
  ["jquery", "jQuery"],
  ["bootstrap", "Bootstrap"],
  ["tailwind", "Tailwind CSS"], ["tailwindcss", "Tailwind CSS"],
  ["material ui", "Material UI"], ["mui", "Material UI"],

  // — Backend —
  ["node.js", "Node.js"], ["nodejs", "Node.js"], ["node", "Node.js"],
  ["express", "Express"], ["expressjs", "Express"],
  ["django", "Django"],
  ["flask", "Flask"],
  ["fastapi", "FastAPI"],
  ["spring", "Spring"], ["spring boot", "Spring Boot"], ["springboot", "Spring Boot"],
  [".net", ".NET"], ["dotnet", ".NET"], ["asp.net", "ASP.NET"],
  ["rails", "Ruby on Rails"], ["ruby on rails", "Ruby on Rails"],
  ["laravel", "Laravel"],
  ["nestjs", "NestJS"], ["nest.js", "NestJS"],
  ["fastify", "Fastify"],

  // — Databases —
  ["mysql", "MySQL"],
  ["postgresql", "PostgreSQL"], ["postgres", "PostgreSQL"],
  ["mongodb", "MongoDB"], ["mongo", "MongoDB"],
  ["redis", "Redis"],
  ["elasticsearch", "Elasticsearch"], ["elastic", "Elasticsearch"],
  ["dynamodb", "DynamoDB"],
  ["cassandra", "Cassandra"],
  ["sql server", "SQL Server"], ["mssql", "SQL Server"],
  ["sqlite", "SQLite"],
  ["neo4j", "Neo4j"],
  ["firebase", "Firebase"],
  ["mariadb", "MariaDB"],
  ["supabase", "Supabase"],
  ["snowflake", "Snowflake"],

  // — Cloud —
  ["aws", "AWS"], ["amazon web services", "AWS"],
  ["azure", "Azure"], ["microsoft azure", "Azure"],
  ["gcp", "GCP"], ["google cloud", "GCP"], ["google cloud platform", "GCP"],
  ["heroku", "Heroku"],
  ["vercel", "Vercel"],
  ["netlify", "Netlify"],
  ["digitalocean", "DigitalOcean"],
  ["cloudflare", "Cloudflare"],

  // — DevOps —
  ["docker", "Docker"],
  ["kubernetes", "Kubernetes"], ["k8s", "Kubernetes"],
  ["terraform", "Terraform"],
  ["ansible", "Ansible"],
  ["jenkins", "Jenkins"],
  ["github actions", "GitHub Actions"],
  ["gitlab ci", "GitLab CI"],
  ["circleci", "CircleCI"],
  ["ci/cd", "CI/CD"], ["cicd", "CI/CD"],
  ["helm", "Helm"],
  ["prometheus", "Prometheus"],
  ["grafana", "Grafana"],
  ["datadog", "Datadog"],
  ["nginx", "Nginx"],
  ["apache", "Apache"],

  // — Data / ML —
  ["tensorflow", "TensorFlow"],
  ["pytorch", "PyTorch"],
  ["pandas", "Pandas"],
  ["numpy", "NumPy"],
  ["scikit-learn", "Scikit-learn"], ["sklearn", "Scikit-learn"],
  ["keras", "Keras"],
  ["spark", "Apache Spark"], ["apache spark", "Apache Spark"], ["pyspark", "Apache Spark"],
  ["hadoop", "Hadoop"],
  ["kafka", "Apache Kafka"], ["apache kafka", "Apache Kafka"],
  ["airflow", "Apache Airflow"], ["apache airflow", "Apache Airflow"],
  ["tableau", "Tableau"],
  ["power bi", "Power BI"], ["powerbi", "Power BI"],
  ["databricks", "Databricks"],
  ["dbt", "dbt"],
  ["looker", "Looker"],
  ["jupyter", "Jupyter"],
  ["mlflow", "MLflow"],
  ["hugging face", "Hugging Face"], ["huggingface", "Hugging Face"],
  ["langchain", "LangChain"],

  // — Tools / practices —
  ["git", "Git"],
  ["linux", "Linux"],
  ["jira", "Jira"],
  ["confluence", "Confluence"],
  ["figma", "Figma"],
  ["webpack", "Webpack"],
  ["vite", "Vite"],
  ["graphql", "GraphQL"],
  ["rest api", "REST API"], ["restful", "REST API"],
  ["grpc", "gRPC"],
  ["websocket", "WebSocket"], ["websockets", "WebSocket"],
  ["rabbitmq", "RabbitMQ"],
  ["selenium", "Selenium"],
  ["cypress", "Cypress"],
  ["jest", "Jest"],
  ["pytest", "Pytest"],
  ["postman", "Postman"],
  ["swagger", "Swagger"],
  ["oauth", "OAuth"],
  ["jwt", "JWT"],

  // — Methodologies —
  ["agile", "Agile"],
  ["scrum", "Scrum"],
  ["kanban", "Kanban"],
  ["devops", "DevOps"],
  ["microservices", "Microservices"],
  ["serverless", "Serverless"],
  ["tdd", "TDD"],
]);

const MULTI_WORD_KEYS = [];
const SINGLE_WORD_KEYS = [];
for (const [k] of SKILLS) {
  if (/[\s./#+-]/.test(k) && k.length > 2) MULTI_WORD_KEYS.push(k);
  else SINGLE_WORD_KEYS.push(k);
}
MULTI_WORD_KEYS.sort((a, b) => b.length - a.length);

const _multiWordRegexCache = new Map();
function multiWordRegex(key) {
  if (!_multiWordRegexCache.has(key)) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    _multiWordRegexCache.set(key, new RegExp(`\\b${escaped}\\b`, "i"));
  }
  return _multiWordRegexCache.get(key);
}

/**
 * Extract known skills from text (title, description, job family, etc.).
 * @returns {{ skills: string[], rulesApplied: string[] }}
 */
export function extractSkills(text, tracker) {
  const rulesApplied = [];
  const raw = (text == null ? "" : String(text)).trim();

  if (!raw) {
    tracker?.record("SKL-05", "skills_extraction", "No skills extracted: input text was empty or no dictionary keywords matched in the scanned fields — skills array empty.", {
      before: { text: "" }, after: { skills: [] },
    });
    return { skills: [], rulesApplied: ["SKL-05"] };
  }

  const lower = raw.toLowerCase();
  const found = new Set();

  for (const key of MULTI_WORD_KEYS) {
    if (multiWordRegex(key).test(lower)) {
      const canonical = SKILLS.get(key);
      if (canonical) found.add(canonical);
    }
  }

  const tokens = lower.split(/[\s,;|/\-()[\]{}]+/).filter(Boolean);
  for (const tok of tokens) {
    const canonical = SKILLS.get(tok);
    if (canonical && !found.has(canonical)) found.add(canonical);
  }

  const skills = [...found];
  const snippet = raw.length > 200 ? raw.slice(0, 200) + "…" : raw;

  if (skills.length === 0) {
    rulesApplied.push("SKL-05");
    tracker?.record("SKL-05", "skills_extraction", "No skills extracted: input text was empty or no dictionary keywords matched in the scanned fields — skills array empty.", {
      before: { text: snippet }, after: { skills: [] },
    });
  } else if (skills.length === 1) {
    rulesApplied.push("SKL-02");
    tracker?.record("SKL-02", "skills_extraction", "Exactly one known skill token matched (multi-word patterns first, then single tokens); deduplicated to one canonical label.", {
      before: { text: snippet }, after: { skills },
    });
  } else {
    rulesApplied.push("SKL-04");
    tracker?.record("SKL-04", "skills_extraction", "Multiple distinct skills matched from the combined text; output is a deduplicated list of canonical skill names.", {
      before: { text: snippet }, after: { skills },
    });
  }

  return { skills, rulesApplied };
}
