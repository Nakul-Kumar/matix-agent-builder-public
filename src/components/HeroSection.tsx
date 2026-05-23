export function HeroSection() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <p className="eyebrow">Inspectable agent blueprint</p>
      <h1 id="hero-title">What should this agent do?</h1>
      <p className="heroLead">
        Matix drafts skills, MCPs, files, and eval steps for review. Exports
        are example JSON files with placeholders, no secrets, and no live
        provider calls.
      </p>
    </section>
  );
}
