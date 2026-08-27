import './WorkflowUI.css';

export default function WorkflowStepper({ steps = [], activeIndex = 0, ariaLabel = 'Tiến trình công việc' }) {
  if (!steps.length) return null;

  return (
    <ol
      className="workflow-stepper"
      aria-label={ariaLabel}
      style={{ '--workflow-step-count': steps.length }}
    >
      {steps.map((step, index) => {
        const state = index < activeIndex ? 'complete' : index === activeIndex ? 'active' : 'pending';
        return (
          <li
            key={step.key || step.title}
            className={`workflow-stepper__item workflow-stepper__item--${state}`}
            aria-current={state === 'active' ? 'step' : undefined}
          >
            <span className="workflow-stepper__number">{index + 1}</span>
            <strong className="workflow-stepper__title">{step.title}</strong>
            {step.description && <span className="workflow-stepper__description">{step.description}</span>}
          </li>
        );
      })}
    </ol>
  );
}
