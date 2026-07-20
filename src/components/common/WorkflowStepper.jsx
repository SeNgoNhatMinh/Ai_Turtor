import './WorkflowUI.css';

export default function WorkflowStepper({ steps = [], ariaLabel = 'Quy trình' }) {
  return (
    <ol
      className="workflow-stepper"
      aria-label={ariaLabel}
      style={{ '--workflow-step-count': Math.max(steps.length, 1) }}
    >
      {steps.map((step, index) => (
        <li
          key={step.key || step.title}
          className={`workflow-stepper__item workflow-stepper__item--${step.state || 'upcoming'}`}
        >
          <span className="workflow-stepper__number">{index + 1}</span>
          <strong className="workflow-stepper__title">{step.title}</strong>
          {step.description && <span className="workflow-stepper__description">{step.description}</span>}
        </li>
      ))}
    </ol>
  );
}
