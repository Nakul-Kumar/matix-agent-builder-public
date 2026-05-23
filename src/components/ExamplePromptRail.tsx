import type { ExampleCard } from "../data/publicBuilderContent";

export function ExamplePromptRail({
  disabled,
  examples,
  onSelect,
}: {
  disabled: boolean;
  examples: ExampleCard[];
  onSelect: (prompt: string) => void;
}) {
  return (
    <section className="exampleRail" aria-labelledby="example-title">
      <div className="sectionIntro">
        <h2 id="example-title">Start with an example</h2>
        <p>Choose one to fill the prompt. You can edit it first.</p>
      </div>
      <div className="exampleGrid">
        {examples.map((card) => (
          <button
            className="exampleCard"
            disabled={disabled}
            key={card.title}
            onClick={() => onSelect(card.prompt)}
            type="button"
          >
            <span className="exampleCategory">{card.category}</span>
            <span className="exampleTitle">{card.title}</span>
            <span className="examplePreview">{card.preview}</span>
            <span className="exampleFootnote">
              <span>{card.footnote}</span>
              <span aria-hidden="true">Use this &gt;</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
