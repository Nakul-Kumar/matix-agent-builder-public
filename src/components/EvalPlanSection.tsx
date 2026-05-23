import type { RuntimePlacard } from "../types";

export function EvalPlanSection({ placards }: { placards: RuntimePlacard[] }) {
  const seen = new Set<string>();
  const steps: string[] = [];
  for (const placard of placards) {
    for (const step of placard.eval_plan ?? []) {
      if (!step || seen.has(step)) continue;
      seen.add(step);
      steps.push(step);
    }
  }
  if (steps.length === 0) return null;

  return (
    <section className="stackedSection" id="section-eval-plan">
      <header className="resultSectionHeader compact">
        <span className="eyebrow">Eval plan</span>
        <h2>{steps.length} checks to run</h2>
      </header>
      <ol className="evalList">
        {steps.map((step, index) => (
          <li key={`eval-${index}`}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <p>{step}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
