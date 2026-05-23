export function FeedbackForm({
  email,
  error,
  feedback,
  feedbackSent,
  onEmailChange,
  onFeedbackChange,
  onRatingChange,
  onSubmit,
  rating,
  submitting,
}: {
  email: string;
  error: string | null;
  feedback: string;
  feedbackSent: boolean;
  onEmailChange: (value: string) => void;
  onFeedbackChange: (value: string) => void;
  onRatingChange: (value: number) => void;
  onSubmit: () => void;
  rating: number;
  submitting: boolean;
}) {
  return (
    <section className="feedback" aria-labelledby="feedback-title">
      <header className="feedbackHead">
        <span className="eyebrow">Feedback</span>
        <h2 id="feedback-title">Was this preview useful?</h2>
        <p>
          Tell us what was useful, missing, or confusing. Leave an email if
          you want a reply. Your feedback may be stored under the public
          preview privacy policy.
        </p>
      </header>

      {feedbackSent ? (
        <div className="feedbackThanks" role="status">
          <strong>Thanks.</strong> We got your note.
        </div>
      ) : (
        <div className="feedbackForm">
          <fieldset className="ratingRow">
            <legend className="ratingLabel">Rating</legend>
            <div className="ratingButtons">
              {[1, 2, 3, 4, 5].map((value) => (
                <label
                  className={`ratingButton${
                    value === rating ? " ratingButton-active" : ""
                  }`}
                  key={value}
                >
                  <input
                    checked={value === rating}
                    name="feedback-rating"
                    onChange={() => onRatingChange(value)}
                    type="radio"
                    value={value}
                  />
                  {value}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="srOnly" htmlFor="feedback-message">
            Feedback message
          </label>
          <textarea
            id="feedback-message"
            maxLength={2000}
            onChange={(event) => onFeedbackChange(event.target.value)}
            placeholder="Tell us what was useful, missing, or confusing."
            value={feedback}
          />
          <label className="srOnly" htmlFor="feedback-email">
            Email address
          </label>
          <input
            autoComplete="email"
            className="emailInput"
            id="feedback-email"
            onChange={(event) => onEmailChange(event.target.value)}
            placeholder="Email (optional)"
            type="email"
            value={email}
          />
          {error && <p className="feedbackError">{error}</p>}
          <button
            className="secondaryButton"
            disabled={submitting || !feedback.trim()}
            onClick={onSubmit}
            type="button"
          >
            {submitting ? "Sending..." : "Send feedback"}
          </button>
        </div>
      )}
    </section>
  );
}
