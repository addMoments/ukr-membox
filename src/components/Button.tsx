import ActivityIndicator from '../v2-components/activity-indicator';
import './Button.css';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: string;
  text: string;
  variant?: 'primary' | 'secondary';
  loading?: boolean;
}

function Button({ icon, text, variant = 'primary', className = '', loading = false, ...rest }: ButtonProps) {
  const loadingProps = loading ? {disabled: true} : {};
  return (
    <button {...rest} {...loadingProps} className={`btn btn-${variant} ${className} ${loading ? 'l' : ''}`}>
      {icon && !loading && <i className={icon} />}
      {loading && <div style={{position: 'relative', width: "1em", height: "1em"}}><ActivityIndicator color='#1c1917' /></div>}
      {text}
    </button>
  );
}

export default Button;
