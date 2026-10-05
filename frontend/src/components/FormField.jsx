export default function FormField({ label, error, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input className={error ? "invalid" : ""} {...props} />
      {error && <small className="error">{error}</small>}
    </label>
  );
}
