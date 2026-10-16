import Link from 'next/link';

const categories = [
  { number: '01', code: 'UGC NET', name: 'University Grants Commission NET', description: 'Subject preparation, Paper I and Paper II mock journeys.' },
  { number: '02', code: 'CSIR NET', name: 'Joint CSIR-UGC NET', description: 'Science-specific examination blueprints, sections and scoring.' },
  { number: '03', code: 'SET / SLET', name: 'State & Regional Eligibility Tests', description: 'Exam-specific formats, regional jurisdiction and verified cycles.' },
];

export default function HomePage() {
  return <main>
    <header className="topbar page-wrap">
      <div className="brand"><div className="brand-mark">N<span>/</span>S</div><div><strong>NET<span className="brand-slash">/</span>SLET</strong><small>Preparation Intelligence Platform</small></div></div>
      <div className="header-right"><span className="status-dot" /><span>Continuous preparation preview</span><Link className="header-link" href="/sign-in">Student sign in</Link><Link className="header-link" href="/preparation">Student preparation</Link><Link className="header-link" href="/examinations">Examination catalogue &rarr;</Link></div>
    </header>
    <section className="hero page-wrap">
      <div className="eyebrow"><span className="eyebrow-line" />ENGINEERING FOUNDATION / OCTOBER 2026</div>
      <div className="hero-grid">
        <div><h1>Prepare with <em>precision.</em><br />Progress with proof.</h1><p className="hero-desc">A unified learning and assessment platform for NET and regional SET/SLET aspirants - being built around reliable exam simulations, reviewed explanations, and meaningful progress.</p><div className="hero-actions"><a className="primary-button" href="#exam-categories">Explore planned exam coverage <span>&rarr;</span></a><span className="hero-note">Product modules are not live yet.</span></div></div>
        <aside className="feature-panel"><div className="feature-caption">ENGINEERING PRINCIPLES</div><div className="feature-score">01 <span>/ 04</span></div><div className="feature-rule"/><p>Build a trustworthy foundation before scaling assessment and learning workflows.</p><ul><li><span>01</span>Verified exam-cycle rules</li><li><span>02</span>Durable answer and scoring integrity</li><li><span>03</span>Learning that targets misconceptions</li><li><span>04</span>Evidence-based student progress</li></ul></aside>
      </div>
    </section>
    <section className="category-section" id="exam-categories"><div className="page-wrap"><div className="section-intro"><div><div className="eyebrow">EXAMINATION CATALOGUE</div><h2>One platform. Distinct exam rules.</h2></div><Link className="section-tag" href="/examinations">Browse catalogue &rarr;</Link></div><div className="card-grid">{categories.map(cat=><article key={cat.code} className="category-card"><div className="card-top"><span>{cat.number} / EXAM FAMILY</span><span className="arrow-circle">&rarr;</span></div><div><div className="card-code">{cat.code}</div><h3>{cat.name}</h3><p>{cat.description}</p></div><div className="card-bottom">Pattern verification required <span>&rarr;</span></div></article>)}</div></div></section>
    <section className="foundation page-wrap"><div><div className="eyebrow">CURRENT BUILD STATUS</div><h2>Architecture before features.</h2><p>Next.js frontend, NestJS API, PostgreSQL/Prisma data foundation and Redis readiness. Auth, exams, real attempts and content management are future implementation stages.</p></div><div className="foundation-tags"><span>Next.js + TypeScript</span><span>NestJS</span><span>PostgreSQL + Prisma</span><span>Redis</span><span>Docker</span><span>Automated tests</span></div></section>
    <footer className="page-wrap footer"><span>NET/SLET - Internal development preview</span><span>Independent preparation product; no affiliation with NTA, UGC, CSIR or state exam organizers.</span></footer>
  </main>;
}
