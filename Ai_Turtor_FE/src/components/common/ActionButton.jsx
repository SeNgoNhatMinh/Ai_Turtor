import { Button } from 'antd';

const INTENT_PROPS = {
  primary: { type: 'primary' },
  danger: { danger: true },
  text: { type: 'text' },
  link: { type: 'link' },
};

export default function ActionButton({ intent = 'default', className = '', ...props }) {
  const intentProps = INTENT_PROPS[intent] || {};
  const classes = ['app-action-button', `app-action-button--${intent}`, className]
    .filter(Boolean)
    .join(' ');

  return <Button {...intentProps} {...props} className={classes} />;
}
