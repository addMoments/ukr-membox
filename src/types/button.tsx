import { Link } from 'react-router-dom';
import { HTMLAttributes } from 'react';

type ActionBase = {
  text: string;
};

type Action = ActionBase & (
  | { variant: 'link'; to: string }
  | { variant: 'href'; href: string }
  | { variant: 'button'; onClick: () => void }
  | { variant: 'icontext'; icon: string; onClick: () => void }
);

interface ActionRenderProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  action: Action;
}

function ActionRender({ action, ...rest}: ActionRenderProps & any) {
  switch (action.variant) {
    case 'link':
      return <Link to={action.to} {...rest}>{action.text}</Link>;
    case 'href':
      return <a href={action.href} {...rest}>{action.text}</a>;
    case 'button':
    case 'icontext':
      return (
        <button {...rest} onClick={action.onClick}>
          {action.text}
        </button>
      );
    default:
      return <></>
  }
}

export type { Action };
export { ActionRender };